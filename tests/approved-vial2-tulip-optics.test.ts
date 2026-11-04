import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import manifest from '@/lib/paper-doll/approved-kits.generated.json';
import index from '@/lib/paper-doll/approved-kit-index.json';
import { stageLayout, type KitLike } from '@/lib/products/pdp-redesign/stage';
import { cylinderMasterSku, cylinderMasterSource } from '@/lib/products/cylinder-master';
vi.mock('server-only', () => ({}));
import { GET } from '@/app/api/bottle-masters/approved/route';
import { localGpt13ComponentKits, localPdpComponentKits } from '@/lib/paper-doll/local-component-kits';
import { beforeVialRelease } from './helpers/vial-release-2026-11-04';
// Reconstruct the historical approval before the later tube-only lotion revision.
const lotionTubeBefore = JSON.parse(readFileSync('docs/reviews/cylinder-lotion-pumps-2026-11-02/before-kits.json', 'utf8')).rows as Record<string, KitLike>;
const capFitBefore = JSON.parse(readFileSync('docs/reviews/tall9-pour-cap-fit-2026-11-01/before-kits.json', 'utf8')).rows as Record<string, KitLike>;
const directory = 'docs/reviews/vial2-matched-2026-11-01/';
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as Record<string, unknown>)[key])])) : value;
const imageHash = (part: KitLike['parts'][number]) => (part.image as typeof part.image & { sha256?: string }).sha256;
const rows = manifest.rows as unknown as Record<string, KitLike>;
// The 2 ml pair as approved on 1 Nov; the Vial release (2026-11-04) replaced the four rows with the slimmer reshape.
const pairRows = beforeVialRelease(rows);
const vialSkus = ['GBVAmb2BlackCap', 'GBVAmb2WhtCap', 'GBVialClr2mlBlackCap', 'GBVialClr2mlWhtCap'];
const sleekOpticsBefore = read('docs/reviews/sleek8-hero-depth-2026-11-01/before-kits.json').rows;
const tulipBefore = read('docs/reviews/tulip6-glass-depth-2026-11-01/before-kits.json').rows as Record<string, KitLike>;
afterEach(() => vi.unstubAllEnvs());
describe('approved straight-on 2 ml vial body pair', () => {
    it('binds the approved original PNGs to the four exact color/cap configurations', () => {
        const approval = read(directory + 'visual-approval.json');
        const registration = read(directory + 'registration.json');
        const before = read(directory + 'before-kits.json').rows as Record<string, KitLike>;
        expect(Object.keys(before).sort()).toEqual(vialSkus);
        for (const sku of vialSkus) {
            const kit = pairRows[sku], body = kit.parts.find(p => p.slot === 'body')!;
            const glass = sku.startsWith('GBVAmb') ? 'Amber' : 'Clear';
            const source = registration.assets[glass];
            expect(hash(readFileSync(source.file))).toBe(approval.images[glass].sha256);
            expect(imageHash(body)).toBe(approval.images[glass].sha256);
            expect(body.image.url).toContain(approval.images[glass].sha256);
            expect(body.image.url).toMatch(/^https:\/\/yzy7l20k4yt6znzz\.public\.blob\.vercel-storage\.com\//);
            expect(kit.parts.filter(p => p.slot === 'body')).toHaveLength(1);
        }
    });
    it('keeps approved silhouettes uniform, the original height curve, centered caps, and existing cap pixels', () => {
        const before = read(directory + 'before-kits.json').rows as Record<string, KitLike>;
        for (const sku of vialSkus) {
            const kit = pairRows[sku], body = kit.parts.find(p => p.slot === 'body')!;
            const cap = kit.parts.find(p => p.slot === 'cap')!, originalCap = before[sku].parts.find(p => p.slot === 'cap')!;
            expect(kit.glassSizing).toEqual({ heightPct: 40.24, baselinePct: 91 });
            expect(kit.anchors).toEqual(before[sku].anchors);
            expect(body.bounds.bottom - body.bounds.top).toBe(900);
            expect(body.box!.width / body.image.width!).toBeCloseTo(body.box!.height / body.image.height!, 12);
            expect((cap.bounds.left + cap.bounds.right) / 2).toBeCloseTo(500, 10);
            expect(cap.bounds.bottom).toBe(kit.anchors.seatY);
            expect(imageHash(cap)).toBe(imageHash(originalCap));
            expect(cap.box!.width / originalCap.box!.width).toBeCloseTo(cap.box!.height / originalCap.box!.height, 12);
            const layouts = (['sidecar', 'capon', 'exploded'] as const).map(view => stageLayout(kit, view, { websiteSku: sku })!);
            for (const layout of layouts) expect(layout.parts.find(p => p.slot === 'body')).toEqual(layouts[0].parts.find(p => p.slot === 'body'));
        }
    });
    it('serves the same approved body to hosted catalog and PDP, without localhost-only dependencies', async () => {
        vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('VERCEL', '1');
        for (const sku of vialSkus) {
            expect(cylinderMasterSku(sku)).toBe(sku);
            expect(cylinderMasterSource(sku)).toEqual({ family: 'approved', version: index.version });
            const response = await GET(new Request('https://preview.vercel.app/api/bottle-masters/approved?sku=' + sku + '&v=' + index.version));
            expect(response.status).toBe(200); expect((await response.json()).kit).toEqual(rows[sku]);
        }
        expect(localPdpComponentKits('localhost', 'kits', vialSkus.map(websiteSku => ({ websiteSku })))).toEqual({});
    });
});
describe('clear Tulip 6 ml internal optics', () => {
    it('puts the seated tube behind transmissive glass in every finish while preserving the natural exploded part', () => {
        expect(Object.keys(tulipBefore)).toHaveLength(7);
        for (const [sku, before] of Object.entries(tulipBefore)) {
            const after = rows[sku];
            const body = after.parts.find(p => p.slot === 'body')!;
            const seated = after.parts.find(p => p.slot === 'diptube' && p.views?.includes('sidecar'))!;
            expect(body.blendMode).toBe('multiply'); expect(seated.zOrder).toBeLessThan(body.zOrder);
            expect(seated.opacity).toBe(0.4); expect(seated.blendMode).toBe('multiply');
            const restored = structuredClone(after);
            restored.parts.forEach((part, i) => {
                if (part.slot === 'body') delete part.blendMode;
                if (part.slot === 'diptube' && part.views?.includes('sidecar')) {
                    part.zOrder = before.parts[i].zOrder; part.opacity = before.parts[i].opacity; delete part.blendMode;
                }
            });
            expect(restored, sku).toEqual(before);
            const exploded = after.parts.find(p => p.slot === 'diptube' && p.views?.includes('exploded'));
            expect(exploded).toEqual(before.parts.find(p => p.slot === 'diptube' && p.views?.includes('exploded')));
        }
    });
    it('updates bookmarked GPT pilot pages after the older general 13-415 batch', () => {
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
        const pilot = localGpt13ComponentKits('localhost:3010', 'gpt13');
        for (const sku of Object.keys(tulipBefore)) expect(pilot[sku]).toEqual(rows[sku]);
    });
    it('preserves prior recipes apart from the separately checked Sleek optical correction', () => {
        const prior = read(directory + 'prior-recipe-hashes.json').recipes;
        let count = 0;
        for (const [sku, digest] of Object.entries(prior)) {
            if (Object.hasOwn(tulipBefore, sku) || Object.hasOwn(sleekOpticsBefore, sku)) continue;
            expect(hash(JSON.stringify(canonical(lotionTubeBefore[sku] ?? capFitBefore[sku] ?? rows[sku]))), sku).toBe(digest); count++;
        }
        expect(count).toBe(419);
        expect(Object.keys(rows)).toHaveLength(857);   /* + 179 Diva masters + 7 Pillar sprayers (2026-11-04) */
        expect(index.skus).toEqual(Object.keys(rows).sort());
        expect(manifest.version).toBe(hash(JSON.stringify(manifest.rows)).slice(0, 16));
    });
});
