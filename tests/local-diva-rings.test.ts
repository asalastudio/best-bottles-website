import { afterEach, describe, expect, it, vi } from 'vitest';
import drawings from '@/lib/register/local-diva-rings.json';
import tassels from '@/lib/register/local-tassel-assets.json';
import { localDivaRingDependencies, localDivaRingPayload } from '@/lib/register/local-diva-rings';
import { drawableRegisterKits, loadRegisterKits } from '@/lib/register/load';
import type { RegisterStagePayload } from '@/lib/register/stage-kit';
import type { ConvexHttpClient } from 'convex/browser';

function aHasLocalTassel(id:string) { return tassels.some(a=>a.componentId===id); }
function fixture(): RegisterStagePayload {
    const p: RegisterStagePayload = { bodies: {}, plates: {}, components: {}, assemblies: {} };
    for (const r of drawings) {
        p.plates[r.plateKey] = r.expectedPlate;
        const a=tassels.find(a=>a.componentId===r.sprayerComponentId)!;
        p.components[r.sprayerComponentId]=r.expectedSprayer as NonNullable<RegisterStagePayload["components"][string]> ?? {componentId:r.sprayerComponentId,type:'tassel-bulb-sprayer',approved:true,
            layers:[{slot:'sprayer',url:a.sourceUrl,width:a.sourceWidth,height:a.sourceHeight,pxPerMm:a.pxPerMm,anchor:a.anchor,z:'front',explodeIndex:1,approved:true}]};
        const common={bodyId:r.bodyId,plateKey:r.plateKey,glass:'Clear',neck:'18-415'};
        p.assemblies[r.graceSku]={...common,graceSku:r.graceSku,websiteSku:r.websiteSku,parts:[],renderable:false,reason:'unresolved ring'};
        p.assemblies[r.donorGraceSku]={...common,graceSku:r.donorGraceSku,websiteSku:r.websiteSku.replace(/Rng$/,''),parts:[{role:'sprayer',componentId:r.sprayerComponentId}],renderable:true,reason:null};
    }
    return p;
}
afterEach(()=>vi.unstubAllEnvs());
describe('ten local Diva ring assemblies',()=>{
    it('adds each source ring while retaining the exact sibling glass, silver sprayer and seating',()=>{
        vi.stubEnv('NODE_ENV','development');const input=fixture(),saved=structuredClone(input),kits=drawableRegisterKits(input);
        for(const r of drawings){
            const ring=kits[r.graceSku],donor=kits[r.donorGraceSku];
            expect(ring).toBeDefined();expect(kits[r.websiteSku]).toEqual(ring);
            expect(ring.parts.find(p=>p.slot==='ring')?.image.url).toBe(r.url);
            expect(ring.parts.find(p=>p.slot==='ring')?.exploded).toEqual({dx:0,dy:0});
            expect(ring.register.seatSignature).toBe(donor.register.seatSignature);
            for(const slot of ['body','sprayer']) {
                const one=ring.parts.find(p=>p.slot===slot)!,other=donor.parts.find(p=>p.slot===slot)!;
                expect(one.box).toEqual(other.box);expect(one.image).toEqual(other.image);
            }
            if (aHasLocalTassel(r.sprayerComponentId)) expect(ring.parts.find(p=>p.slot==='sprayer')!.image.url).toMatch(/^\/local-media\/tassel-silver\//);
            expect(ring.parts.find(p=>p.slot==='ring')!.zOrder).toBeLessThan(ring.parts.find(p=>p.slot==='sprayer')!.zOrder);
        }
        expect(input).toEqual(saved);
    });
    it('leaves production and changed/future resolved source identities alone',()=>{
        const p=fixture();vi.stubEnv('NODE_ENV','production');expect(localDivaRingPayload(p)).toBe(p);
        expect(localDivaRingDependencies([drawings[0].graceSku])).toEqual([drawings[0].graceSku]);
        vi.stubEnv('NODE_ENV','development');
        for(const r of drawings.slice(4)) p.assemblies[r.graceSku]!.renderable=true;
        p.assemblies[drawings[0].graceSku]!.renderable=true;
        p.assemblies[drawings[1].graceSku]!.websiteSku='another-product';
        p.assemblies[drawings[2].donorGraceSku]!.parts[0].componentId='wrong-sprayer';
        p.assemblies[drawings[3].graceSku]!.glass='Frosted';
        expect(localDivaRingPayload(p)).toBe(p);
        const changed=fixture();changed.plates[drawings[0].plateKey]={...changed.plates[drawings[0].plateKey],url:'/changed-plate.png'};
        expect(localDivaRingPayload(changed)).toBe(changed);
    });
    it('requests sibling dependencies for a ring-only page without exceeding the 50-SKU query limit',async()=>{
        vi.stubEnv('NODE_ENV','development');const p=fixture();
        const query=vi.fn(async (_api:unknown,args:{graceSkus:string[]})=>{
            expect(args.graceSkus.length).toBeLessThanOrEqual(50);
            const assemblies=Object.fromEntries(args.graceSkus.map(s=>[s,p.assemblies[s]??null]));
            return {...p,assemblies};
        });
        const kits=await loadRegisterKits({query} as unknown as ConvexHttpClient,[...drawings.map(r=>r.graceSku),...Array.from({length:47},(_,i)=>`other-${i}`)],{strict:true});
        for(const r of drawings)expect(kits[r.graceSku]?.parts.some(p=>p.slot==='ring')).toBe(true);
        expect(query).toHaveBeenCalledTimes(2);
    });
});
