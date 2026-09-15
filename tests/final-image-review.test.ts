import {afterEach,describe,expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {standardBinding,readFinalImage,saveFinalImageDecision} from '../scripts/asset-ledger/final-image-review.mjs';
const roots:string[]=[];
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
async function fixture(){
 const root=await mkdtemp(path.join(tmpdir(),'bb-final-review-'));roots.push(root);
 for(const dir of ['data/asset-ledger','src/lib/asset-ledger','public/images','hero-reviews/test-final/assets'])await mkdir(path.join(root,dir),{recursive:true});
 const before=await sharp({create:{width:20,height:22,channels:3,background:'#f5f3ef'}}).png().toBuffer();
 const after=await sharp({create:{width:20,height:22,channels:3,background:'#123456'}}).png().toBuffer();
 const a={url:'/images/after.png',sha256:hash(after)},b={url:'/images/before.png',sha256:hash(before)};
 await writeFile(path.join(root,'public',a.url),after);await writeFile(path.join(root,'public',b.url),before);
 await writeFile(path.join(root,'hero-reviews/test-final/assets',a.sha256+'.png'),after);
 const s={id:'standard-1',family:'Test',capacityMl:30,state:'locked',version:1,approval:{sha256:b.sha256},appearanceReference:b,targets:{hero:{canvas:{width:20,height:22},glassHeightPercent:50,baselinePercent:91}},productGroupIds:['group-1']};
 const c={standardId:s.id,standardBinding:standardBinding(s),collection:'test-final',sku:'EXACT',groupId:'group-1',before:b,after:a,verification:{passed:true,outputSha256:a.sha256,summary:'Test-only geometry evidence'}};
 const write=(file:string,data:unknown)=>writeFile(path.join(root,file),JSON.stringify(data));
 await write('data/asset-ledger/bottle-standards.json',{standards:[s]});
 await write('data/asset-ledger/final-image-candidates.json',{candidates:[c]});
 await write('src/lib/asset-ledger/ledger.json',{rows:[{sku:'EXACT',productRecord:true,family:'Test',capacityMl:30}],groupRows:[{id:'group-1',skus:['EXACT']}]});
 await write('hero-reviews/test-final/data.json',[{sku:'EXACT',assetSha256:a.sha256,standardBinding:c.standardBinding,url:'/assets/test-final/'+a.sha256+'.png'}]);
 const current=await readFinalImage(root,s);
 const input={standardId:s.id,sha256:a.sha256,reviewToken:current.reviewToken,revision:0,status:'approved',notes:''};
 return {root,s,c,input,write};
}
afterEach(async()=>{await Promise.all(roots.splice(0).map(p=>rm(p,{recursive:true,force:true})));});
describe('saved hero candidate approval',()=>{
 it('saves a byte-bound decision in the existing review library without changing the glass lock',async()=>{
  const {root,s,input}=await fixture();const before=await readFile(path.join(root,'data/asset-ledger/bottle-standards.json'),'utf8');
  expect((await readFinalImage(root,s)).status).toBe('pending');const saved=await saveFinalImageDecision(root,input);
  expect(saved.status).toBe('approved');expect(saved.revision).toBe(1);expect((await readFinalImage(root,s)).status).toBe('approved');
  expect(await readFile(path.join(root,'data/asset-ledger/bottle-standards.json'),'utf8')).toBe(before);
 });
 it('rejects a stale decision revision and keeps the saved approval',async()=>{
  const {root,input,s}=await fixture();await saveFinalImageDecision(root,input);
  await expect(saveFinalImageDecision(root,{...input,status:'changes_requested',notes:'Fix cap'})).rejects.toThrow(/another tab/);
  expect((await readFinalImage(root,s)).status).toBe('approved');
 });
 it('rejects changed public or archived image bytes',async()=>{
  const {root,input,c}=await fixture();await writeFile(path.join(root,'public',c.after.url),'tampered');
  await expect(saveFinalImageDecision(root,input)).rejects.toThrow(/bytes changed/);
  const other=await fixture();await writeFile(path.join(other.root,'hero-reviews/test-final/assets',other.c.after.sha256+'.png'),'changed');
  await expect(saveFinalImageDecision(other.root,other.input)).rejects.toThrow(/bytes changed/);
 });
 it('holds candidates when their standard or exact identity changes',async()=>{
  const {root,s,input,write}=await fixture();expect((await readFinalImage(root,{...s,version:2})).ready).toBe(false);
  await write('src/lib/asset-ledger/ledger.json',{rows:[],groupRows:[]});await expect(saveFinalImageDecision(root,input)).rejects.toThrow(/catalog product/);
 });
 it('does not inherit approval for replacement bytes and requires notes for corrections',async()=>{
  const {root,input,write,c}=await fixture();await expect(saveFinalImageDecision(root,{...input,status:'changes_requested'})).rejects.toThrow(/note/);
  await saveFinalImageDecision(root,{...input,status:'changes_requested',notes:'Check glass edge'});
  await write('data/asset-ledger/final-image-candidates.json',{candidates:[{...c,verification:{passed:false,outputSha256:c.after.sha256}}]});
  await expect(saveFinalImageDecision(root,{...input,revision:1})).rejects.toThrow(/verification/);
 });
});
