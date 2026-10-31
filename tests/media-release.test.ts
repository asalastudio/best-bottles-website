import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import manifest from '../src/lib/media-release/manifest.json';
import recipes from '../src/lib/media-release/recipes.json';
import captured from './fixtures/media-release/approved-assemblies.json';
import { MEDIA_RELEASE_ID, releaseEntries, mediaRevision, mediaSourceUrl, builderMediaUrl, acceptsMediaRevision } from '../src/lib/media-release/release';
import { applyMediaRelease } from '../src/lib/media-release/kits';
import { mediaRevisionConflict } from '../src/lib/media-release/http';
import { drawableRegisterKits } from '../src/lib/register/load';
import { assembledKit, type RegisterStagePayload } from '../src/lib/register/stage-kit';
import { reviewedBodyImage, type CatalogRow } from '../src/lib/bottle-builder/model';
import { isRegisterAssetUrl } from '../src/lib/products/optimizable-image';
import { sourceTubeMaterialFilter } from '../src/lib/register/source-tube-material';
import { getProductHero, getCatalogHero, resolveLiveCatalogCardHero } from '../src/lib/products/catalog-heroes';

const enable = (mode = 'all') => { vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('NEXT_PUBLIC_BB_MEDIA_RELEASE', `${MEDIA_RELEASE_ID}:${mode}`); };
const empire = () => JSON.parse(fs.readFileSync('tests/fixtures/media-release/empire.json', 'utf8')) as RegisterStagePayload;
const round = () => JSON.parse(fs.readFileSync('tests/fixtures/media-release/round.json', 'utf8')) as RegisterStagePayload;
afterEach(() => vi.unstubAllEnvs());
function originalUrls(value: unknown): unknown {
    if (typeof value === 'string') return (manifest.assetMap as Record<string, string>)[value] ?? value;
    if (Array.isArray(value)) return value.map(originalUrls);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, originalUrls(v)]));
    return value;
}
describe('26-SKU media release', () => {
    it('defaults off; selects exactly 2, 14 or 26 and never held families', () => {
        vi.stubEnv('NEXT_PUBLIC_BB_MEDIA_RELEASE', ''); expect(releaseEntries()).toEqual([]);
        for (const [mode, count] of [['canary', 2], ['empire', 14], ['all', 26]] as const) {
            enable(mode); expect(releaseEntries()).toHaveLength(count);
            expect(releaseEntries().every(row => row.hero.family === 'Empire' || row.websiteSku.includes('Rnd') && row.websiteSku.includes('Spry'))).toBe(true);
        }
        vi.stubEnv('NEXT_PUBLIC_BB_MEDIA_RELEASE', 'unknown'); expect(releaseEntries()).toEqual([]);
    });
    it('replays all approved assemblies exactly, preserving detached images, materials and Builder geometry', () => {
        enable(); const all = { ...drawableRegisterKits(empire()), ...drawableRegisterKits(round()) };
        for (const row of manifest.entries) {
            const kit = all[row.websiteSku];
            expect(kit, row.websiteSku).toEqual(originalUrls(captured[row.websiteSku as keyof typeof captured]));
            expect(assembledKit(kit)?.parts.length).toBeGreaterThan(0);
            for (const part of kit.parts) for (const view of ['sidecar', 'capon', 'exploded'] as const) {
                expect(sourceTubeMaterialFilter(part.image.url, view)).toBe(sourceTubeMaterialFilter(mediaSourceUrl(part.image.url), view));
            }
            const body = kit.parts.find(part => part.slot === 'body')!;
            expect(reviewedBodyImage({ websiteSku: row.websiteSku } as CatalogRow)).toEqual({ url: body.image.url, width: body.image.width, height: body.image.height });
            for (const part of kit.parts) expect(isRegisterAssetUrl(part.image.url)).toBe(isRegisterAssetUrl(mediaSourceUrl(part.image.url)));
            const hero = getProductHero(row.websiteSku)!;
            expect(hero.url).toBe(row.hero.url);
            expect(getCatalogHero(row.hero.groupSlug, [{ websiteSku: row.websiteSku }], row.websiteSku)?.url).toBe(hero.url);
            expect(resolveLiveCatalogCardHero({ staticHero: hero, variants: [{ websiteSku: row.websiteSku }], heroImageUrl: 'https://cdn.shopify.com/old.png' }).imageUrl).toBe(hero.url);
            expect(JSON.stringify(kit)).not.toContain('/local-media/');
        }
    });
    it('rejects changed source plates, body dimensions, components and assembly identity without replacing current media', () => {
        enable(); const entry = manifest.entries.find(row => row.websiteSku === 'GBEmp100SpryMtGl')!;
        for (const mutate of [
            (p: RegisterStagePayload) => { p.plates['empire-100ml-18-415|Clear'].anchors.seatY++; },
            (p: RegisterStagePayload) => { p.bodies['empire-100ml-18-415'].dims.widthMm = 48; },
            (p: RegisterStagePayload) => { p.components[p.assemblies[entry.graceSku]!.parts[0].componentId].approved = false; },
            (p: RegisterStagePayload) => { p.assemblies[entry.graceSku]!.websiteSku = 'OTHER-SKU'; },
        ]) {
            const payload = empire(); const before = drawableRegisterKits(payload); mutate(payload);
            const result = applyMediaRelease(payload, before);
            expect(result.rejected).toContain(entry.websiteSku);
            expect(() => drawableRegisterKits(payload, { strict: true })).toThrow('source mismatch');
            expect(result.kits[entry.websiteSku]).toBe(before[entry.websiteSku]);
        }
    });
    it('leaves every out-of-scope kit unchanged and restores baseline on rollback', () => {
        vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('NEXT_PUBLIC_BB_MEDIA_RELEASE', 'off');
        const payload = empire(); const baseline = drawableRegisterKits(payload); const before = JSON.stringify(payload);
        enable(); const active = drawableRegisterKits(payload); const scope = new Set(manifest.entries.flatMap(e => [e.websiteSku, e.graceSku]));
        for (const sku of Object.keys(baseline).filter(sku => !scope.has(sku))) expect(active[sku], sku).toEqual(baseline[sku]);
        vi.stubEnv('NEXT_PUBLIC_BB_MEDIA_RELEASE', 'off'); expect(drawableRegisterKits(payload)).toEqual(baseline);
        expect(JSON.stringify(payload)).toBe(before);
        for (const dir of ['diva', 'round-lotion']) {
            const held = JSON.parse(fs.readFileSync(`tests/fixtures/media-release/${dir}.json`, 'utf8')) as RegisterStagePayload;
            const old = drawableRegisterKits(held);
            const heldSkus = Object.values(held.assemblies).flatMap(assembly => assembly ? [assembly.websiteSku] : []);
            const oldHeroes = heldSkus.map(sku => getProductHero(sku));
            enable();
            expect(drawableRegisterKits(held)).toEqual(old);
            expect(heldSkus.map(sku => getProductHero(sku))).toEqual(oldHeroes);
            vi.stubEnv('NEXT_PUBLIC_BB_MEDIA_RELEASE', 'off');
        }
    });
    it('ships only the selected assets and checks every immutable file hash', () => {
        const urls = new Set(Object.values(manifest.assetMap));
        expect(fs.readdirSync(`public/media-releases/${MEDIA_RELEASE_ID}`).length).toBe(urls.size);
        for (const url of urls) {
            const hash = createHash('sha256').update(fs.readFileSync(`public${url}`)).digest('hex');
            expect(url).toContain(hash);
        }
        expect(Object.keys(recipes).sort()).toEqual(manifest.entries.map(e => e.websiteSku).sort());
    });
    it('changes request identities and refuses stale clients during activation and rollback', () => {
        vi.stubEnv('NEXT_PUBLIC_BB_MEDIA_RELEASE', 'off'); const old = builderMediaUrl('https://example.test/api/bottle-builder/kits?family=Empire');
        enable('canary'); const canary = builderMediaUrl('https://example.test/api/bottle-builder/kits?family=Empire');
        expect(canary).not.toBe(old); expect(acceptsMediaRevision(old)).toBe(false);
        expect(mediaRevisionConflict(new Request(old))?.status).toBe(409);
        expect(mediaRevisionConflict(new Request(old))?.headers.get('Cache-Control')).toBe('no-store');
        expect(acceptsMediaRevision(canary)).toBe(true);
        enable('all'); expect(acceptsMediaRevision(canary)).toBe(false);
        const active = builderMediaUrl('https://example.test/api/bottle-builder/kits');
        vi.stubEnv('NEXT_PUBLIC_BB_MEDIA_RELEASE', 'off'); expect(acceptsMediaRevision(active)).toBe(false); expect(mediaRevision()).toBe('media-off-v1');
    });
});
