import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {readStandards,saveStandardDecision,localReviewRequestAllowed,lockReadiness,appearancePreview} from '../scripts/asset-ledger/standard-review.mjs';

const sourceMock=vi.hoisted(()=>({directory:''}));
vi.mock('node:fs/promises',async importOriginal=>{
 const actual=await importOriginal<typeof import('node:fs/promises')>();
 return {...actual,realpath:async(file:string)=>{
  const master='/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master';
  return actual.realpath(sourceMock.directory&&String(file).startsWith(master)?String(file).replace(master,sourceMock.directory):file);
 }};
});

const roots:string[]=[];
async function fixture(){
 const root=await mkdtemp(path.join(tmpdir(),'bb-standard-test-'));roots.push(root);
 await mkdir(path.join(root,'public/images'),{recursive:true});await mkdir(path.join(root,'data/asset-ledger'),{recursive:true});
 const bytes=await sharp({create:{width:20,height:22,channels:3,background:'#f5f3ef'}}).png().toBuffer();
 const sha256=createHash('sha256').update(bytes).digest('hex');await writeFile(path.join(root,'public/images/reference.png'),bytes);
 const standard={id:'physical-profile',version:1,state:'reference-proposed',reference:{url:'/images/reference.png',sha256},targets:{},approval:null};
 await writeFile(path.join(root,'data/asset-ledger/bottle-standards.json'),JSON.stringify({standards:[standard,{...standard,id:'sibling-size'}]}));
 return {root,standard:(await readStandards(root)).standards[0]};
}
afterEach(async()=>{sourceMock.directory='';await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
describe('local bottle-standard decisions',()=>{
 it('saves a percentage request durably without creating a height approval or changing another size',async()=>{
  const {root,standard:s}=await fixture();const before=await readStandards(root);
  await saveStandardDecision(root,{id:s.id,revisionToken:s.revisionToken,action:'request-sizing',percent:3,note:'Compare taller'});
  const after=await readStandards(root);expect(after.standards[0].sizingRequest.percent).toBe(3);expect(after.standards[0].approval).toBeNull();expect(after.standards[1]).toEqual(before.standards[1]);
 });
 it('keeps an active lock when its next size is requested',async()=>{
  const {root}=await fixture();const {document}=await readStandards(root);Object.assign(document.standards[0],{state:'locked',approval:{sha256:document.standards[0].reference.sha256},targets:{hero:{glassHeightPercent:40}}});
  await writeFile(path.join(root,'data/asset-ledger/bottle-standards.json'),JSON.stringify(document));const s=(await readStandards(root)).standards[0];
  const updated=await saveStandardDecision(root,{id:s.id,revisionToken:s.revisionToken,action:'request-sizing',percent:5,note:''});
  expect(updated.state).toBe('locked');expect(updated.approval).toEqual(s.approval);expect(updated.targets).toEqual(s.targets);expect(updated.version).toBe(1);
 });
 it('records a reference choice separately from a standard lock',async()=>{
  const {root,standard:s}=await fixture();const updated=await saveStandardDecision(root,{id:s.id,revisionToken:s.revisionToken,action:'approve-reference'});
  expect(updated.referenceDecision.sha256).toBe(s.reference.sha256);expect(updated.state).toBe('reference-proposed');expect(updated.approval).toBeNull();
 });
 it('rejects stale tabs, changed bytes and missing glass evidence',async()=>{
  const {root,standard:s}=await fixture();const input={id:s.id,revisionToken:s.revisionToken,action:'request-sizing',percent:2,note:''};
  await saveStandardDecision(root,input);await expect(saveStandardDecision(root,input)).rejects.toThrow(/changed/);
  const fresh=(await readStandards(root)).standards[0];await expect(saveStandardDecision(root,{...input,revisionToken:fresh.revisionToken,action:'lock'})).rejects.toThrow(/measurement/);
  await writeFile(path.join(root,'public/images/reference.png'),'changed');await expect(saveStandardDecision(root,{...input,revisionToken:fresh.revisionToken})).rejects.toThrow(/bytes changed/);
 });
 it('does not accept invented or out-of-range percentages',async()=>{
  const {root,standard:s}=await fixture();for(const percent of [21,-21,'3',undefined])await expect(saveStandardDecision(root,{id:s.id,revisionToken:s.revisionToken,action:'request-sizing',percent,note:''})).rejects.toThrow(/size change/);
 });
 it('keeps ambiguous taller requests without inventing an amount',async()=>{
  const {root,standard:s}=await fixture();const updated=await saveStandardDecision(root,{id:s.id,revisionToken:s.revisionToken,action:'request-sizing',percent:null,note:'A little taller'});expect(updated.sizingRequest.percent).toBeNull();
 });
 it('rejects a prepared comparison for an older request',async()=>{
  const {root,standard:s}=await fixture();expect((await lockReadiness(root,{...s,sizingRequest:{id:'new'},preparedReview:{standardVersion:1,referenceSha256:s.reference.sha256,requestId:'old'}})).ready).toBe(false);
 });
 it('rejects production and cross-origin review writes',()=>{
  const req=(origin:string)=>new Request('http://localhost:3040/api/asset-ledger/standards',{headers:{origin,'content-type':'application/json'}});
  expect(localReviewRequestAllowed(req('http://localhost:3040'),'development')).toBe(true);
  expect(localReviewRequestAllowed(req('http://localhost:3040'),'production')).toBe(false);
  expect(localReviewRequestAllowed(req('https://example.com'),'development')).toBe(false);
 });
 it('locks only a verified packet and preserves its prior version on a later revision',async()=>{
  const {root,standard:s}=await fixture();sourceMock.directory=path.join(root,'master-fixture');await mkdir(sourceMock.directory);
  const source=Buffer.from('Test-only source bytes');await writeFile(path.join(sourceMock.directory,'source.psd'),source);
  await saveStandardDecision(root,{id:s.id,revisionToken:s.revisionToken,action:'request-sizing',percent:0,note:'Keep the verified glass size'});
  let {document}=await readStandards(root);const current=document.standards[0];current.productGroupIds=['group-1'];
  current.preparedReview={requestId:current.sizingRequest.id,standardVersion:1,referenceSha256:s.reference.sha256,measurement:'full_glass',bareGlass:{...s.reference,identityVerified:true,verifiedBy:'Test fixture',verifiedAt:'2026-09-12',sourcePath:'/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master/source.psd',sourceSha256:createHash('sha256').update(source).digest('hex')},before:s.reference,after:s.reference,canvas:{width:20,height:22},glass:{rimY:10,baseY:20.02},beforeGlass:{rimY:10,baseY:20.02},baselinePercent:91,registrationVerified:true,assemblyBoundsVerified:true,scopeVerified:true,productGroupIds:['group-1']};
  const file=path.join(root,'data/asset-ledger/bottle-standards.json');await writeFile(file,JSON.stringify(document));
  current.preparedReview.kind='bare-glass-standard';current.preparedReview.referenceImage=s.reference;
  await writeFile(file,JSON.stringify(document));
  let ready=(await readStandards(root)).standards[0];expect(ready.lockReadiness.ready).toBe(true);
  expect((await lockReadiness(root,{...ready,preparedReview:{...ready.preparedReview,referenceImage:{...s.reference,sha256:'0'.repeat(64)}}})).ready).toBe(false);
  await expect(saveStandardDecision(root,{id:s.id,revisionToken:ready.revisionToken,action:'lock',packetHash:'old-packet'})).rejects.toThrow();
  const locked=await saveStandardDecision(root,{id:s.id,revisionToken:ready.revisionToken,action:'lock',packetHash:ready.lockReadiness.packetHash});expect(locked.state).toBe('locked');expect(locked.targets.hero.measurement).toBe('full_glass');expect(locked.approval.sha256).toBe(s.reference.sha256);
  expect(locked.appearancePreview.ready).toBe(true);expect(locked.appearancePreview.scale).toBe(1);
  expect((await appearancePreview(root,{...locked,targets:{hero:{...locked.targets.hero,glassHeightPercent:1}}})).ready).toBe(false);
  expect((await appearancePreview(root,{...locked,appearanceReference:{...locked.appearanceReference,sha256:'0'.repeat(64)}})).ready).toBe(false);
  expect((await appearancePreview(root,{...locked,preparedReview:{...locked.preparedReview,beforeGlass:{rimY:1,baseY:20}}})).ready).toBe(false);
  const tallerPacket={...locked.preparedReview,glass:{rimY:locked.preparedReview.glass.baseY-(20.02-10)*1.03,baseY:20.02}};
  const {digest}=await import('../scripts/asset-ledger/standard-review.mjs');
  const taller={...locked,preparedReview:tallerPacket,approval:{...locked.approval,packetHash:digest(tallerPacket)},targets:{hero:{...locked.targets.hero,glassHeightPercent:(20.02-10)*1.03/22*100}}};
  const preview=await appearancePreview(root,taller);expect(preview.ready).toBe(true);expect(preview.scale).toBeCloseTo(1.03);expect(preview.translateY!+20.02*preview.scale!).toBeCloseTo(20.02);
  expect((await appearancePreview(root,taller)).scale).toBeCloseTo(1.03);

  await saveStandardDecision(root,{id:s.id,revisionToken:locked.revisionToken,action:'request-sizing',percent:0,note:'Verify a new version'});
  ({document}=await readStandards(root));document.standards[0].preparedReview.requestId=document.standards[0].sizingRequest.id;await writeFile(file,JSON.stringify(document));
  ready=(await readStandards(root)).standards[0];const revised=await saveStandardDecision(root,{id:s.id,revisionToken:ready.revisionToken,action:'lock',packetHash:ready.lockReadiness.packetHash});expect(revised.version).toBe(2);expect(revised.priorStandards[0].approval).toEqual(locked.approval);
 });
});
