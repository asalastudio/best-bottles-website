import {describe,it,expect} from 'vitest';
import {applyCylinderFinalRelease} from '../scripts/asset-ledger/cylinder-final-release.mjs';
function fixture(){
 const row={sku:'exact',graceSku:'alias',productRecord:true,family:'Cylinder',productGroupId:'group',plate:{state:'plated-legacy-source',sha256:'on',imageUrl:'https://store/on',legacySource:true,masterSourceRecorded:false,sizeHold:'Earlier sizing finding remains open; regrouping is not approval'}};
 const staged={websiteSku:'exact',graceSku:'alias',productGroupId:'group',familyId:'physical',reviewBinding:'binding',plate:{sha256:'on',sourceRelPath:'original-url'},plateCapOff:{sha256:'off'},thumb:{sha256:'on'},thumbCapOff:{sha256:'off'}};
 const current={familyId:'physical',sourcePath:'original-url',views:[],image:'https://store/on',imageCapOff:'https://store/off',thumb:'https://store/on',thumbCapOff:'https://store/off'};
 const card={sku:'exact',binding:'binding',pairCheck:{passed:true},views:[{role:'on',sha256:'on'},{role:'off',sha256:'off'}]};
 const release={manifest:{rows:[staged]},lock:{reviewPacketSha256:'packet',release:'release',manifestSha256:'manifest',approvedAt:'approved-at',rows:[{sku:'exact',sourceBasis:'accepted-exact-original-legacy-raster',sourceDecision:'Jordan accepted the exact original'}]},receipt:{verifiedAt:'verified-at',deployment:'dev',assets:[{sku:'exact',view:'image',url:'https://store/on'},{sku:'exact',view:'imageCapOff',url:'https://store/off'}]}};
 const sheet={status:'approved',token:'packet',rows:[card]};
 const hash=async(url:string):Promise<string>=>url.endsWith('/on')?'on':'off';
 return {row,staged,current,release,sheet,hash};
}
async function apply(f:ReturnType<typeof fixture>){return applyCylinderFinalRelease([f.row],new Map([['exact',f.current]]),f.sheet,f.release,f.hash);}
describe('exact released Cylinder pairs',()=>{
 it('completes the approved current pair and records the accepted legacy source honestly',async()=>{
  const f=fixture();expect(await apply(f)).toMatchObject({approved:1,held:0,acceptedLegacySources:1,resolvedSizeFindings:1});
  expect(f.row.plate).toMatchObject({complete:true,checksPassed:true,masterSourceRecorded:false,legacySource:true,state:'plated-approved-legacy-source'});
  expect(f.row.plate).not.toHaveProperty('sizeHold');
  expect(f.row.plate).toHaveProperty('resolvedFindings.findings.0.finding','Earlier sizing finding remains open; regrouping is not approval');
 });
 it.each(['front','off','group','family','identity','source','extra-view','alignment','measurement','new-hold','new-review','scope-hold'])('retains a hold for %s drift',async kind=>{
  const f=fixture();
  if(kind==='front')f.row.plate.sha256='different';
  if(kind==='off')f.hash=async url=>url.endsWith('/on')?'on':'different';
  if(kind==='group')f.row.productGroupId='another';
  if(kind==='family')f.current.familyId='other-profile';
  if(kind==='identity')f.row.graceSku='different';
  if(kind==='source')f.current.sourcePath='different';
  if(kind==='extra-view')(f.current.views as unknown[]).push({url:'extra'});
  if(kind==='alignment')f.sheet.rows[0].pairCheck.passed=false;
  if(kind==='measurement')f.row.plate.state='measurement-stale';
  if(kind==='new-hold')f.row.plate.sizeHold='New sizing finding';
  if(kind==='new-review')Object.assign(f.row.plate,{review:{status:'changes_requested',updatedAt:'2027-01-01'}});
  if(kind==='scope-hold')Object.assign(f.row.plate,{scopeHold:'Identity unresolved'});
  expect(await apply(f)).toMatchObject({approved:0,held:1});expect(f.row.plate).toHaveProperty('complete',false);expect(f.row.plate).toHaveProperty('sizeHold');
 });
 it('does not apply the receipt to another review packet or an unapproved packet',async()=>{
  const f=fixture();f.sheet.token='new-packet';await expect(apply(f)).rejects.toThrow();
  f.sheet.token='packet';f.sheet.status='pending';await expect(apply(f)).rejects.toThrow();
 });
 it('does not complete an unindexed approved candidate without a release receipt',async()=>{
  const f=fixture();await applyCylinderFinalRelease([f.row],new Map([['exact',f.current]]),f.sheet,null,f.hash);expect(f.row.plate).not.toHaveProperty('complete');
 });
});
