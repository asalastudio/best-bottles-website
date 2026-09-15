import {readFile,realpath,open,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import reviewStore from '../../tools/hero-review/store.cjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
export const standardBinding=s=>hash(JSON.stringify({id:s.id,version:s.version,approval:s.approval,targets:s.targets,productGroupIds:s.productGroupIds}));
const json=async file=>JSON.parse(await readFile(file,'utf8'));
async function checkedImage(root,asset){
 if(!asset?.url?.startsWith('/images/')||! /^[a-f0-9]{64}$/.test(asset.sha256??''))throw Error('A saved, hashed image is required.');
 const boundary=await realpath(path.join(root,'public/images'));
 const file=await realpath(path.join(root,'public',asset.url));
 if(!file.startsWith(boundary+path.sep))throw Error('Image must stay inside the review folder.');
 const bytes=await readFile(file);if(hash(bytes)!==asset.sha256)throw Error('Image bytes changed. Prepare a new review card.');
 return sharp(bytes).metadata();
}
export async function readFinalImage(root,s){
 let index;
 try{index=await json(path.join(root,'data/asset-ledger/final-image-candidates.json'));}catch(e){if(e.code==='ENOENT')return null;throw e;}
 const c=index.candidates.find(c=>c.standardId===s.id);if(!c)return null;
 try{
  if(s.state!=='locked'||c.standardBinding!==standardBinding(s))throw Error('The glass standard changed. Prepare a new image review.');
  if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(c.collection))throw Error('Invalid review collection.');
  const ledger=await json(path.join(root,'src/lib/asset-ledger/ledger.json'));
  const products=ledger.rows.filter(r=>r.productRecord&&r.sku===c.sku);
  const group=ledger.groupRows.find(g=>g.id===c.groupId);
  if(products.length!==1||!group?.skus.includes(c.sku)||!s.productGroupIds.includes(c.groupId)
   ||products[0].family!==s.family||products[0].capacityMl!==s.capacityMl)throw Error('Reconcile the exact catalog product before reviewing.');
  const [before,after]=await Promise.all([checkedImage(root,c.before),checkedImage(root,c.after)]);
  const target=s.targets.hero;
  if([before,after].some(m=>m.width!==target.canvas.width||m.height!==target.canvas.height))throw Error('Both saved images must match the locked canvas.');
  if(c.before.sha256!==s.appearanceReference?.sha256)throw Error('Source image differs from the approved appearance reference.');
  if(!c.verification?.passed||c.verification.outputSha256!==c.after.sha256)throw Error('The saved image still needs geometry and fidelity verification.');
  const dir=path.join(root,'hero-reviews',c.collection), rows=await json(path.join(dir,'data.json'));
  const row=rows.find(r=>r.sku===c.sku);
  if(row?.assetSha256!==c.after.sha256||row.standardBinding!==c.standardBinding)throw Error('Review card does not match this candidate.');
  const reviewBytes=await readFile(path.join(dir,'assets',path.basename(row.url)));
  if(hash(reviewBytes)!==c.after.sha256)throw Error('Review-library image bytes changed.');
  const feedback=reviewStore.read(path.join(dir,'feedback.json'));
  const decision=feedback.decisions[c.sku+':'+c.after.sha256];
  return {...c,ready:true,canvas:target.canvas,glassHeightPercent:target.glassHeightPercent,
   status:decision?.status??'pending',notes:decision?.notes??'',revision:decision?.revision??0,
   reviewToken:hash(JSON.stringify(c)),updatedAt:decision?.updatedAt};
 }catch(e){return {...c,ready:false,status:'held',reason:e.message};}
}
export async function saveFinalImageDecision(root,input){
 if(!['approved','changes_requested','rejected'].includes(input.status))throw Error('Choose Approve, Needs changes or Reject.');
 if(typeof input.notes!=='string'||input.notes.length>4000)throw Error('Use a note of at most 4,000 characters.');
 if(input.status!=='approved'&&!input.notes.trim())throw Error('Add a note explaining what needs attention.');
 const standards=await json(path.join(root,'data/asset-ledger/bottle-standards.json'));
 const s=standards.standards.find(s=>s.id===input.standardId);if(!s)throw Error('Unknown bottle standard.');
 const candidate=await readFinalImage(root,s);
 if(!candidate?.ready||candidate.reviewToken!==input.reviewToken||candidate.after.sha256!==input.sha256)throw Error(candidate?.reason??'Candidate changed. Refresh the review.');
 const dir=path.join(root,'hero-reviews',candidate.collection),lock=path.join(dir,'workbench.write-lock');
 let handle;try{handle=await open(lock,'wx');}catch{throw Error('Another decision is saving. Refresh and try again.');}
 try{
  const freshStandards=await json(path.join(root,'data/asset-ledger/bottle-standards.json'));
  const current=freshStandards.standards.find(x=>x.id===s.id);
  const fresh=await readFinalImage(root,current);
  if(!fresh?.ready||fresh.reviewToken!==input.reviewToken)throw Error('The standard or candidate changed. Refresh the review.');
  const rows=await json(path.join(dir,'data.json'));
  reviewStore.save(path.join(dir,'feedback.json'),rows,{sku:candidate.sku,assetSha256:input.sha256,status:input.status,notes:input.notes.trim(),revision:input.revision,targetHeight:null});
  return readFinalImage(root,current);
 }finally{await handle.close();await unlink(lock);}
}
