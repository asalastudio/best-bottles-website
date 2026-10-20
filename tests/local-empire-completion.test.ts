import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawableRegisterKits } from '../src/lib/register/load';
import { localEmpireWhitePumpPayload } from '../src/lib/register/local-empire-white-pump';
import candidate from '../src/lib/register/local-empire-100ml-white-pump.json';
import tube from '../src/lib/register/local-empire-100ml-white-pump-tube.json';
import tubes from '../src/lib/register/local-empire-additional-spray-tubes.json';
import { stageLayout } from '../src/lib/products/pdp-redesign/stage';
const file = process.env.BB_MEDIA_REVIEW_SNAPSHOT;
afterEach(() => vi.unstubAllEnvs());
(file ? describe : describe.skip)('Empire remaining source completion', () => {
    const snapshot = () => JSON.parse(fs.readFileSync(file!, 'utf8'));
    it('covers the ten remaining spray finishes exactly once', () => {
        const skus = tubes.filter(t => !t.websiteSku.endsWith('MtGl')).map(t => t.websiteSku);
        expect(new Set(skus).size).toBe(10);
        for (const size of [50, 100]) for (const finish of ['MtSl', 'ShnGl', 'ShnSl', 'ShnBlk', 'Cu']) {
            expect(skus).toContain(`GBEmp${size}Spry${finish}`);
        }
    });
    it('joins the 100 ml white tube to the pump and moves both together', () => {
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
        const s = snapshot(); const kit = drawableRegisterKits(s.register)[candidate.websiteSku];
        const pump = kit.parts.find(p => p.slot === 'pump')!;
        const native = kit.parts.filter(p => p.slot === 'diptube');
        expect(native).toHaveLength(2);
        for (const p of native) {
            expect(p.image.url).toBe(tube.url);
            expect(p.bounds.top).toBeCloseTo(pump.box.y + pump.box.height * tube.visibleBottomFraction - 2, 2);
            expect(p.bounds.bottom).toBeLessThan(kit.anchors.baselineY);
            expect(p.componentId).toBe(pump.componentId);
            expect(p.explodeIndex).toBe(pump.explodeIndex);
        }
        expect(kit.parts.find(p => p.slot === 'overcap')?.detached?.image.url).toContain('empty-overcap');
        const row = s.matrix.rows.find((r: any) => r.websiteSku === candidate.websiteSku);
        const exploded = stageLayout(kit, 'exploded', row)!;
        expect(exploded.parts.find(p => p.slot === 'diptube')?.dyPct).toBe(exploded.parts.find(p => p.slot === 'pump')?.dyPct);
        expect(native.find(p => p.views?.includes('capon'))?.throughGlass).toBeDefined();
        expect(native.find(p => p.views?.includes('exploded'))?.throughGlass).toBeUndefined();
    });
    it('does not replace a released white assembly or a changed plate', () => {
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
        for (const mutate of [
            (p: any) => { p.assemblies[candidate.graceSku].renderable = true; },
            (p: any) => { p.assemblies[candidate.graceSku].parts = [{ role: 'pump', componentId: 'new-source' }]; },
            (p: any) => { p.plates[candidate.expectedAssembly.plateKey].anchors.seatY++; },
            (p: any) => { p.plates[candidate.expectedAssembly.plateKey].url += '?changed'; },
        ]) {
            const payload = snapshot().register; mutate(payload);
            expect(localEmpireWhitePumpPayload(payload).assemblies[candidate.graceSku]).toBe(payload.assemblies[candidate.graceSku]);
        }
        for (const [env, vercel] of [['production', ''], ['development', '1']]) {
            vi.stubEnv('NODE_ENV', env); vi.stubEnv('VERCEL', vercel);
            const payload = snapshot().register;
            expect(localEmpireWhitePumpPayload(payload)).toBe(payload);
        }
    });
});
