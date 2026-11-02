import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createBlobStore, verifyPublicUrl } from './lib/store-blob.mjs';
const directory='docs/reviews/hosted-tall-cylinder9-2026-11-01';
const read=file=>JSON.parse(fs.readFileSync(file));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const review='docs/reviews/cylinder9-sleek-13415-2026-11-01';
const approval=read(review+'/visual-approval.json'),scope=read(review+'/scope.json');
assert.equal(hash(JSON.stringify(canonical(scope.rows))),approval.recipeSha256,'approved recipes changed');
assert.equal(hash(fs.readFileSync(review+'/scope-manifest.json')),approval.scopeManifestSha256,'scope changed');
const keys=new Set(['cylinder-9ml-13-415|Clear','cylinder-9ml-13-415|Frosted']);
const selected=Object.fromEntries(Object.entries(scope.rows).filter(([,kit])=>keys.has(kit.register?.plateKey)));
assert.equal(Object.keys(selected).length,72);
for(const key of keys)assert.equal(Object.values(selected).filter(k=>k.register.plateKey===key).length,36);
const manifestFile='src/lib/paper-doll/approved-kits.generated.json',before=read(manifestFile);
const prior=Object.fromEntries(Object.entries(before.rows).filter(([sku])=>!selected[sku]));
assert.equal(Object.keys(prior).length,290,'reconcile a changed prior release first');
const existing=new Map(Object.values(prior).flatMap(k=>k.parts.flatMap(p=>[p.image,p.detached?.image].filter(Boolean))).filter(i=>i.sha256).map(i=>[i.sha256,i.url]));
const assets=new Map();
for(const kit of Object.values(selected))for(const part of kit.parts){
 assert.ok(!part.image2x&&!part.mask,'unexpected secondary image');
 for(const image of [part.image,part.detached?.image].filter(Boolean)){
  const url=image.url,approved=approval.sourceImages[url];assert.ok(approved,'unapproved image '+url);
  if(url.startsWith('/')){const file='public'+url,bytes=fs.readFileSync(file),sha256=hash(bytes);assert.equal(sha256,approved.sha256,file);const ext=path.extname(file).slice(1);assert.ok(['svg','png','webp'].includes(ext));if(ext==='svg')assert.ok(!bytes.toString().includes('/local-kits/'),'nested local reference');assets.set(url,{file,sha256,bytes:bytes.length,contentType:{svg:'image/svg+xml',png:'image/png',webp:'image/webp'}[ext],key:'reviewed-master-media/2026-11-01/'+sha256+'.'+ext,reuse:existing.get(sha256)??null});}
  else {assert.ok(url.startsWith('https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/'),'unexpected remote source');assets.set(url,{url,sha256:approved.sha256,remote:true});}
 }
}
fs.mkdirSync(directory,{recursive:true});
const plan={sourceReview:review,approvalRecipeSha256:approval.recipeSha256,scope:Object.keys(selected).sort(),configurations:72,priorConfigurations:290,newHostedAssets:[...assets.values()].filter(a=>!a.remote&&!a.reuse).length,reusedHostedAssets:[...assets.values()].filter(a=>a.reuse).length,assets:Object.fromEntries(assets),productionDataMutated:false};
fs.writeFileSync(directory+'/upload-plan.json',JSON.stringify(plan,null,2)+'\n');console.log(JSON.stringify({configurations:72,assets:assets.size,newAssets:plan.newHostedAssets,reusedAssets:plan.reusedHostedAssets,apply:process.argv.includes('--apply')}));
if(!process.argv.includes('--apply'))process.exit(0);
const store=createBlobStore(),receipt={};
for(const [source,asset]of assets){
 const uploaded=asset.remote?{url:source,existed:true}:asset.reuse?{url:asset.reuse,existed:true}:await store.putObject(asset.key,fs.readFileSync(asset.file),asset.contentType);
 const response=await fetch(uploaded.url);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(bytes),asset.sha256,'hosted hash mismatch '+source);
 if(!asset.remote){const metadata=await verifyPublicUrl(uploaded.url,{expectedBytes:asset.bytes,expectedContentType:asset.contentType});assert.deepEqual(metadata.problems.filter(p=>!p.startsWith('content-length 0 !=')),[]);}
 receipt[source]={...asset,...uploaded,bytes:bytes.length,verified:true};fs.writeFileSync(directory+'/asset-receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log('VERIFIED '+Object.keys(receipt).length+'/'+assets.size);
}
for(const kit of Object.values(selected))for(const part of kit.parts)for(const image of [part.image,part.detached?.image].filter(Boolean)){const hosted=receipt[image.url];Object.assign(image,{url:hosted.url,sha256:hosted.sha256,bytes:hosted.bytes});if(hosted.key)image.key=hosted.key;}
const rows={...prior,...selected},version=hash(JSON.stringify(rows)).slice(0,16);
assert.equal(Object.keys(rows).length,362);
for(const [sku,kit]of Object.entries(prior))assert.deepEqual(rows[sku],kit);
fs.writeFileSync(manifestFile,JSON.stringify({...before,version,rows})+'\n');
fs.writeFileSync('src/lib/paper-doll/approved-kit-index.json',JSON.stringify({version,skus:Object.keys(rows).sort()})+'\n');
fs.writeFileSync(directory+'/release-manifest.json',JSON.stringify({version,configurations:362,addedSkus:plan.scope,preservedPriorRecipesSha256:hash(JSON.stringify(canonical(prior))),approvalRecipeSha256:approval.recipeSha256,existingRecipesPreserved:true,productionDataMutated:false},null,2)+'\n');console.log('HOSTED MANIFEST '+version);
