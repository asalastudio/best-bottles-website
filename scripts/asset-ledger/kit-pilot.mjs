import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const master='/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function readKitPilot(root, group, plates) {
 let data;try{data=JSON.parse(await readFile(path.join(root,'data/asset-ledger/boston-kit-pilot.json'),'utf8'));}catch{return {kits:{},plates};}
 if(hash(await readFile(path.join(root,'data/asset-ledger/bottle-standards.json')))!==data.glassStandardsSha256)return {kits:{},plates};
 const kits={},next={...plates};
 for(const row of Object.values(data.rows)){
  if(row.groupSlug!==group?.slug || (plates[row.sku]??plates[row.graceSku])?.image!==row.expectedPlateUrl)continue;
  try{
   for(const source of Object.values(row.sources))if(hash(await readFile(path.join(master,source.path)))!==source.sha256)throw Error('Source changed');
   for(const state of ['on','off'])for(const asset of [...row[state].parts.map(p=>p.image),row.checks[state].fallback])if(hash(await readFile(path.join(root,'public',asset.url)))!==asset.sha256)throw Error('Kit bytes changed');
   kits[row.sku]={sku:row.sku,groupSlug:row.groupSlug,on:row.on,off:row.off};
   const plate={image:row.checks.on.fallback.url,imageCapOff:row.checks.off.fallback.url,localCandidate:true,reviewStatus:'kit-pilot'};
   next[row.sku]=plate;next[row.graceSku]=plate;
  }catch(error){console.warn('Local kit pilot held:',row.sku,error.message);}
 }
 return {kits,plates:next};
}
