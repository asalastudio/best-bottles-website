import {describe,it,expect} from 'vitest';
import {applyPlateScope,plateIdentityFingerprint} from '../scripts/asset-ledger/plate-scope.mjs';
import {buildPlatePlan} from '../scripts/asset-ledger/plate-plan.mjs';

function fixture(){
 const identity={family:'Cylinder',productId:'physical-product',category:'Glass Bottle',capacityMl:50,color:'Clear',neckThreadSize:'18-415',applicator:'Reducer',capColor:'Silver'};
 // Deliberately ordinary SKU names: the exclusion is not based on spelling.
 const retired={...identity,_id:'old-id',websiteSku:'old',graceSku:'old-grace',productGroupId:null,importSource:'migration|product_identity_repair_v2:retired',stockStatus:'Discontinued',shopifySellable:false};
 const canonical={...identity,_id:'current-id',websiteSku:'current',graceSku:'current-grace',productGroupId:'group',importSource:'migration|product_identity_repair_v2:canonical',stockStatus:'In Stock'};
 const entry={sku:'old',canonicalSku:'current',recordSha256:plateIdentityFingerprint(retired),canonicalSha256:plateIdentityFingerprint(canonical),reviewedBy:'Jordan Richter',reviewedAt:'2026-09-13',decision:'Confirmed duplicate',evidence:'recorded-evidence.json',reason:'Retired duplicate'};
 const rows=[{sku:'old',family:'Cylinder',productRecord:true,plate:{state:'none'}},{sku:'current',family:'Cylinder',productRecord:true,productGroupId:'group',groupSlug:'canonical-product',plate:{state:'plated',imageUrl:'original-image',sha256:'approved-bytes',complete:true,checksPassed:true,approval:{status:'approved'}}}];
 return {retired,canonical,entry,rows,manifest:{version:1,entries:[entry]},products:[retired,canonical],live:new Map<string,typeof retired|typeof canonical>([['old',retired],['current',canonical]])};
}
describe('reviewed duplicate plate scope',()=>{
 it('counts the canonical plate once and preserves the duplicate and exact approval history',()=>{
  const f=fixture(),approval=JSON.stringify(f.rows[1]);
  const audit=applyPlateScope(f.rows,f.products,f.manifest,f.live);
  expect(audit).toMatchObject({held:[],unmatched:[]});expect(audit.excluded).toHaveLength(1);
  expect(f.rows).toHaveLength(2);expect(JSON.stringify(f.rows[1])).toBe(approval);expect(f.rows[0].plate.state).toBe('none');
  const plan=buildPlatePlan({rows:f.rows});expect(plan.counts).toEqual({total:1,complete:1,review:0,reconcile:0,missing:0});expect(plan.scope.excludedDuplicates).toHaveLength(1);
 });
 it('leaves an unreviewed retired-looking SKU in the queue',()=>{
  const f=fixture();f.rows[0].sku='whatever__RETIRED__';
  expect(applyPlateScope(f.rows,f.products,{version:1,entries:[]},f.live).excluded).toHaveLength(0);
  expect(buildPlatePlan({rows:f.rows}).counts.missing).toBe(1);
 });
 it.each(['reactivated','canonical missing','canonical drift','lookup failed','catalog changed','new image'])('returns %s evidence to explicit reconciliation',scenario=>{
  const f=fixture();
  if(scenario==='reactivated')f.live.set('old',{...f.retired,stockStatus:'In Stock'});
  if(scenario==='canonical missing')f.products.pop();
  if(scenario==='canonical drift')f.live.set('current',{...f.canonical,color:'Amber'});
  if(scenario==='lookup failed')f.live.delete('old');
  if(scenario==='catalog changed')f.products[0]={...f.retired,capColor:'Gold'};
  if(scenario==='new image')Object.assign(f.rows[0].plate,{imageUrl:'new-image'});
  const audit=applyPlateScope(f.rows,f.products,f.manifest,f.live);
  expect(audit.excluded).toHaveLength(0);expect(audit.held).toHaveLength(1);
  const plan=buildPlatePlan({rows:f.rows});expect(plan.counts.total).toBe(2);expect(plan.counts.reconcile).toBe(1);expect(plan.scope.excludedDuplicates).toHaveLength(0);
 });
 it('rejects a fabricated crosswalk even when its snapshots are hashed',()=>{
  const f=fixture();f.canonical.productId='different';f.entry.canonicalSha256=plateIdentityFingerprint(f.canonical);
  const audit=applyPlateScope(f.rows,f.products,f.manifest,f.live);
  expect(audit.held).toEqual([expect.objectContaining({reason:expect.stringContaining('No exact product ID or recorded alias')})]);
 });
 it('rejects exclusion chains and duplicated current records',()=>{
  const f=fixture();f.manifest.entries.push({...f.entry,sku:'current',canonicalSku:'elsewhere'});
  expect(applyPlateScope(f.rows,f.products,f.manifest,f.live).excluded).toHaveLength(0);
  const g=fixture();g.products.push({...g.canonical});expect(applyPlateScope(g.rows,g.products,g.manifest,g.live).excluded).toHaveLength(0);
 });
});
