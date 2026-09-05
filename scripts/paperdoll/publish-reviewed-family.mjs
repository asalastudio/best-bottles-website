#!/usr/bin/env node
/** Publish an exact-SKU, source-reviewed family batch. Dry run unless --apply.
 * Uploaded bytes are content addressed. Existing row receipts remain in backup;
 * no source asset, product, or Shopify identity is deleted or overwritten.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ConvexHttpClient} from 'convex/browser';
import {createBlobStore,verifyPublicUrl} from './lib/store-blob.mjs';
const argv=process.argv.slice(2);const value=k=>argv[argv.indexOf(k)+1];
const batch=path.resolve(value('--batch'));const release=path.resolve(value('--release'));
const mode=value('--mode');if(!['plates','kits'].includes(mode))throw Error('--mode plates|kits required');
const apply=argv.includes('--apply');const url=process.env.NEXT_PUBLIC_CONVEX_URL;
if(!url)throw Error('Explicit target URL is required');const client=new ConvexHttpClient(url);
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const plateManifest=await read(path.join(batch,'plates/manifest.json'));
const scope=new Set(plateManifest.rows.map(r=>r.websiteSku));
if(scope.size!==plateManifest.rows.length)throw Error('Duplicate scope SKUs');
const products=[];let cursor=null;
do {const p=await client.query('products:getAllForPlates',{limit:500,cursor});products.push(...p.page);cursor=p.isDone?null:p.continueCursor;}while(cursor);
const exact=new Map();for(const p of products){if(scope.has(p.websiteSku)){if(exact.has(p.websiteSku))throw Error('Duplicate exact catalog SKU '+p.websiteSku);exact.set(p.websiteSku,p);}}
for(const sku of scope)if(!exact.has(sku))throw Error('Catalog reconciliation required: '+sku);
const old=await read(path.join(release,'backup',`${url.includes('precise-raccoon')?'production':'development'}-productPlates.json`));
const oldBySku=new Map(old.rows.map(r=>[r.sku,r]));
const rows=mode==='plates'?plateManifest.rows:(await read(path.join(release,'kits/manifest.json'))).rows.filter(r=>r.publishable);
if(!rows.length)throw Error('No reviewed rows to publish');
const report={target:url,mode,startedAt:new Date().toISOString(),apply,assets:[],rows:[],errors:[]};
const assets=new Map();const prepared=[];
function addAsset(root,asset,role){
 if(!asset) return null;
 const key=asset.storeKey,rel=asset.key??asset.image;
 if(!key?.includes(asset.sha256)||!rel)throw Error('Missing content-addressed asset');
 const absolute=path.resolve(root,rel);if(!absolute.startsWith(path.resolve(root)+path.sep))throw Error('Asset escapes batch');
 const ref={key,sha256:asset.sha256,bytes:asset.bytes,width:asset.width,height:asset.height};
 assets.set(key,{...ref,path:absolute});return {...ref,role};
}
for(const row of rows){
 const sku=row.websiteSku??row.sku;const p=exact.get(sku);
 if(!scope.has(sku)||!p||p.family!=='Cylinder')throw Error('Unexpected release SKU '+sku);
 if(mode==='plates'){
  if(row.mediaStatus!=='validated_local')throw Error('Unvalidated plate '+sku);
  const evidence=row.evidence;
  if(evidence.returnedSku!==sku||hash(await fs.readFile(evidence.file))!==evidence.sha256)throw Error('Evidence drift '+sku);
  const source=row.source??{kind:'master',path:path.join('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master',row.plate.sourceRelPath),sha256:row.plate.sourceSha256};
  if(hash(await fs.readFile(source.path))!==source.sha256)throw Error('Source drift '+sku);
  const roles={};for(const [field,role] of [['plate','front'],['thumb','thumb'],['plateCapOff','frontCapOff'],['thumbCapOff','thumbCapOff']])roles[role]=addAsset(path.join(batch,'plates'),row[field],role);
  prepared.push({sku,websiteSku:sku,graceSku:p.graceSku,familyId:row.familyId,...roles,
   views:(oldBySku.get(sku)?.views??[]).filter(v=>v.source==='photo'),
   source:{library:source.kind==='master'?'master':'legacy-exact',path:source.kind==='master'?path.relative('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master',source.path):source.url,psdSha256:source.kind==='master'?source.sha256:null,psdSha256CapOff:row.plateCapOff?.sourceSha256??null},
   builder:{name:'reviewed-family-release',version:'1.0.0',builtAt:Date.now()},storageProvider:'vercel-blob'});
 }else{
  if(!(row.gates?.parity?.ok || (row.visualReview?.approved && row.gates?.parity?.mean<=12 && row.gates?.parity?.tailOver40<=.08))||!row.parts.some(p=>p.slot==='body'))throw Error('Invalid kit '+sku);
  const {canvas,anchors,completeness,three,source,familyId,plateSha256}=row;
  prepared.push({sku,websiteSku:sku,graceSku:p.graceSku,canvas,anchors,completeness,three,source,familyId,plateSha256,
   parts:row.parts.map(part=>({slot:part.slot,variantKey:part.variantKey,zOrder:part.zOrder,explodeIndex:part.explodeIndex,bounds:part.bounds,assembled:part.assembled,exploded:part.exploded,derivation:part.derivation,image:addAsset(path.join(release,'kits'),part,'part'),image2x:null,mask:null})),
   builder:{name:'reviewed-family-kit-release',version:'1.0.0',builtAt:Date.now()},storageProvider:'vercel-blob'});
 }
}
for(const asset of assets.values())if(hash(await fs.readFile(asset.path))!==asset.sha256)throw Error('Asset drift '+asset.path);
console.log(JSON.stringify({target:url,mode,apply,skus:prepared.length,assets:assets.size}));
if(!apply)process.exit(0);
const priorAssets=argv.includes('--verified-assets')?new Map((await read(path.resolve(value('--verified-assets')))).assets.map(a=>[a.key,a])):new Map();
const store=createBlobStore();const locations=new Map();const queue=[...assets.values()];let next=0;
await Promise.all(Array.from({length:5},async()=>{
 while(next<queue.length){const asset=queue[next++];let result;
  for(let attempt=0;attempt<3;attempt++){try{
   const bytes=await fs.readFile(asset.path);const prior=priorAssets.get(asset.key);const stored=prior?.sha256===asset.sha256?{url:prior.url}:await store.putObject(asset.key,bytes,'image/webp');const verified=await verifyPublicUrl(stored.url,{expectedBytes:bytes.length,expectedContentType:'image/webp'});
   if(!verified.ok)throw Error(verified.problems.join('; '));
   // Verify actual public bytes, not only storage metadata.
   const delivered=await fetch(stored.url);if(!delivered.ok||hash(Buffer.from(await delivered.arrayBuffer()))!==asset.sha256)throw Error('Delivered bytes differ');
   result={key:asset.key,url:stored.url,sha256:asset.sha256};break;
  }catch(e){if(attempt===2)throw e;}}
  locations.set(asset.key,result.url);report.assets.push(result);if(report.assets.length%100===0)console.log('Verified assets',report.assets.length+'/'+queue.length);
 }
}));
const materialize=ref=>ref?{url:locations.get(ref.key),key:ref.key,sha256:ref.sha256,bytes:ref.bytes,width:ref.width,height:ref.height}:null;
for(const row of prepared){if(mode==='plates')for(const key of ['front','thumb','frontCapOff','thumbCapOff'])row[key]=materialize(row[key]);else row.parts.forEach(p=>{p.image=materialize(p.image);});}
await fs.writeFile(path.join(release,`${mode}-${url.includes('precise-raccoon')?'production':'development'}-payload.json`),JSON.stringify(prepared,null,2));
for(let i=0;i<prepared.length;i+=25){
 const results=await client.mutation(mode==='plates'?'productPlates:upsertMany':'productKits:upsertMany',{writeToken:process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN,rows:prepared.slice(i,i+25)});
 report.rows.push(...results);await fs.writeFile(path.join(release,`${mode}-${url.includes('precise-raccoon')?'production':'development'}-publication.json`),JSON.stringify(report,null,2));
 if(results.some(r=>r.outcome==='error'))throw Error('Index mutation failed; see publication report');
}
console.log('Published',report.rows.length,'rows');
