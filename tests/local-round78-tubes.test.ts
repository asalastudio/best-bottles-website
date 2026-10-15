import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawableRegisterKits } from '../src/lib/register/load';
import { throughGlassAppearance } from '../src/lib/register/through-glass';
import source from '../src/lib/register/local-round78-tubes.json';
import { sourceTubeMaterialFilter } from '../src/lib/register/source-tube-material';

const file = process.env.BB_ROUND78_SNAPSHOT;
afterEach(() => vi.unstubAllEnvs());
it('preserves white source highlights in seated views without changing exposed lighting',()=>{
    expect(sourceTubeMaterialFilter(source.url,'sidecar')).toBeUndefined();
    expect(sourceTubeMaterialFilter(source.url,'capon')).toBeUndefined();
    expect(sourceTubeMaterialFilter(source.url,'exploded')).toBe('brightness(0.625) contrast(4)');
});
it('preserves the recovered source bytes and complete continuous tube', async () => {
    const bytes=fs.readFileSync(path.join(process.cwd(),'public',source.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);
    const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(let y=10;y<source.meaningfulBounds.bottom-1;y++) {
        let width=0;for(let x=0;x<info.width;x++) if(data[(y*info.width+x)*4+3]>16) width++;
        expect(width,`source row ${y}`).toBeGreaterThan(1);
    }
});
(file?describe:describe.skip)('Round 78 exact source batch',()=>{
    it('repairs all twelve spray assemblies while preserving body and seated hardware',()=>{
        const s=JSON.parse(fs.readFileSync(file!,'utf8'));
        vi.stubEnv('NODE_ENV','production');const before=drawableRegisterKits(s.register);
        vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');const after=drawableRegisterKits(s.register);
        const skus=source.plates.flatMap(p=>p.websiteSkus);expect(skus).toHaveLength(12);
        for(const sku of skus) {
            const old=before[sku], kit=after[sku];
            expect(kit.parts.find(p=>p.slot==='body')).toEqual(old.parts.find(p=>p.slot==='body'));
            const seated=kit.parts.find(p=>p.slot==='diptube'&&p.views?.includes('capon'))!;
            const exposed=kit.parts.find(p=>p.slot==='diptube'&&p.views?.includes('exploded'))!;
            const sprayer=kit.parts.find(p=>p.slot==='sprayer')!;
            expect(seated.image.url,sku).toBe(source.url);
            expect(exposed.image.url,sku).toBe(source.url);
            expect(seated.box.width/seated.image.width).toBeCloseTo(seated.box.height/seated.image.height,3);
            expect(Math.abs(seated.bounds.top-sprayer.bounds.bottom)).toBeLessThanOrEqual(2.1);
            expect(seated.bounds.bottom).toBeLessThan(Math.max(...seated.throughGlass!.clip.map(p=>p[1])));
            expect(exposed.exploded).toEqual(sprayer.exploded);
            expect(throughGlassAppearance(exposed,'exploded')).toBeNull();
            const stable=(parts:typeof kit.parts)=>parts.filter(p=>p.slot!=='diptube').map(({exploded,...p})=>p);
            expect(stable(kit.parts)).toEqual(stable(old.parts));
        }
        const tube=(sku:string)=>after[sku].parts.find(p=>p.slot==='diptube'&&p.views?.includes('capon'))!;
        expect(tube('GBRndFrst78SpryShnSl').throughGlass!.opacity).toBeLessThan(tube('GBRnd78SpryShnSl').throughGlass!.opacity);
    });
    it('leaves production, Vercel, changed plates and changed mechanism sources untouched',()=>{
        const s=JSON.parse(fs.readFileSync(file!,'utf8'));
        const usesSource=(data:typeof s.register)=>Object.values(drawableRegisterKits(data)).some(k=>k.parts.some(p=>p.image.url===source.url));
        vi.stubEnv('NODE_ENV','production');expect(usesSource(s.register)).toBe(false);
        vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','1');expect(usesSource(s.register)).toBe(false);
        vi.stubEnv('VERCEL','');
        for(const p of Object.values(s.register.plates) as Array<{url:string}>)p.url+='?changed';
        expect(usesSource(s.register)).toBe(false);
        const changed=JSON.parse(fs.readFileSync(file!,'utf8'));
        for(const c of source.components)changed.register.components[c.componentId].layers[0].anchor.x+=1;
        expect(usesSource(changed.register)).toBe(false);
    });
    it('ignores unrelated body layers but yields to a future Round-specific source',()=>{
        const s=JSON.parse(fs.readFileSync(file!,'utf8'));
        vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');
        for(const c of source.components)s.register.components[c.componentId].layers.push({...s.register.components[c.componentId].layers[0],bodyId:'empire-50ml-18-415'});
        expect(drawableRegisterKits(s.register).GBRnd78SpryShnSl.parts.some(p=>p.image.url===source.url)).toBe(true);
        const component=s.register.components['CMP-SPR-SHSL-18-415-06'];
        component.layers.push({...component.layers[0],bodyId:'round-78ml-18-415'});
        expect(drawableRegisterKits(s.register).GBRnd78SpryShnSl.parts.some(p=>p.image.url===source.url)).toBe(false);
    });
});
