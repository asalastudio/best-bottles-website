import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import manifest from '@/lib/paper-doll/approved-kits.generated.json';
import { beforeVialRelease } from './helpers/vial-release-2026-11-04';
import index from '@/lib/paper-doll/approved-kit-index.json';
import { stageLayout, type KitLike } from '@/lib/products/pdp-redesign/stage';
import { cylinderMasterSource } from '@/lib/products/cylinder-master';
vi.mock('server-only', () => ({}));
import { GET } from '@/app/api/bottle-masters/approved/route';
// Reconstruct the historical approval before the later tube-only lotion revision.
const lotionTubeBefore = JSON.parse(readFileSync('docs/reviews/cylinder-lotion-pumps-2026-11-02/before-kits.json', 'utf8')).rows as Record<string, KitLike>;
const capFitBefore = JSON.parse(readFileSync('docs/reviews/tall9-pour-cap-fit-2026-11-01/before-kits.json', 'utf8')).rows as Record<string, KitLike>;
const dir = 'docs/reviews/sleek8-hero-depth-2026-11-01/';
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const before = read(dir + 'before-kits.json').rows as Record<string, KitLike>;
const rows = manifest.rows as unknown as Record<string, KitLike>;
const candidate = read('public/local-kits/sleek8-glass-depth-2026-11-01/kits.json').rows as Record<string, KitLike>;
const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical((v as Record<string, unknown>)[k])])) : v;
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
afterEach(() => vi.unstubAllEnvs());
describe('Sleek 8 ml hero tube depth', () => {
    it('serves one internal tube treatment to hosted heroes, product pages and builder recipes', async () => {
        vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('VERCEL', '1');
        expect(Object.keys(before)).toHaveLength(8);
        for (const [sku, original] of Object.entries(before)) {
            const kit = rows[sku], body = kit.parts.find(p => p.slot === 'body')!;
            const tube = kit.parts.find(p => p.slot === 'diptube' && p.views?.includes('sidecar'))!;
            expect(body.blendMode, sku).toBe('multiply');
            expect(tube.zOrder, sku).toBeLessThan(body.zOrder);
            expect(tube.opacity, sku).toBe(0.4); expect(tube.blendMode, sku).toBe('multiply');
            const restored = structuredClone(kit);
            restored.parts.forEach((part, i) => {
                if (part.slot === 'body') delete part.blendMode;
                if (part.slot === 'diptube' && part.views?.includes('sidecar')) {
                    part.zOrder = original.parts[i].zOrder; part.opacity = original.parts[i].opacity; delete part.blendMode;
                }
            });
            expect(restored, sku).toEqual(original);
            const local = structuredClone(candidate[sku]);
            local.parts.find(p => p.slot === 'body')!.image = body.image;
            expect(local, sku).toEqual(kit);
            const layouts = (['sidecar', 'capon', 'exploded'] as const).map(view => stageLayout(kit, view, { websiteSku: sku })!);
            for (const l of layouts.slice(0, 2)) {
                expect(l.parts.findIndex(p => p.slot === 'diptube')).toBeLessThan(l.parts.findIndex(p => p.slot === 'body'));
            }
            const ex = layouts[2].parts.find(p => p.slot === 'diptube')!;
            expect(ex.opacity).toBeUndefined(); expect(ex.blendMode).toBeUndefined();
            expect(cylinderMasterSource(sku)).toEqual({ family: 'approved', version: index.version });
            const response = await GET(new Request('https://preview.vercel.app/api/bottle-masters/approved?sku=' + sku + '&v=' + index.version));
            expect(response.status).toBe(200); expect((await response.json()).kit).toEqual(kit);
        }
    });
    it('preserves all 430 other recipes and versions the shared hosted manifest', () => {
        const prior = read(dir + 'prior-recipe-hashes.json').recipes;
        expect(Object.keys(prior)).toHaveLength(430);
        for (const [sku, digest] of Object.entries(prior)) expect(hash(lotionTubeBefore[sku] ?? capFitBefore[sku] ?? beforeVialRelease(rows)[sku]), sku).toBe(digest);
        expect(Object.keys(rows)).toHaveLength(1037);   /* + 179 Diva masters + 7 Pillar sprayers + 177 Empire/Grace/Diamond + 3 Pillar caps/rollers (2026-11-04) */ expect(index.skus).toEqual(Object.keys(rows).sort());
        expect(index.version).toBe(manifest.version);
        expect(manifest.version).toBe(createHash('sha256').update(JSON.stringify(manifest.rows)).digest('hex').slice(0, 16));
    });
});
