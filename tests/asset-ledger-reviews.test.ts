import {describe,it,expect} from 'vitest';
import {currentReview,readReviews} from '../scripts/asset-ledger/reviews.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
const card=(hash:string,date:string,approved=false)=>({collection:date,createdAt:date,sha256:hash,bytesVerified:true,decisions:approved?[{status:'approved',sha256:hash,updatedAt:date}]:[]});
describe('byte-bound asset reviews',()=>{
 it('new bytes return to review even after approval',()=>expect(currentReview([card('old','2026-09-01',true),card('new','2026-09-02')]).status).toBe('pending'));
 it('preserves approval when exact bytes recur',()=>expect(currentReview([card('same','2026-09-01',true),card('same','2026-09-02')]).status).toBe('approved'));
 it('missing or changed current bytes cannot inherit a decision',()=>expect(currentReview([{...card('same','2026-09-02',true),bytesVerified:false}]).status).toBe('evidence-missing'));
 it('the latest decision for the same bytes wins',()=>expect(currentReview([card('same','2026-09-01',true),{...card('same','2026-09-02'),decisions:[{status:'changes_requested',sha256:'same',updatedAt:'2026-09-03'}]}]).status).toBe('changes_requested'));
 it('routes plate approvals only to plates and quarantines unknown collections',()=>{
  const root=mkdtempSync(path.join(tmpdir(),'bb-review-'));const id='misleading-hero-name';const dir=path.join(root,id);mkdirSync(path.join(dir,'assets'),{recursive:true});
  const bytes=Buffer.from('fixture bytes'),sha=createHash('sha256').update(bytes).digest('hex');
  writeFileSync(path.join(dir,'assets','image.png'),bytes);writeFileSync(path.join(dir,'collection.json'),JSON.stringify({title:'Exact plates',createdAt:'2026-09-01'}));writeFileSync(path.join(dir,'data.json'),JSON.stringify([{sku:'opaque-id',url:'/assets/image.png',assetSha256:sha}]));writeFileSync(path.join(dir,'feedback.json'),JSON.stringify({decisions:{x:{sku:'opaque-id',assetSha256:sha,status:'approved'}}}));
  try{
   const result=readReviews([root],{[id]:{kind:'plate',title:'Exact plates'}});expect(result.review.hero.size).toBe(0);expect(result.review.plate.get('opaque-id').status).toBe('approved');
   expect(readReviews([root],{}).audit.unclassified).toHaveLength(1);
   expect(readReviews([root],{[id]:{kind:'plate',title:'Exact plates',supersededBy:'new'}}).review.plate.size).toBe(0);
   writeFileSync(path.join(dir,'assets','image.png'),'changed');expect(readReviews([root],{[id]:{kind:'plate',title:'Exact plates'}}).review.plate.get('opaque-id').status).toBe('evidence-missing');
  }finally{rmSync(root,{recursive:true,force:true});}
 });
});
