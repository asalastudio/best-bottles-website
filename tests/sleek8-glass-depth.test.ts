import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import manifest from '@/lib/paper-doll/approved-kits.generated.json';
import index from '@/lib/paper-doll/approved-kit-index.json';
import { stageLayout, type KitLike } from '@/lib/products/pdp-redesign/stage';
import { cylinderMasterSource } from '@/lib/products/cylinder-master';
import { SLEEK8_MASTER_REVIEW_VERSION, sleek8ReviewSku } from '@/lib/products/sleek8-master';
vi.mock('server-only', () => ({}));
import { localGpt13ComponentKits, localPdpComponentKits } from '@/lib/paper-doll/local-component-kits';
import { GET } from '@/app/api/bottle-masters/sleek8/route';
import { beforeVialRelease } from './helpers/vial-release-2026-11-04';
// Reconstruct the historical approval before the later tube-only lotion revision.
const lotionTubeBefore = JSON.parse(readFileSync('docs/reviews/cylinder-lotion-pumps-2026-11-02/before-kits.json', 'utf8')).rows as Record<string, KitLike>;
const capFitBefore = JSON.parse(readFileSync('docs/reviews/tall9-pour-cap-fit-2026-11-01/before-kits.json', 'utf8')).rows as Record<string, KitLike>;
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const directory = 'docs/reviews/sleek8-correction-2026-11-01/';
const before = read(directory + 'before-all-kits.json').rows as Record<string, KitLike>;
const proof = read(directory + 'scope-and-preservation.json');
const review = read('public/local-kits/sleek8-glass-depth-2026-11-01/kits.json');
const rows = review.rows as Record<string, KitLike>;
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
afterEach(() => vi.unstubAllEnvs());
describe('Sleek 8 ml regenerated glass and internal tube candidate', () => {
    it('uses one registered material layer inside the exact original outline for all 36 variants', () => {
        expect(Object.keys(rows).sort()).toEqual(proof.scope);
        expect(Object.keys(rows)).toHaveLength(36);
        expect(hash(readFileSync(proof.newBodyFile))).toBe(proof.newBodySha);
        expect(hash(readFileSync(proof.nativeGeneratedFile))).toBe(proof.nativeGeneratedSha);
        const oldSvg = readFileSync(proof.originalBodyFile, 'utf8'), newSvg = readFileSync(proof.newBodyFile, 'utf8');
        expect(hash(oldSvg)).toBe(proof.originalBodySha);
        expect(newSvg.match(/<defs>[\s\S]*?<\/defs>/)?.[0]).toBe(oldSvg.match(/<defs>[\s\S]*?<\/defs>/)?.[0]);
        expect(newSvg).toContain('viewBox="0 0 768 2192"');
        expect(Math.abs(proof.registration.rawAspectDriftPct)).toBeLessThan(1);
        for (const [sku, original] of Object.entries(before)) {
            const kit = rows[sku], body = kit.parts.find(p => p.slot === 'body')!;
            expect(body.image.url).toContain(proof.newBodySha.slice(0, 12));
            const restored = structuredClone(kit);
            for (const [i, part] of restored.parts.entries()) {
                if (part.slot === 'body') { part.image = original.parts[i].image; delete part.blendMode; }
                if (part.slot === 'diptube' && part.views?.includes('sidecar')) {
                    part.zOrder = original.parts[i].zOrder; part.opacity = original.parts[i].opacity; delete part.blendMode;
                }
            }
            expect(restored, sku).toEqual(original);
            const layouts = (['sidecar', 'capon', 'exploded'] as const).map(view => stageLayout(kit, view, { websiteSku: sku })!);
            const placement = (layout: typeof layouts[number]) => { const part = layout.parts.find(p => p.slot === 'body')!; return { box: part.box, x: part.dxPct, y: part.dyPct, url: part.url }; };
            for (const layout of layouts) { expect(layout.frame).toEqual(layouts[0].frame); expect(placement(layout)).toEqual(placement(layouts[0])); }
        }
    });
    it('puts all eight seated tubes behind glass while retaining natural exploded tubes', () => {
        expect(proof.sprayerSkus).toHaveLength(8);
        for (const sku of proof.sprayerSkus as string[]) {
            const kit = rows[sku], body = kit.parts.find(p => p.slot === 'body')!;
            const tube = kit.parts.find(p => p.slot === 'diptube' && p.views?.includes('sidecar'))!;
            expect(body.blendMode).toBe('multiply'); expect(tube.blendMode).toBe('multiply');
            expect(tube.zOrder).toBeLessThan(body.zOrder); expect(tube.opacity).toBe(0.4);
            expect(tube.bounds.bottom).toBeCloseTo(987.05, 8);
            expect(kit.parts.find(p => p.slot === 'diptube' && p.views?.includes('exploded'))).toEqual(before[sku].parts.find(p => p.slot === 'diptube' && p.views?.includes('exploded')));
        }
    });
    it('preserves approved body pixels and shares the local candidate across PDP, catalog and builder inputs', () => {
        const baseline = structuredClone(beforeVialRelease(manifest.rows)) as unknown as Record<string, KitLike>;   // as before the Vial release (2026-11-04)
        const laterAdditions = [...read('docs/reviews/hosted-vial3-jumbo28-2026-11-02/release-manifest.json').addedSkus as string[],
            ...read('docs/reviews/hosted-elegant-masters-2026-11-03/release-manifest.json').addedSkus as string[]];
        for (const sku of laterAdditions) delete baseline[sku];
        // Reconstruct this historical 438-recipe approval before the later Rectangle roll-on extension.
        for (const sku of Object.keys(baseline)) if (/^GBRect10(?:MtlRoll|Roll)/.test(sku)) delete baseline[sku];
        Object.assign(baseline, lotionTubeBefore, capFitBefore);
        const opticalBefore = read('docs/reviews/sleek8-hero-depth-2026-11-01/before-kits.json').rows;
        for (const [sku, original] of Object.entries(opticalBefore)) baseline[sku] = original as KitLike;
        expect(hash(JSON.stringify(baseline))).toBe(proof.approvedManifestHash);
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
        const variants = Object.keys(before).map(websiteSku => ({ websiteSku }));
        const normal = localPdpComponentKits('localhost:3010', undefined, variants);
        const pilot = localGpt13ComponentKits('localhost:3010', 'gpt13');
        for (const sku of Object.keys(before)) {
            expect(normal[sku]).toEqual(rows[sku]); expect(pilot[sku]).toEqual(rows[sku]);
            expect(cylinderMasterSource(sku)).toEqual({ family: 'sleek8', version: review.version });
        }
    });
    it('restricts the candidate endpoint to exact SKUs and the current version on loopback development', async () => {
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
        const sku = 'GBSleek8SpryGlMatt';
        const response = await GET(new Request('http://localhost:3010/api/bottle-masters/sleek8?sku=' + sku + '&v=' + SLEEK8_MASTER_REVIEW_VERSION));
        expect(response.status).toBe(200); expect((await response.json()).kit).toEqual(rows[sku]);
        expect(response.headers.get('cache-control')).toContain('no-store');
        for (const url of ['https://preview.vercel.app/api/bottle-masters/sleek8?sku=' + sku, 'http://localhost:3010/api/bottle-masters/sleek8?sku=GBSleek5SpryGlMatt', 'http://localhost:3010/api/bottle-masters/sleek8?sku=' + sku + '&v=old']) expect((await GET(new Request(url))).status).toBe(404);
        vi.stubEnv('VERCEL', '1'); expect((await GET(new Request('http://localhost:3010/api/bottle-masters/sleek8?sku=' + sku))).status).toBe(404);
        vi.stubEnv('VERCEL', ''); vi.stubEnv('NODE_ENV', 'production');
        expect(sleek8ReviewSku(sku)).toBeNull(); expect(cylinderMasterSource(sku)).toEqual({ family: 'approved', version: index.version });
        expect((await GET(new Request('http://localhost:3010/api/bottle-masters/sleek8?sku=' + sku))).status).toBe(404);
    });
});
