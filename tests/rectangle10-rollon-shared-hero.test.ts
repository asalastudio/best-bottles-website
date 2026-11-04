import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import manifest from '@/lib/paper-doll/approved-kits.generated.json';
import { beforeVialRelease } from './helpers/vial-release-2026-11-04';
import index from '@/lib/paper-doll/approved-kit-index.json';
import { cylinderMasterSku, cylinderMasterSource } from '@/lib/products/cylinder-master';
import { stageLayout, type KitLike } from '@/lib/products/pdp-redesign/stage';
vi.mock('server-only', () => ({}));
import { localGpt13ComponentKits, localPdpComponentKits, readLocalComponentKits } from '@/lib/paper-doll/local-component-kits';

// Reconstruct the historical approval before the later tube-only lotion revision.
const lotionTubeBefore = JSON.parse(readFileSync('docs/reviews/cylinder-lotion-pumps-2026-11-02/before-kits.json', 'utf8')).rows as Record<string, KitLike>;
const capFitBefore = JSON.parse(readFileSync('docs/reviews/tall9-pour-cap-fit-2026-11-01/before-kits.json', 'utf8')).rows as Record<string, KitLike>;
const source = JSON.parse(readFileSync('docs/reviews/rectangle10-rollon-hero-2026-11-01/before-kits.json', 'utf8')).rows as Record<string, KitLike>;
const rows = manifest.rows as unknown as Record<string, KitLike>;
const prior = JSON.parse(readFileSync('docs/reviews/rectangle10-rollon-hero-2026-11-01/preserved-recipes.json', 'utf8'));
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as Record<string, unknown>)[key])])) : value;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
afterEach(() => vi.unstubAllEnvs());

describe('Rectangle 10 ml roll-on shared hero', () => {
    it('connects all 18 exact roll-on choices to the same hosted body and original PDP geometry', () => {
        vi.stubEnv('NODE_ENV', 'production');
        expect(Object.keys(source)).toHaveLength(18);
        const bodies = new Set<string>();
        for (const [sku, original] of Object.entries(source)) {
            const kit = rows[sku];
            expect(kit, sku).toBeDefined();
            expect(cylinderMasterSku(sku)).toBe(sku);
            expect(cylinderMasterSource(sku)?.family).toBe('approved');
            expect(kit.anchors).toEqual(original.anchors);
            expect(kit.glassSizing).toEqual(original.glassSizing);
            expect(kit.parts).toHaveLength(original.parts.length);
            for (const [i, part] of kit.parts.entries()) {
                expect(part.image.url).toMatch(/^https:\/\/yzy7l20k4yt6znzz\.public\.blob\.vercel-storage\.com\//);
                expect({ ...part, image: original.parts[i].image }).toEqual(original.parts[i]);
                expect((part.image as { sha256?: string }).sha256).toBe((original.parts[i].image as { sha256?: string }).sha256);
                if (part.slot === 'body') bodies.add(part.image.url);
            }
            const layouts = (['sidecar', 'capon', 'exploded'] as const).map(view => stageLayout(kit, view, { websiteSku: sku })!);
            for (const layout of layouts) {
                expect(layout.frame).toEqual(layouts[0].frame);
                expect(layout.parts.find(part => part.slot === 'body')).toEqual(layouts[0].parts.find(part => part.slot === 'body'));
            }
        }
        expect(bodies.size).toBe(1);
    });
    it('keeps normal product pages, bookmarked pilots and builder inputs on the hosted hero recipes', () => {
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
        const variants = Object.keys(source).map(websiteSku => ({ websiteSku }));
        const normal = localPdpComponentKits('localhost:3010', undefined, variants);
        const pilot = localGpt13ComponentKits('localhost:3010', 'gpt13');
        const builder = readLocalComponentKits();
        for (const sku of Object.keys(source)) {
            expect(normal[sku]).toEqual(rows[sku]);
            expect(pilot[sku]).toEqual(rows[sku]);
            expect(builder?.[sku]).toEqual(rows[sku]);
        }
    });
    it('preserves every earlier recipe and excludes unrelated Rectangle products', () => {
        for (const [sku, expected] of Object.entries(prior.recipes)) expect(hash(lotionTubeBefore[sku] ?? capFitBefore[sku] ?? beforeVialRelease(rows)[sku]), sku).toBe(expected);
        expect(Object.keys(rows)).toHaveLength(prior.count + 18 + 7 + 196 + 12 + 179 + 7 + 177);   // + the Elegant masters (2026-11-03) + 12 Vial masters + 179 Diva masters + 7 Pillar sprayers + 177 Empire/Grace/Diamond (2026-11-04)
        expect(index.skus).toEqual(Object.keys(rows).sort());
        expect(index.version).toBe(manifest.version);
        expect(cylinderMasterSku('GBRect10SpryGlMatt')).toBeNull();
        expect(cylinderMasterSku('GBRect10Gl')).toBeNull();
        expect(cylinderMasterSku('GBSQSTClear')).toBeNull();
    });
});
