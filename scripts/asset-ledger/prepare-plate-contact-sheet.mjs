import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import {parseArgs} from 'node:util';
const {values}=parseArgs({options:{family:{type:'string',default:'Boston Round'}}});
const family=values.family,sheetPath=plateSheetFiles(family).sheet;
import {plateSheetFiles,livePlates,reviewViews} from './plate-contact-sheet.mjs';
const root=process.cwd(),ledger=JSON.parse(await readFile(path.join(root,'src/lib/asset-ledger/ledger.json'),'utf8'));
const rows=ledger.rows.filter(r=>r.productRecord&&r.family===family&&r.plate.state!=='not-applicable'&&!r.plate.scopeExclusion);
if(!rows.length)throw Error('No applicable products for this exact catalog family.');
if(rows.length!==new Set(rows.map(r=>r.sku)).size)throw Error('Duplicate catalog identities.');
const plates=await livePlates(root,[...new Set(rows.map(r=>r.plate.familyId).filter(Boolean))]);
const dir=path.join(root,'public/images/plate-contact-sheets');await mkdir(dir,{recursive:true});
const prepared=[];
for(let start=0;start<rows.length;start+=8){
 const batch=await Promise.all(rows.slice(start,start+8).map(async r=>{
  const row={sku:r.sku,graceSku:r.graceSku,productGroupId:r.productGroupId,capacityMl:r.capacityMl,color:r.color,applicator:r.applicator,capColor:r.capColor,itemName:r.itemName,groupSlug:r.groupSlug,familyId:r.plate.familyId??null,views:[],error:null};
  try{for(const v of reviewViews(plates.get(r.sku),r)){
   const url=new URL(v.sourceUrl);if(url.protocol!=='https:'||!url.hostname.endsWith('.public.blob.vercel-storage.com'))throw Error('Unrecognized asset source.');
   const response=await fetch(url,{signal:AbortSignal.timeout(30000),redirect:'error'});if(!response.ok)throw Error('Plate download failed.');
   const bytes=Buffer.from(await response.arrayBuffer()),sha256=createHash('sha256').update(bytes).digest('hex');
   const meta=await sharp(bytes).metadata();if(meta.width!==1000||meta.height!==1100||meta.format!=='webp')throw Error('Plate canvas needs reconciliation.');
   if(!row.views.length&&sha256!==r.plate.sha256)throw Error('Plate changed since measurement.');
   await writeFile(path.join(dir,sha256+'.webp'),bytes);row.views.push({...v,sha256,url:'/images/plate-contact-sheets/'+sha256+'.webp',width:meta.width,height:meta.height});
  }}catch(e){row.error=e.message;}return row;
 }));prepared.push(...batch);
}
const sheet={schemaVersion:1,id:family.toLowerCase().replaceAll(' ','-')+'-plates-'+new Date().toISOString().slice(0,10),family,createdAt:new Date().toISOString(),ledgerAt:ledger.generatedAt,scope:'Current development catalog; legacy scope remains open.',canvas:{width:1000,height:1100},rows:prepared};
await mkdir(path.dirname(path.join(root,sheetPath)),{recursive:true});
await writeFile(path.join(root,sheetPath),JSON.stringify(sheet,null,2));
console.log(JSON.stringify({rows:prepared.length,withImages:prepared.filter(r=>r.views.length).length,views:prepared.reduce((n,r)=>n+r.views.length,0),errors:prepared.filter(r=>r.error).map(r=>({sku:r.sku,error:r.error}))},null,2));
