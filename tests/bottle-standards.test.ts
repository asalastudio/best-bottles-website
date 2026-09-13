import {describe,it,expect} from 'vitest';
import {resolveBottleStandard,planGlassNormalization} from '../scripts/asset-ledger/bottle-standards.mjs';
const standard={id:'opaque-standard',family:'Boston Round',capacityMl:15,neckFinishes:['18-400'],productGroupIds:['clear-cap','amber-dropper','blue-cap'],version:1,state:'locked',reference:{sha256:'approved-bytes'},approval:{sha256:'approved-bytes'},targets:{hero:{measurement:'full_glass',glassHeightPercent:40,baselinePercent:91}}};
const input={assetKind:'hero',standardVersion:1,canvas:{width:1000,height:1100},glass:{baseY:1000,rimY:500,centerX:400},assemblyBounds:{left:250,right:550,top:300,bottom:1000}};
describe('persistent physical bottle standard',()=>{
 it('shares one standard across explicit colors and closures',()=>{for(const id of standard.productGroupIds)expect(resolveBottleStandard([standard],{family:'Boston Round',capacityMl:15,neckThreadSize:'18-400',productGroupId:id})).toBe(standard);});
 it('never guesses another profile from SKU spelling',()=>expect(()=>resolveBottleStandard([standard],{websiteSku:'GBBoston15',family:'Boston Round',capacityMl:15,neckThreadSize:'18-400',productGroupId:'different-profile'})).toThrow(/identity/));
 it('rejects mismatching catalog capacity',()=>expect(()=>resolveBottleStandard([standard],{family:'Boston Round',capacityMl:30,neckThreadSize:'18-400',productGroupId:'clear-cap'})).toThrow(/disagree/));
 it('new fitments preserve glass scale and baseline',()=>{const before=JSON.stringify(standard);const a=planGlassNormalization(standard,input);const b=planGlassNormalization(standard,{...input,assemblyBounds:{...input.assemblyBounds,top:150}});expect(a.scale).toBe(b.scale);expect(a.translateY+input.glass.baseY*a.scale).toBeCloseTo(1001);expect(JSON.stringify(standard)).toBe(before);expect(b.needsImageReview).toBe(true);});
 it('refuses an unconfirmed standard or a stale version',()=>{expect(()=>planGlassNormalization({...standard,state:'reference-proposed'},input)).toThrow(/not locked/);expect(()=>planGlassNormalization(standard,{...input,standardVersion:2})).toThrow(/Stale/);});
 it('never silently shrinks the bottle to fit a tall closure',()=>expect(()=>planGlassNormalization(standard,{...input,assemblyBounds:{...input.assemblyBounds,top:-1000}})).toThrow(/clip/));
 it('will not reinterpret fitment height as glass height',()=>expect(()=>planGlassNormalization({...standard,targets:{hero:{...standard.targets.hero,measurement:'bottle_with_fitment'}}},input)).toThrow(/full-glass/));
});
