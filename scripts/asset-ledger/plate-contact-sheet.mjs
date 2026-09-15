import {readFile,writeFile,mkdir,rename,open,unlink,realpath,readdir} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {assembledPlatePresentation} from './plate-presentation.mjs';

export const sheetPath='data/asset-ledger/boston-plate-contact-sheet.json';
export const decisionsPath='data/asset-ledger/boston-plate-contact-decisions.json';
export function plateSheetFiles(family='Boston Round') {
 if(typeof family!=='string'||!family.trim()||family.length>80||!/^[A-Za-z0-9 -]+$/.test(family))throw Error('Invalid catalog family.');
 if(family==='Boston Round')return {sheet:sheetPath,decisions:decisionsPath};
 const key=family.toLowerCase().replaceAll(' ','-');
 return {sheet:`data/asset-ledger/family-plate-sheets/${key}.json`,decisions:`data/asset-ledger/family-plate-decisions/${key}.json`};
}
export async function availablePlateSheetFamilies(root) {
 const families=[];
 try{const original=await json(path.join(root,sheetPath));families.push(original.family);}catch(e){if(e.code!=='ENOENT')throw e;}
 const dir=path.join(root,'data/asset-ledger/family-plate-sheets');
 let names;try{names=await readdir(dir);}catch(e){if(e.code==='ENOENT')return families;throw e;}
 for(const name of names.filter(n=>n.endsWith('.json')).sort()){
  const sheet=await json(path.join(dir,name));
  if(path.resolve(root,plateSheetFiles(sheet.family).sheet)!==path.resolve(dir,name))throw Error('Family sheet path disagrees with its identity.');
  families.push(sheet.family);
 }
 return [...new Set(families)];
}
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=x=>createHash('sha256').update(x).digest('hex');
export const binding=row=>hash(JSON.stringify({sku:row.sku,groupId:row.productGroupId,views:row.views}));
// A cap-on sign-off survives later cap-off work, but never different cap-on bytes.
export const appearanceBinding=row=>hash(JSON.stringify({scope:'cap-on-appearance',sku:row.sku,groupId:row.productGroupId,view:row.views[0]}));
const appearanceRejected=(fb,row,appearance)=>!!appearance&&fb.history.some(d=>d.sku===row.sku&&d.sha256===row.views[0]?.sha256&&d.status==='changes_requested'&&d.updatedAt>=appearance.updatedAt);
export function indexedViews(p){
 if(!p)return [];
 const views=[{label:'Cap on',sourceUrl:p.image}];
 if(p.imageCapOff)views.push({label:'Cap off',sourceUrl:p.imageCapOff});
 for(const v of p.views??[])if(v.cap==='off'&&!views.some(x=>x.sourceUrl===v.url))views.push({label:`Cap off · ${v.view}`,sourceUrl:v.url});
 return views;
}
export function reviewViews(plate,identity) {
 const views=indexedViews(plate);
 return assembledPlatePresentation(identity)?views.filter(v=>v.label==='Cap on'):views;
}
async function feedback(root,family='Boston Round'){try{return await json(path.join(root,plateSheetFiles(family).decisions));}catch(e){if(e.code==='ENOENT')return {revision:0,decisions:{},history:[]};throw e;}}
async function localBytes(root,view){
 if(!/^\/images\/plate-contact-sheets\/[a-f0-9]{64}\.webp$/.test(view.url))throw Error('Invalid sheet image.');
 const file=await realpath(path.join(root,'public',view.url));
 const base=await realpath(path.join(root,'public/images/plate-contact-sheets'));
 if(!file.startsWith(base+path.sep)||hash(await readFile(file))!==view.sha256)throw Error('A sheet image changed. Prepare a fresh sheet.');
}
export async function remoteHash(url){
 const u=new URL(url);if(u.protocol!=='https:'||!u.hostname.endsWith('.public.blob.vercel-storage.com'))throw Error('Plate URL is outside the recorded asset store.');
 const response=await fetch(u,{signal:AbortSignal.timeout(30000),redirect:'error',cache:'no-store'});
 if(!response.ok)throw Error('Unable to verify served plate bytes.');
 return hash(Buffer.from(await response.arrayBuffer()));
}
export async function livePlates(root,familyIds){
 if(!process.env.NEXT_PUBLIC_CONVEX_URL)process.loadEnvFile(path.join(root,'.env.local'));
 const {ConvexHttpClient}=await import('convex/browser');
 const {api}=await import('../../convex/_generated/api.js');
 const c=new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL),out=new Map();
 for(const familyId of familyIds){let cursor=null;do{const p=await c.query(api.productPlates.byFamily,{familyId,cursor,limit:500});for(const r of p.page)out.set(r.websiteSku??r.sku,r);cursor=p.isDone?null:p.continueCursor;}while(cursor);}
 return out;
}
export async function readPlateSheet(root,family='Boston Round'){
 let sheet;try{sheet=await json(path.join(root,plateSheetFiles(family).sheet));}catch(e){if(e.code==='ENOENT')return null;throw e;}
 const [ledger,fb]=await Promise.all([json(path.join(root,'src/lib/asset-ledger/ledger.json')),feedback(root,family)]);
 if(sheet.family!==family)throw Error('Family sheet identity mismatch.');
 const excludedDuplicates=ledger.rows.filter(r=>r.productRecord&&r.family===family&&r.plate.scopeExclusion).map(r=>({sku:r.sku,...r.plate.scopeExclusion}));
 const excludedSkus=new Set(excludedDuplicates.map(r=>r.sku));
 const rows=await Promise.all(sheet.rows.filter(row=>!excludedSkus.has(row.sku)).map(async row=>{
  const matches=ledger.rows.filter(r=>r.productRecord&&r.sku===row.sku),current=matches[0];
  let reason='';
  if(matches.length!==1||!row.productGroupId||current.family!==sheet.family||current.productGroupId!==row.productGroupId)reason='Catalog identity changed; reconcile this row.';
  else if(row.views.length&&(current.plate.sha256!==row.views[0].sha256||current.plate.imageUrl!==row.views[0].sourceUrl))reason='The indexed plate changed; prepare a new comparison.';
  else if(!row.views.length)reason='No plate yet — source recovery needed.';
  else if(row.error)reason=row.error;
  else{try{await Promise.all(row.views.map(v=>localBytes(root,v)));}catch(e){reason=e.message;}}
  const decision=fb.decisions[row.sku+':'+binding(row)];
  const appearance=fb.decisions[row.sku+':'+appearanceBinding(row)];
  const appearanceEligible=!reason;
  const appearanceApproved=appearanceEligible&&appearance?.status==='approved'&&!appearanceRejected(fb,row,appearance)&&!current?.plate.appearanceReviewHold;
  if(!reason&&(current.plate.scopeHold||current.plate.batchReviewHold||current.plate.completionReviewHold))reason=current.plate.scopeHold||current.plate.batchReviewHold||current.plate.completionReviewHold;
  if(!reason&&!current.plate.checksPassed)reason=current.plate.sourceHold?'Source identity needs reconciliation.':current.plate.sizeHold?'Earlier sizing finding remains open.':current.plate.state==='plated-cap-on-only'?'Required cap-off view is missing.':'Source or technical checks remain open.';
  const eligible=!reason&&!!current?.plate.checksPassed;
  return {...row,eligible,appearanceEligible,appearanceApproved,appearanceBinding:appearanceBinding(row),reason,status:decision?.status??(current?.plate.complete?'approved':'pending'),notes:decision?.notes??appearance?.notes??'',binding:binding(row)};
 }));
 return {...sheet,rows,excludedDuplicates,revision:fb.revision,token:hash(JSON.stringify({sheet,excludedDuplicates})),ledgerAt:ledger.generatedAt};
}
// Validate all selected rows before the single atomic feedback write.
export function validateBatch(sheet,input){
 if(input.scope!==undefined&&input.scope!=='cap-on-appearance')throw Error('Invalid review scope.');
 const appearanceOnly=input.scope==='cap-on-appearance';
 if(input.token!==sheet.token||input.revision!==sheet.revision)throw Error('This sheet or its decisions changed. Reload before saving.');
 if(!Array.isArray(input.decisions)||!input.decisions.length||input.decisions.length>1000)throw Error('Select at least one plate.');
 const seen=new Set();
 return input.decisions.map(d=>{
  if(seen.has(d.sku))throw Error('Duplicate plate in this batch.');seen.add(d.sku);
  const row=sheet.rows.find(r=>r.sku===d.sku);
  if(!row||(appearanceOnly?row.appearanceBinding:row.binding)!==d.binding)throw Error('A selected plate changed. Reload the sheet.');
  if(!['approved','changes_requested'].includes(d.status)||typeof d.notes!=='string'||d.notes.length>2000)throw Error('Invalid plate decision.');
  if(appearanceOnly&&(d.status!=='approved'||!row.appearanceEligible))throw Error('Missing, changed or unidentified images cannot receive appearance approval.');
  if(!appearanceOnly&&d.status==='approved'&&!row.eligible)throw Error('Held or missing plates cannot be batch-approved.');
  if(d.status==='changes_requested'&&!d.notes.trim())throw Error('Add a short note for each exception.');
  return {row,decision:d};
 });
}
export async function savePlateBatch(root,input,services={}){
 const family=input.family??'Boston Round',files=plateSheetFiles(family);
 const appearanceOnly=input.scope==='cap-on-appearance';
 await mkdir(path.dirname(path.join(root,files.decisions)),{recursive:true});
 const lock=path.join(root,files.decisions+'.lock');let handle;
 try{handle=await open(lock,'wx');}catch{throw Error('Another batch is saving. Reload and try again.');}
 try{
  const sheet=await readPlateSheet(root,family);if(!sheet)throw Error('Prepare the contact sheet first.');
  const selected=validateBatch(sheet,input);
  const approvals=selected.filter(x=>x.decision.status==='approved');
  const live=approvals.length?await (services.livePlates??livePlates)(root,[...new Set(approvals.map(x=>x.row.familyId))]):new Map();
  for(const {row} of approvals){
   const current=live.get(row.sku);
   const views=appearanceOnly?row.views.slice(0,1):row.views;
   const currentViews=appearanceOnly?reviewViews(current,row).slice(0,1):reviewViews(current,row);
   if(JSON.stringify(currentViews)!==JSON.stringify(views.map(({label,sourceUrl})=>({label,sourceUrl}))))throw Error('The live plate or cap-off view changed. Refresh the family sheet.');
   await Promise.all(views.map(async v=>{if(await (services.remoteHash??remoteHash)(v.sourceUrl)!==v.sha256)throw Error('Served image bytes changed. Prepare a new review.');}));
  }
  // Recheck local evidence after network checks so a newer ledger cannot be bypassed.
  const fresh=await readPlateSheet(root,family);validateBatch(fresh,input);
  const fb=await feedback(root,family),at=new Date().toISOString(),batchId=randomUUID();
  for(const {row,decision:d} of selected){const entry={sku:row.sku,binding:appearanceOnly?row.appearanceBinding:row.binding,sha256:row.views[0]?.sha256??null,status:d.status,notes:d.notes.trim(),updatedAt:at,batchId,scope:appearanceOnly?'cap-on-appearance-review':'existing-plate-visual-review',views:appearanceOnly?row.views.slice(0,1):row.views};fb.decisions[row.sku+':'+entry.binding]=entry;fb.history.push(entry);}
  fb.revision++;const file=path.join(root,files.decisions),temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(fb,null,2));await rename(temp,file);
  return readPlateSheet(root,family);
 }finally{await handle.close();await unlink(lock);}
}

// The ledger consumes only exact current-view approvals, never a family-wide boolean.
async function applyOnePlateSheetReviews(root,rows,plateIndex,hashRemote,family){
 let sheet;try{sheet=await json(path.join(root,plateSheetFiles(family).sheet));}catch(e){if(e.code==='ENOENT')return {approved:0,held:0};throw e;}
 const fb=await feedback(root,family);let approved=0,held=0,appearanceApproved=0,appearanceHeld=0;
 for(const row of rows){const card=sheet.rows.find(r=>r.sku===row.sku);if(!card)continue;const d=fb.decisions[row.sku+':'+binding(card)];
  const appearance=fb.decisions[row.sku+':'+appearanceBinding(card)];
  if(appearance?.status==='approved'&&!appearanceRejected(fb,card,appearance)){
   try{
    const front=card.views[0],current=plateIndex.get(row.sku);
    if(!row.productRecord||row.family!==family||!card.productGroupId||card.productGroupId!==row.productGroupId||!front||appearance.sha256!==row.plate.sha256||current?.image!==front.sourceUrl)throw Error('Current cap-on plate no longer matches review.');
    await localBytes(root,front);if(await hashRemote(current.image)!==front.sha256)throw Error('Cap-on bytes changed.');
    row.plate.appearanceApproval={...appearance,collection:sheet.id};delete row.plate.appearanceReviewHold;appearanceApproved++;
   }catch{row.plate.appearanceApproval=null;row.plate.appearanceReviewHold='The cap-on appearance approval no longer matches current image evidence.';appearanceHeld++;}
  }
  if(!d)continue;
  const review={...d,collection:sheet.id};row.plate.review=review;
  if(d.status!=='approved'){row.plate.approval=null;row.plate.complete=false;continue;}
  try{
   if(!row.plate.checksPassed||card.productGroupId!==row.productGroupId||d.sha256!==row.plate.sha256||JSON.stringify(reviewViews(plateIndex.get(row.sku),row))!==JSON.stringify(card.views.map(({label,sourceUrl})=>({label,sourceUrl}))))throw Error('Current plate no longer matches review.');
   for(const v of card.views){await localBytes(root,v);if(await hashRemote(v.sourceUrl)!==v.sha256)throw Error('Served view bytes changed.');}
   row.plate.approval=review;row.plate.complete=true;delete row.plate.batchReviewHold;approved++;
  }catch{row.plate.approval=null;row.plate.complete=false;row.plate.batchReviewHold='The sheet approval no longer matches current plate evidence.';held++;}
 }
 return {approved,held,appearanceApproved,appearanceHeld,revision:fb.revision};
}

export async function applyPlateSheetReviews(root,rows,plateIndex,hashRemote=remoteHash){
 const totals={approved:0,held:0,appearanceApproved:0,appearanceHeld:0,families:[]};
 const checked=new Map();
 const hashOnce=url=>{if(!checked.has(url))checked.set(url,hashRemote(url));return checked.get(url);};
 for(const family of await availablePlateSheetFamilies(root)){
  const result=await applyOnePlateSheetReviews(root,rows,plateIndex,hashOnce,family);
  totals.approved+=result.approved;totals.held+=result.held;totals.appearanceApproved+=result.appearanceApproved??0;totals.appearanceHeld+=result.appearanceHeld??0;totals.families.push({family,...result});
 }
 return totals;
}
