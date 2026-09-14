import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,rename,open,unlink,realpath} from 'node:fs/promises';
import path from 'node:path';
const hash=b=>createHash('sha256').update(b).digest('hex');
const documentPath='data/asset-ledger/boston-plate-completion.json';
const feedbackPath='data/asset-ledger/boston-completion-decisions.json';
const canonical=v=>JSON.stringify(v,(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
const MASTER='/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master';
const json=async file=>JSON.parse(await readFile(file,'utf8'));
export const completionBinding=(row,presentation)=>hash(JSON.stringify({sku:row.sku,productGroupId:row.productGroupId,standardId:row.standardId,standardVersion:row.standardVersion,standardReferenceSha256:row.standardReferenceSha256,presentation,views:row.views}));
async function feedback(root){try{return await json(path.join(root,feedbackPath));}catch(e){if(e.code==='ENOENT')return {revision:0,decisions:{},history:[]};throw e;}}
export async function readCompletion(root,master=MASTER){
 let raw;try{raw=await readFile(path.join(root,documentPath));}catch(e){if(e.code==='ENOENT')return null;throw e;}
 const data=JSON.parse(raw),fb=await feedback(root),ledger=await json(path.join(root,'src/lib/asset-ledger/ledger.json'));
 const standards=await readFile(path.join(root,'data/asset-ledger/bottle-standards.json'));const standardsValid=hash(standards)===data.standardFileSha256;
 const cache=new Map();async function check(file,allowed,digest){
  const actual=await realpath(file),base=await realpath(allowed);if(!actual.startsWith(base+path.sep))throw Error('Source is outside its permitted folder.');
  if(!cache.has(actual))cache.set(actual,hash(await readFile(actual)));if(cache.get(actual)!==digest)throw Error('Image or source bytes changed. Prepare a fresh comparison.');
 }
 for(const row of data.rows){
  row.binding=completionBinding(row,data.platePresentations[row.capacityMl]);const decision=fb.decisions[row.sku+':'+row.binding];row.status=decision?.status??'pending';row.notes=decision?.notes??'';
  const currentStandard=JSON.parse(standards).standards?.find(s=>s.id===row.standardId);
  const rowStandardValid=data.standardSnapshots ? currentStandard?.state==='locked'&&canonical(currentStandard)===canonical(data.standardSnapshots[row.standardId]) : standardsValid;
  const reasons=[...row.holds];if(!rowStandardValid)reasons.push('Shared glass standard changed. Prepare this plate again.');
  const matches=ledger.rows.filter(r=>r.productRecord&&r.sku===row.sku);if(matches.length!==1||matches[0].productGroupId!==row.productGroupId||matches[0].family!==data.family||matches[0].capacityMl!==row.capacityMl||matches[0].color!==row.color)reasons.push('Catalog identity changed.');
  try{for(const v of row.views){await check(path.join(root,'public',v.url),path.join(root,'public/images/boston-plate-candidates'),v.sha256);await check(path.join(master,v.source.sourcePath),master,v.source.sourceSha256);await check(path.join(root,'public',v.source.url),path.join(root,'public/images/boston-source-recovery'),v.source.sha256);}
   for(const v of row.before)await check(path.join(root,'public',v.url),path.join(root,'public/images'),v.sha256);
  }catch(e){reasons.push(e.message);}
  row.holds=[...new Set(reasons)];row.eligible=!row.holds.length;
 }
 return {...data,revision:fb.revision,token:hash(raw),summary:{prepared:data.rows.length,reviewable:data.rows.filter(r=>r.eligible).length,held:data.rows.filter(r=>!r.eligible).length,approved:data.rows.filter(r=>r.eligible&&r.status==='approved').length,newPlates:data.rows.filter(r=>r.origin==='new-plate').length,corrections:data.rows.filter(r=>r.origin==='existing-correction').length,preserved:data.preserved.length}};
}
export function validateCompletion(sheet,input){
 if(input.token!==sheet.token||input.revision!==sheet.revision)throw Error('The sheet or its decisions changed. Reload before saving.');
 if(!Array.isArray(input.decisions)||!input.decisions.length||input.decisions.length>123)throw Error('Choose the plates to review.');
 const seen=new Set();return input.decisions.map(d=>{
  const row=sheet.rows.find(r=>r.sku===d.sku);if(seen.has(d.sku)||!row||d.binding!==row.binding)throw Error('Selected plate changed.');seen.add(d.sku);
  if(!['approved','changes_requested'].includes(d.status)||typeof d.notes!=='string'||d.notes.length>2000)throw Error('Invalid decision.');
  if(d.status==='approved'&&(!row.eligible||input.presentationAcknowledged!==true))throw Error('Review the plate framing and resolve holds before approving.');
  if(d.status==='changes_requested'&&!d.notes.trim())throw Error('Add a short note for each exception.');
  return {row,decision:d};
 });
}
export async function saveCompletion(root,input,master=MASTER){
 const lock=path.join(root,feedbackPath+'.lock');let fd;try{fd=await open(lock,'wx');}catch{throw Error('Another review is saving. Try again.');}
 try{
  const sheet=await readCompletion(root,master);if(!sheet)throw Error('No prepared plate sheet.');const selected=validateCompletion(sheet,input);const fb=await feedback(root);const at=new Date().toISOString(),batchId=randomUUID();
  for(const {row,decision}of selected){const record={sku:row.sku,binding:row.binding,status:decision.status,notes:decision.notes.trim(),at,actor:'Jordan · explicit local review action',batchId,views:row.views.map(v=>({sha256:v.sha256,label:v.label})),presentation:sheet.platePresentations[row.capacityMl],scope:'Local candidate plate and plate-presentation review. Does not replace hero locks, indexed plates, kit approval or publication.'};fb.decisions[row.sku+':'+row.binding]=record;fb.history.push(record);}
  fb.revision++;const file=path.join(root,feedbackPath),temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(fb,null,2)+'\n');await rename(temp,file);return readCompletion(root,master);
 }finally{await fd.close();await unlink(lock);}
}
