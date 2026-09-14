import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateFourFamilyDecision,readFourFamilyPlates,saveFourFamilyPlates} from './four-family-plates.mjs';

const ID='four-family-plates-2026-09-13',sha=x=>createHash('sha256').update(x).digest('hex');
const eligible={sku:'verified-catalog-sku',recordId:'record-1',productGroupId:'group-1',familyId:'physical-1',family:'Elegant',status:'ready',binding:'binding-1',views:[{role:'on',url:'/image.webp',sha256:'image-hash'}]};
const sheet={draft:false,token:'current-token',revision:2,rows:[eligible,{...eligible,sku:'held',status:'hold'},{...eligible,sku:'preserved',status:'preserved'}]};
const input={token:'current-token',revision:2,visualApproved:true,duplicatesConfirmed:false,exceptions:{}};

test('only eligible exact bytes receive approval; preserved and held rows are untouched',()=>{
 const entries=validateFourFamilyDecision(sheet,input);assert.equal(entries.length,1);assert.deepEqual(entries[0].views,eligible.views);assert.equal(entries[0].publicationAuthorized,false);
});
test('drafts, stale packets, stale decisions, absent visual review and invalid exceptions fail closed',()=>{
 for(const [s,i] of [[{...sheet,draft:true},input],[sheet,{...input,token:'old'}],[sheet,{...input,revision:1}],[sheet,{...input,visualApproved:false}],[sheet,{...input,exceptions:{held:'bad'}}],[sheet,{...input,exceptions:{[eligible.sku]:''}}],[sheet,{...input,exceptions:{[eligible.sku]:'all flagged'}}]])assert.throws(()=>validateFourFamilyDecision(s,i));
});
test('a flagged plate is saved as changes requested without approving its bytes',()=>{
 const entries=validateFourFamilyDecision({...sheet,rows:[eligible,{...eligible,sku:'second'}]}, {...input,exceptions:{second:'Closure alignment'}});
 assert.equal(entries[1].status,'changes_requested');assert.equal(entries[1].publicationAuthorized,false);
});

async function fixture(t){
 const root=await mkdtemp(path.join(tmpdir(),'four-family-test-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const master=path.join(root,'master');const image=Buffer.from('immutable plate fixture');const source=Buffer.from('master source fixture');
 const url=`/images/${ID}/${sha(image)}.webp`,sourcePath='original.psd';
 const row={...eligible,inCatalog:true,referenceSha256:null,before:[],sources:[{kind:'master-psd',sourcePath,sourceSha256:sha(source)}],technicalHolds:[],legacyEvidence:[],views:[{role:'on',url,sha256:sha(image)}]};
 const packet={schemaVersion:1,id:ID,draft:false,publicationAuthorized:false,rows:[row]};
 for(const [name,data] of [[`docs/reviews/${ID}/prepared.json`,JSON.stringify(packet)],['src/lib/asset-ledger/ledger.json',JSON.stringify({rows:[{...row,productRecord:true,plate:{sha256:null}}]})],[`public${url}`,image],[`master/${sourcePath}`,source]]){
  const p=path.join(root,name);await mkdir(path.dirname(p),{recursive:true});await writeFile(p,data);
 }
 const services={master,catalog:async()=>({products:[{...row,_id:row.recordId,websiteSku:row.sku}]}),plates:async()=>new Map()};
 return {root,master,row,services,sourceFile:path.join(master,sourcePath),imageFile:path.join(root,'public',url)};
}
test('source or image byte drift invalidates a prepared review',async t=>{
 const f=await fixture(t);await readFourFamilyPlates(f.root,f.services);await writeFile(f.sourceFile,'changed source');
 await assert.rejects(readFourFamilyPlates(f.root,f.services),/bytes changed/);
});
test('a source symlink escaping the master is rejected',async t=>{
 const f=await fixture(t);const external=path.join(f.root,'external.psd');await writeFile(external,await readFile(f.sourceFile));await rm(f.sourceFile);await symlink(external,f.sourceFile);
 await assert.rejects(readFourFamilyPlates(f.root,f.services),/boundary/);
});
test('approval revalidates live identity and never invokes a publisher',async t=>{
 const f=await fixture(t);const current=await readFourFamilyPlates(f.root,f.services);const decision={...input,token:current.token,revision:0};
 await assert.rejects(saveFourFamilyPlates(f.root,decision,{...f.services,catalog:async()=>({products:[{...f.row,_id:'changed',websiteSku:f.row.sku}]})}),/Live catalog identity changed/);
 const saved=await saveFourFamilyPlates(f.root,decision,f.services);assert.equal(saved.approvedCount,1);assert.equal(saved.revision,1);
 const record=JSON.parse(await readFile(path.join(f.root,`data/asset-ledger/${ID}-decisions.json`),'utf8'));
 assert.equal(record.history[0].publicationAuthorized,false);assert.equal(record.history[0].entries[0].views[0].sha256,f.row.views[0].sha256);
 await assert.rejects(saveFourFamilyPlates(f.root,decision,f.services),/review changed/);
});
test('a changed live reference cannot inherit the old comparison approval',async t=>{
 const f=await fixture(t);const current=await readFourFamilyPlates(f.root,f.services);
 await assert.rejects(saveFourFamilyPlates(f.root,{...input,token:current.token,revision:0},{...f.services,plates:async()=>new Map([[f.row.sku,{image:'https://example.test/new.webp'}]])}),/Live reference changed/);
});
