import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawableRegisterKits } from '@/lib/register/load';
import type { RegisterStagePayload } from '@/lib/register/stage-kit';
import assets from '@/lib/register/local-tassel-assets.json';

function fixture(): RegisterStagePayload {
    const bodyId = 'circle-100ml-18-415', plateKey = `${bodyId}|Clear`;
    return {
        bodies: { [bodyId]: { bodyId, family: 'Circle', capacityMl: 100, neck: '18-415', dims: { heightBareMm: 100, diameterMm: 50, widthMm: null } } },
        plates: { [plateKey]: { bodyId, plateKey, glass: 'Clear', approved: true, url: '/fixture/body.png', width: 1000, height: 2100, pxPerMm: 20,
            anchors: { axisX: 500, seatY: 100, baselineY: 2000, shoulderY: 250 } } },
        components: Object.fromEntries(assets.map(a => [a.componentId, { componentId: a.componentId, type: 'tassel-bulb-sprayer', approved: true, layers: [
            { slot: 'sprayer', z: 'front', explodeIndex: 1, url: a.sourceUrl, width: a.sourceWidth, height: a.sourceHeight, pxPerMm: a.pxPerMm, anchor: a.anchor, approved: true },
            { slot: 'diptube', z: 'behind-body', explodeIndex: 0, url: '/fixture/tube.png', width: 30, height: 1000, pxPerMm: 12.8025, anchor: { x: 15, y: -200 }, approved: true },
        ] }])),
        assemblies: Object.fromEntries(assets.map((a, i) => [`GRACE-${i}`, { graceSku: `GRACE-${i}`, websiteSku: `WEBSITE-${i}`, bodyId, plateKey, glass: 'Clear', neck: '18-415',
            parts: [{ role: 'sprayer', componentId: a.componentId }], renderable: true, reason: null }])),
    };
}
afterEach(() => vi.unstubAllEnvs());
describe('local approved tassel imagery shared by PDP and Builder', () => {
    it('replaces all four finishes in local development without moving any part or changing the shared payload', () => {
        const payload = fixture(), untouched = structuredClone(payload);
        vi.stubEnv('NODE_ENV', 'production'); const before = drawableRegisterKits(payload);
        vi.stubEnv('NODE_ENV', 'development'); const after = drawableRegisterKits(payload);
        assets.forEach((asset, i) => {
            const old = before[`GRACE-${i}`], kit = after[`GRACE-${i}`];
            expect(kit.parts.find(p => p.slot === 'sprayer')?.image.url).toBe(asset.url);
            expect(kit.parts.map(({ image, ...geometry }) => geometry)).toEqual(old.parts.map(({ image, ...geometry }) => geometry));
            expect(kit.register).toEqual(old.register);
            expect(kit.parts.filter(p => p.slot !== 'sprayer')).toEqual(old.parts.filter(p => p.slot !== 'sprayer'));
            expect(after[`WEBSITE-${i}`]).toEqual(kit);
        });
        expect(payload).toEqual(untouched);
    });
    it('keeps production images and fails closed when a hosted asset or its dimensions change', () => {
        const payload = fixture(); vi.stubEnv('NODE_ENV', 'production');
        expect(drawableRegisterKits(payload)['GRACE-0'].parts.find(p => p.slot === 'sprayer')?.image.url).toBe(assets[0].sourceUrl);
        vi.stubEnv('NODE_ENV', 'development');
        payload.components[assets[0].componentId].layers[0].url = '/a-new-source.png';
        payload.components[assets[1].componentId].layers[0].width += 1;
        const kits = drawableRegisterKits(payload);
        expect(kits['GRACE-0'].parts.find(p => p.slot === 'sprayer')?.image.url).toBe('/a-new-source.png');
        expect(kits['GRACE-1'].parts.find(p => p.slot === 'sprayer')?.image.url).toBe(assets[1].sourceUrl);
    });
});
