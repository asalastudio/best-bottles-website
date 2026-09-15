import {createHash} from 'node:crypto';
import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const sourceBinding = row => digest(JSON.stringify({sku:row.sku,productGroupId:row.productGroupId,candidates:row.candidates.map(c=>({sourcePath:c.sourcePath,sourceSha256:c.sourceSha256,url:c.url,sha256:c.sha256}))}));
export const pairBinding = row => digest(JSON.stringify({sku:row.sku,productGroupId:row.productGroupId,capOn:row.reconciledCapOn ? {sourceSha256:row.reconciledCapOn.sourceSha256,sha256:row.reconciledCapOn.sha256} : null,capOff:row.candidates.filter(c=>c.view==='off').map(c=>({sourceSha256:c.sourceSha256,sha256:c.sha256}))}));
const masterRoot='/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master';

// Source approval is separate from finished plates, kit approval and release.
// Recheck both the reviewed preview and original PSD; changed bytes stay pending.
export async function readSourceRecovery(root, master=masterRoot) {
  let data;
  try {data=JSON.parse(await readFile(path.join(root,'data/asset-ledger/boston-source-recovery.json'),'utf8'));}
  catch(error){if(error.code==='ENOENT')return null;throw error;}
  let decisions={};
  try {decisions=JSON.parse(await readFile(path.join(root,'data/asset-ledger/boston-source-approvals.json'),'utf8')).decisions;}
  catch(error){if(error.code!=='ENOENT')throw error;}
  const cache=new Map();
  async function matches(file,base,expected){
    try{
      const resolved=await realpath(file);const allowed=await realpath(base);
      if(!resolved.startsWith(allowed+path.sep))return false;
      if(!cache.has(resolved))cache.set(resolved,digest(await readFile(resolved)));
      return cache.get(resolved)===expected;
    }catch{return false;}
  }
  for(const row of data.rows){
    const decision=decisions[row.sku];row.sourceApproval=null;
    if(row.reconciledCapOn){
      const candidate=row.reconciledCapOn;
      candidate.bytesVerified=await matches(path.join(master,candidate.sourcePath),master,candidate.sourceSha256)&&await matches(path.join(root,'public',candidate.url),path.join(root,'public'),candidate.sha256);
    }
    if(!row.candidates.length||!decision||decision.status!=='approved'||decision.binding!==sourceBinding(row))continue;
    let valid=true;
    for(const candidate of row.candidates){
      if(!await matches(path.join(master,candidate.sourcePath),master,candidate.sourceSha256)||
         !await matches(path.join(root,'public',candidate.url),path.join(root,'public'),candidate.sha256))valid=false;
    }
    if(valid){
      row.sourceApproval=decision;
      if(row.reconciledCapOn?.bytesVerified && decision.pairApproval?.status==='approved' && decision.pairApproval.binding===pairBinding(row)){
        row.reconciledCapOn.status='approved';row.pairStatus='paired_source_views';
      }
    }
  }
  data.sourceApproved=data.rows.filter(r=>r.sourceApproval).length;
  return data;
}
