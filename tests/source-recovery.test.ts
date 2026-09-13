import {describe,it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readSourceRecovery,sourceBinding,pairBinding} from '../scripts/asset-ledger/source-recovery.mjs';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'bb-source-review-'));
 const master=path.join(root,'master');mkdirSync(master);mkdirSync(path.join(root,'public/images'),{recursive:true});mkdirSync(path.join(root,'data/asset-ledger'),{recursive:true});
 writeFileSync(path.join(master,'original.psd'),'original');writeFileSync(path.join(root,'public/images/preview.png'),'preview');
 const row={sku:'opaque-product',productGroupId:'catalog-group',candidates:[{sourcePath:'original.psd',sourceSha256:sha('original'),url:'/images/preview.png',sha256:sha('preview')}]};
 const save=()=>writeFileSync(path.join(root,'data/asset-ledger/boston-source-recovery.json'),JSON.stringify({rows:[row]}));save();
 writeFileSync(path.join(root,'data/asset-ledger/boston-source-approvals.json'),JSON.stringify({decisions:{[row.sku]:{status:'approved',binding:sourceBinding(row)}}}));
 return {root,master,row,save,close:()=>rmSync(root,{recursive:true,force:true})};
}
describe('source review remains separate and byte bound',()=>{
 it('preserves original source approval while an added capped view stays pending',async()=>{const f=fixture();try{Object.assign(f.row,{reconciledCapOn:{...f.row.candidates[0],status:'pending'}});f.save();const data=await readSourceRecovery(f.root,f.master);expect(data.sourceApproved).toBe(1);expect(data.rows[0].reconciledCapOn.status).toBe('pending');expect(data.rows[0].reconciledCapOn.bytesVerified).toBe(true);}finally{f.close();}});
 it('changing a new capped view invalidates only its pair approval',async()=>{const f=fixture();try{writeFileSync(path.join(f.root,'public/images/capped.png'),'capped');Object.assign(f.row,{pairStatus:'cap_on_review_pending',reconciledCapOn:{...f.row.candidates[0],url:'/images/capped.png',sha256:sha('capped'),status:'pending'}});f.save();writeFileSync(path.join(f.root,'data/asset-ledger/boston-source-approvals.json'),JSON.stringify({decisions:{[f.row.sku]:{status:'approved',binding:sourceBinding(f.row),pairApproval:{status:'approved',binding:pairBinding(f.row)}}}}));const good=await readSourceRecovery(f.root,f.master);expect(good.rows[0].pairStatus).toBe('paired_source_views');writeFileSync(path.join(f.root,'public/images/capped.png'),'changed');const stale=await readSourceRecovery(f.root,f.master);expect(stale.sourceApproved).toBe(1);expect(stale.rows[0].pairStatus).toBe('cap_on_review_pending');expect(stale.rows[0].reconciledCapOn.bytesVerified).toBe(false);}finally{f.close();}});
 it('does not treat a rejected decision as approval',async()=>{const f=fixture();try{writeFileSync(path.join(f.root,'data/asset-ledger/boston-source-approvals.json'),JSON.stringify({decisions:{[f.row.sku]:{status:'changes_requested',binding:sourceBinding(f.row)}}}));expect((await readSourceRecovery(f.root,f.master)).sourceApproved).toBe(0);}finally{f.close();}});
 it.each(['master','preview'])('invalidates approval when %s bytes change',async which=>{const f=fixture();try{writeFileSync(which==='master'?path.join(f.master,'original.psd'):path.join(f.root,'public/images/preview.png'),'changed');expect((await readSourceRecovery(f.root,f.master)).sourceApproved).toBe(0);}finally{f.close();}});
 it('rejects a source outside the allowed master even with matching hashes',async()=>{const f=fixture();try{writeFileSync(path.join(f.root,'outside.psd'),'original');f.row.candidates[0].sourcePath='../outside.psd';f.save();writeFileSync(path.join(f.root,'data/asset-ledger/boston-source-approvals.json'),JSON.stringify({decisions:{[f.row.sku]:{status:'approved',binding:sourceBinding(f.row)}}}));expect((await readSourceRecovery(f.root,f.master)).sourceApproved).toBe(0);}finally{f.close();}});
});
