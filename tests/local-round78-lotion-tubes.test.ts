import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawableRegisterKits } from '../src/lib/register/load';
import { sourceTubeMaterialFilter } from '../src/lib/register/source-tube-material';
import source from '../src/lib/register/local-round78-lotion-tubes.json';
import { localRound78Tubes } from '../src/lib/register/local-round78-tubes';

const file = process.env.BB_ROUND78_LOTION_SNAPSHOT;
afterEach(() => vi.unstubAllEnvs());
it('preserves the complete original hollow tube and its seated white highlights', async () => {
    const bytes = fs.readFileSync(path.join(process.cwd(), 'public', source.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let y = 10; y < source.height - 2; y++) {
        let ink = 0;
        for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 16) ink++;
        expect(ink, `physical tube row ${y}`).toBeGreaterThan(1);
    }
    expect(sourceTubeMaterialFilter(source.url, 'sidecar')).toBeUndefined();
    expect(sourceTubeMaterialFilter(source.url, 'capon')).toBeUndefined();
    expect(sourceTubeMaterialFilter(source.url, 'exploded')).toBe('brightness(0.625) contrast(4)');
});
(file ? describe : describe.skip)('Round 78 lotion exact source batch', () => {
    it('repairs fourteen exact combinations with a connected, uniformly scaled tube above the inner floor', () => {
        const s = JSON.parse(fs.readFileSync(file!, 'utf8'));
        vi.stubEnv('NODE_ENV', 'production'); const before = drawableRegisterKits(s.register);
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
        // Exercise this applicator before independent copper-cap alpha cleanup.
        const after = Object.fromEntries(Object.entries(before).map(([key,kit]) => [key, localRound78Tubes(kit,s.register.plates[kit.register.plateKey],s.register.components)]));
        const skus = source.plates.flatMap(p => p.websiteSkus); expect(skus).toHaveLength(14);
        for (const sku of skus) {
            const old = before[sku], kit = after[sku];
            expect(kit.parts.find(p => p.slot === 'body')).toEqual(old.parts.find(p => p.slot === 'body'));
            const seated = kit.parts.find(p => p.slot === 'diptube' && p.views?.includes('capon'))!;
            const exposed = kit.parts.find(p => p.slot === 'diptube' && p.views?.includes('exploded'))!;
            const pump = kit.parts.find(p => p.slot === 'pump')!;
            expect(seated.image.url, sku).toBe(source.url);
            expect(exposed.image.url, sku).toBe(source.url);
            expect(seated.box.width / source.width).toBeCloseTo(seated.box.height / source.height, 3);
            const pumpLayer = source.components.find(c => c.componentId === pump.componentId)!.layers.find(p => p.slot === 'pump')!;
            const solidBottom = pump.box.y + pumpLayer.solidBottomY * pump.box.height / pumpLayer.height;
            // The visible native head starts at row 6. Rows above it carry only
            // isolated faint specks, so they cannot establish a physical join.
            const visibleHead = seated.box.y + 6 * seated.box.height / source.height;
            expect(visibleHead, `${sku} visible pump-to-tube join`).toBeLessThanOrEqual(solidBottom);
            expect(solidBottom - visibleHead).toBeLessThanOrEqual(3);
            expect(seated.bounds.bottom).toBeLessThan(Math.max(...seated.throughGlass!.clip.map(p => p[1])));
            expect(exposed.exploded).toEqual(pump.exploded);
            expect(exposed.throughGlass).toBeUndefined();
            const stable = (parts: typeof kit.parts) => parts.filter(p => p.slot !== 'diptube').map(({ exploded, ...p }) => { void exploded; return p; });
            expect(stable(kit.parts)).toEqual(stable(old.parts));
        }
    });
    it('does not apply in production, Vercel, changed plates or a changed pump source', () => {
        const s = JSON.parse(fs.readFileSync(file!, 'utf8'));
        const changed = () => Object.values(drawableRegisterKits(s.register)).some(k => k.parts.some(p => p.image.url === source.url));
        vi.stubEnv('NODE_ENV', 'production'); expect(changed()).toBe(false);
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '1'); expect(changed()).toBe(false);
        vi.stubEnv('VERCEL', '');
        for (const c of source.components) s.register.components[c.componentId].layers[0].anchor.x++;
        expect(changed()).toBe(false);
        const fresh = JSON.parse(fs.readFileSync(file!, 'utf8'));
        for (const p of source.plates) fresh.register.plates[p.expectedPlate.plateKey].url += '?changed';
        expect(Object.values(drawableRegisterKits(fresh.register)).some(k => k.parts.some(p => p.image.url === source.url))).toBe(false);
    });
});
