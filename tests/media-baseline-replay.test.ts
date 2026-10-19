import { describe, expect, it } from 'vitest';
import { localMediaBaselineAllowed, replayMediaQuery, type MediaBaseline } from '../src/lib/register/media-baseline-replay';
const snapshot: MediaBaseline = {schemaVersion:1,family:'Empire',capturedAt:'test',source:'snapshot',queries:[],scopeSkus:['website','grace'],scopeSlugs:['empire'],scopeGroupIds:['group'],register:{assemblies:{grace:{bodyId:'approved',graceSku:'grace',websiteSku:'website',plateKey:'plate',glass:'Clear',neck:'18-415',parts:[],renderable:false,reason:'fixture'}},components:{},bodies:{},plates:{}},legacy:{website:{image:'legacy'}},plates:{website:{image:'production-image'}},lookups:{website:{product:{websiteSku:'website'}}},previews:[{groupId:'group',variants:[{websiteSku:'website'}]}]};
describe('production media snapshot replay',()=>{
 it('cannot enable on production builds or Vercel previews',()=>{expect(localMediaBaselineAllowed('production',undefined)).toBe(false);expect(localMediaBaselineAllowed('development','1')).toBe(false);expect(localMediaBaselineAllowed('development',undefined)).toBe(true);});
 it('uses captured geometry and returns detached data',()=>{const r=replayMediaQuery(snapshot,'registerStage:forSkus',{graceSkus:['grace']})!;const value=r.value as MediaBaseline['register'];expect(value.assemblies.grace!.bodyId).toBe('approved');value.assemblies.grace!.bodyId='changed';expect(snapshot.register.assemblies.grace!.bodyId).toBe('approved');});
 it('never silently combines development and production SKUs',()=>{expect(()=>replayMediaQuery(snapshot,'registerStage:forSkus',{graceSkus:['grace','unknown']})).toThrow('cannot mix');});
 it('fails closed for an absent captured family query',()=>{expect(()=>replayMediaQuery(snapshot,'products:getProductGroup',{slug:'empire'})).toThrow('Missing captured');});
 it('rejects uncaptured compatibility for captured product identities',()=>{expect(()=>replayMediaQuery(snapshot,'grace:getBottleComponents',{websiteSku:'website'})).toThrow('Missing captured');});
 it('leaves unrelated families alone',()=>{expect(replayMediaQuery(snapshot,'products:getProductGroup',{slug:'boston'})).toBeNull();});
 it('selects captured group previews for frame calculation',()=>{expect(replayMediaQuery(snapshot,'products:getCatalogGroupVariantPreviewData',{groupIds:['group']})?.value).toHaveLength(1);});
 it('replays equivalent argument ordering',()=>{const s={...snapshot,queries:[{name:'query',args:{family:'Empire',limit:2},result:{captured:true}}]};expect(replayMediaQuery(s,'query',{limit:2,family:'Empire'})?.value).toEqual({captured:true});});
});
