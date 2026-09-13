import {describe,it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {decisionsPath,readPlateSheet,savePlateBatch,applyPlateSheetReviews,validateBatch,plateSheetFiles,reviewViews} from '../scripts/asset-ledger/plate-contact-sheet.mjs';
const digest=(b:string)=>createHash('sha256').update(b).digest('hex');
async function fixture(family='Boston Round',count=2){
 const files=plateSheetFiles(family);
 const root=await mkdtemp(path.join(tmpdir(),'bb-plate-sheet-'));
 const front=digest('front'),off=digest('off');
 for(const d of ['public/images/plate-contact-sheets','data/asset-ledger','src/lib/asset-ledger'])await mkdir(path.join(root,d),{recursive:true});
 await writeFile(path.join(root,'public/images/plate-contact-sheets',front+'.webp'),'front');await writeFile(path.join(root,'public/images/plate-contact-sheets',off+'.webp'),'off');
 const views=[{label:'Cap on',sourceUrl:'https://test.public.blob.vercel-storage.com/front',url:'/images/plate-contact-sheets/'+front+'.webp',sha256:front},{label:'Cap off',sourceUrl:'https://test.public.blob.vercel-storage.com/off',url:'/images/plate-contact-sheets/'+off+'.webp',sha256:off}];
 const cards=Array.from({length:count},(_,i)=>i===0?'sku-a':i===1?'sku-b':'sku-'+i).map(sku=>({sku,productGroupId:'group',familyId:'family',views}));
 const rows=cards.map(r=>({sku:r.sku,productRecord:true,family,productGroupId:'group',plate:{checksPassed:true,sha256:front,imageUrl:views[0].sourceUrl},kit:{state:'candidate'},hero:{state:'indexed'}}));
 await mkdir(path.dirname(path.join(root,files.sheet)),{recursive:true});
 await writeFile(path.join(root,files.sheet),JSON.stringify({id:'test',family,rows:cards}));
 await writeFile(path.join(root,'src/lib/asset-ledger/ledger.json'),JSON.stringify({generatedAt:'now',rows}));
 const live=new Map(cards.map(r=>[r.sku,{image:views[0].sourceUrl,imageCapOff:views[1].sourceUrl,views:[]}]));
 const services={livePlates:async()=>live,remoteHash:async(url:string)=>url.endsWith('/off')?off:front};
 const input=async(scope?:'cap-on-appearance')=>{const sheet=await readPlateSheet(root,family);return {scope,family,token:sheet.token,revision:sheet.revision,decisions:sheet.rows.map((r:{sku:string;binding:string;appearanceBinding:string})=>({sku:r.sku,binding:scope?r.appearanceBinding:r.binding,status:'approved',notes:''}))};};
 return {root,rows,live,services,input,front,off};
}
describe('family plate approval',()=>{
 it('removes reviewed duplicate cards from active scope without rewriting the sheet or approvals',async()=>{
  const f=await fixture('Cylinder');try{
   await savePlateBatch(f.root,await f.input(),f.services);
   const sheetFile=path.join(f.root,plateSheetFiles('Cylinder').sheet),ledgerFile=path.join(f.root,'src/lib/asset-ledger/ledger.json');
   const sheet=JSON.parse(await readFile(sheetFile,'utf8'));
   sheet.rows.push({sku:'retired-copy',productGroupId:null,views:[]});
   await writeFile(sheetFile,JSON.stringify(sheet));
   const duplicate={sku:'retired-copy',family:'Cylinder',productRecord:true,productGroupId:null,plate:{state:'none',scopeExclusion:{status:'excluded-duplicate',canonicalSku:'sku-a'}}};
   await writeFile(ledgerFile,JSON.stringify({rows:[...f.rows,duplicate]}));
   const beforeSheet=await readFile(sheetFile,'utf8'),beforeDecisions=await readFile(path.join(f.root,plateSheetFiles('Cylinder').decisions),'utf8');
   const read=await readPlateSheet(f.root,'Cylinder');
   expect(read.rows).toHaveLength(2);expect(read.excludedDuplicates).toHaveLength(1);expect(read.rows.every((r:{status:string})=>r.status==='approved')).toBe(true);
   expect(await readFile(sheetFile,'utf8')).toBe(beforeSheet);expect(await readFile(path.join(f.root,plateSheetFiles('Cylinder').decisions),'utf8')).toBe(beforeDecisions);
   await writeFile(ledgerFile,JSON.stringify({rows:[...f.rows,{...duplicate,plate:{state:'none',scopeHold:'Identity changed'}}]}));
   const reopened=await readPlateSheet(f.root,'Cylinder');
   expect(reopened.rows).toHaveLength(3);expect(reopened.token).not.toBe(read.token);expect(reopened.rows[2].eligible).toBe(false);
  }finally{await rm(f.root,{recursive:true,force:true});}
 });
 it('records appearance approval while preserving technical and source holds',async()=>{
  const f=await fixture('Cylinder');try{
   Object.assign(f.rows[0].plate,{checksPassed:false,complete:false,state:'plated-legacy-source',sourceHold:'master mapping unresolved',sizeHold:'historical sizing'});
   await writeFile(path.join(f.root,'src/lib/asset-ledger/ledger.json'),JSON.stringify({rows:f.rows}));
   await expect(savePlateBatch(f.root,await f.input(),f.services)).rejects.toThrow(/cannot/);
   const updated=await savePlateBatch(f.root,await f.input('cap-on-appearance'),f.services);
   expect(updated.rows[0]).toMatchObject({appearanceApproved:true,eligible:false});
   const result=await applyPlateSheetReviews(f.root,f.rows,f.live,f.services.remoteHash);
   expect(result).toMatchObject({approved:0,appearanceApproved:2,appearanceHeld:0});
   expect(f.rows[0].plate).toMatchObject({checksPassed:false,complete:false,state:'plated-legacy-source',sourceHold:'master mapping unresolved',sizeHold:'historical sizing',appearanceApproval:{status:'approved',scope:'cap-on-appearance-review'}});
   expect(f.rows[0].kit).toEqual({state:'candidate'});
  }finally{await rm(f.root,{recursive:true,force:true});}
 });
 it('preserves a cap-on sign-off when cap-off changes and rejects changed cap-on bytes',async()=>{
  const f=await fixture();try{
   await savePlateBatch(f.root,await f.input(),f.services);
   await savePlateBatch(f.root,await f.input('cap-on-appearance'),f.services);
   f.live.set('sku-a',{...f.live.get('sku-a')!,imageCapOff:'https://test.public.blob.vercel-storage.com/new-off'});
   let result=await applyPlateSheetReviews(f.root,f.rows,f.live,f.services.remoteHash);
   expect(result).toMatchObject({approved:1,held:1,appearanceApproved:2,appearanceHeld:0});
   await writeFile(path.join(f.root,'src/lib/asset-ledger/ledger.json'),JSON.stringify({rows:f.rows}));
   expect((await readPlateSheet(f.root)).rows[0]).toMatchObject({eligible:false,appearanceApproved:true});
   result=await applyPlateSheetReviews(f.root,f.rows,f.live,async(url:string)=>url.endsWith('/front')?'changed':f.off);
   expect(result).toMatchObject({approved:0,appearanceApproved:0,appearanceHeld:2});
  }finally{await rm(f.root,{recursive:true,force:true});}
 });
 it('cannot approve missing or unidentified cap-on images and rejects drift before saving',async()=>{
  const f=await fixture();try{
   const input=await f.input('cap-on-appearance'),sheet=await readPlateSheet(f.root);
   sheet.rows[0].appearanceEligible=false;
   expect(()=>validateBatch(sheet,input)).toThrow(/cannot/);
   await expect(savePlateBatch(f.root,input,{...f.services,remoteHash:async()=> 'changed'})).rejects.toThrow(/bytes changed/);
   await expect(readFile(path.join(f.root,decisionsPath))).rejects.toThrow();
  }finally{await rm(f.root,{recursive:true,force:true});}
 });
 it('honors a later correction request over an earlier cap-on approval',async()=>{
  const f=await fixture();try{
   await savePlateBatch(f.root,await f.input('cap-on-appearance'),f.services);
   const input=await f.input();
   await savePlateBatch(f.root,{...input,decisions:[{...input.decisions[0],status:'changes_requested',notes:'Wrong cap'}]},f.services);
   const sheet=await readPlateSheet(f.root);expect(sheet.rows[0].appearanceApproved).toBe(false);
   const result=await applyPlateSheetReviews(f.root,f.rows,f.live,f.services.remoteHash);expect(result.appearanceApproved).toBe(1);
   const file=path.join(f.root,plateSheetFiles().sheet),revised=JSON.parse(await readFile(file,'utf8'));
   revised.rows[0].views=revised.rows[0].views.slice(0,1);await writeFile(file,JSON.stringify(revised));
   expect((await readPlateSheet(f.root)).rows[0].appearanceApproved).toBe(false);
  }finally{await rm(f.root,{recursive:true,force:true});}
 });
 it('reviews complete top swaps assembled and keeps genuine cap-off pairs',()=>{
  const plate={image:'on',imageCapOff:'off',views:[]};
  for(const applicator of ['Vintage Bulb Sprayer','Vintage Bulb Sprayer with Tassel','Dropper','Reducer','Atomizer'])expect(reviewViews(plate,{applicator})).toEqual([{label:'Cap on',sourceUrl:'on'}]);
  for(const applicator of ['Metal Roller Ball','Plastic Roller Ball','Fine Mist Sprayer'])expect(reviewViews(plate,{applicator})).toHaveLength(2);
  expect(reviewViews(plate,{sku:'invented-dropper-tassel',applicator:'N/A'})).toHaveLength(2);
 });
 it('supports a 373-plate family batch without writing Boston decisions',async()=>{
  const f=await fixture('Cylinder',373);try{
   const input=await f.input();
   await expect(savePlateBatch(f.root,{...input,family:'../Boston Round'},f.services)).rejects.toThrow(/Invalid/);
   const updated=await savePlateBatch(f.root,input,f.services);
   expect(updated.family).toBe('Cylinder');expect(updated.rows.filter((r:{status:string})=>r.status==='approved')).toHaveLength(373);
   const result=await applyPlateSheetReviews(f.root,f.rows,f.live,f.services.remoteHash);expect(result.approved).toBe(373);
   await expect(readFile(path.join(f.root,decisionsPath))).rejects.toThrow();
   expect(JSON.parse(await readFile(path.join(f.root,plateSheetFiles('Cylinder').decisions),'utf8')).history).toHaveLength(373);
  }finally{await rm(f.root,{recursive:true,force:true});}
 });
 it('saves a batch atomically and restores exact approvals into the ledger',async()=>{
  const f=await fixture();try{const updated=await savePlateBatch(f.root,await f.input(),f.services);expect(updated.rows.every((r:{status:string})=>r.status==='approved')).toBe(true);expect(updated.revision).toBe(1);
   const result=await applyPlateSheetReviews(f.root,f.rows,f.live,f.services.remoteHash);expect(result.approved).toBe(2);expect(f.rows.every(r=>(r.plate as {complete?:boolean}).complete)).toBe(true);expect(f.rows[0].kit.state).toBe('candidate');
  }finally{await rm(f.root,{recursive:true,force:true});}
 });
 it('rejects stale tabs and held rows before any decisions are written',async()=>{
  const f=await fixture();try{const input=await f.input();const sheet=await readPlateSheet(f.root);expect(()=>validateBatch(sheet,{...input,revision:99})).toThrow(/changed/);
   sheet.rows[1].eligible=false;expect(()=>validateBatch(sheet,input)).toThrow(/cannot/);expect(()=>validateBatch(sheet,{...input,decisions:[input.decisions[0],input.decisions[0]]})).toThrow(/Duplicate/);
   expect(()=>validateBatch(sheet,{...input,decisions:[{...input.decisions[0],status:'changes_requested',notes:''}]})).toThrow(/note/);
   await expect(readFile(path.join(f.root,decisionsPath))).rejects.toThrow();
  }finally{await rm(f.root,{recursive:true,force:true});}
 });
 it('rejects changed served cap-off bytes without partially approving the batch',async()=>{
  const f=await fixture();try{await expect(savePlateBatch(f.root,await f.input(),{...f.services,remoteHash:async(url:string)=>url.endsWith('/off')?'changed':f.front})).rejects.toThrow(/bytes changed/);await expect(readFile(path.join(f.root,decisionsPath))).rejects.toThrow();}finally{await rm(f.root,{recursive:true,force:true});}
 });
 it('invalidates only the plate whose views changed and preserves its sibling',async()=>{
  const f=await fixture();try{await savePlateBatch(f.root,await f.input(),f.services);f.live.set('sku-a',{...f.live.get('sku-a')!,imageCapOff:'https://test.public.blob.vercel-storage.com/new'});const result=await applyPlateSheetReviews(f.root,f.rows,f.live,f.services.remoteHash);expect(result).toMatchObject({approved:1,held:1});expect((f.rows[0].plate as {complete?:boolean}).complete).toBe(false);expect((f.rows[1].plate as {complete?:boolean}).complete).toBe(true);}finally{await rm(f.root,{recursive:true,force:true});}
 });
 it('records flagged exceptions separately and removes only their approval',async()=>{
  const f=await fixture();try{await savePlateBatch(f.root,await f.input(),f.services);const input=await f.input();await savePlateBatch(f.root,{...input,decisions:[{...input.decisions[0],status:'changes_requested',notes:'Wrong component'}]},f.services);const result=await applyPlateSheetReviews(f.root,f.rows,f.live,f.services.remoteHash);expect(result.approved).toBe(1);expect((f.rows[0].plate as {complete?:boolean}).complete).toBe(false);expect((f.rows[1].plate as {complete?:boolean}).complete).toBe(true);}finally{await rm(f.root,{recursive:true,force:true});}
 });
 it('blocks approval when local review image bytes were changed',async()=>{
  const f=await fixture();try{const input=await f.input();await writeFile(path.join(f.root,'public/images/plate-contact-sheets',f.off+'.webp'),'changed');await expect(savePlateBatch(f.root,input,f.services)).rejects.toThrow(/cannot/);}finally{await rm(f.root,{recursive:true,force:true});}
 });
});
