import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { BuilderKit } from '@/lib/bottle-builder/model';
import manifest from '@/lib/paper-doll/approved-kits.generated.json';
import index from '@/lib/paper-doll/approved-kit-index.json';
import { cylinderMasterSource } from '@/lib/products/cylinder-master';
import { stageLayout } from '@/lib/products/pdp-redesign/stage';
import vialSkus from '@/lib/products/vial-master-skus.json';
import { beforeVialRelease, vialReleaseNewSkus, vialReleaseReplacedSkus } from './helpers/vial-release-2026-11-04';
vi.mock('server-only', () => ({}));
import { GET } from '@/app/api/bottle-masters/approved/route';

const directory = 'docs/reviews/hosted-vial-masters-2026-11-04/';
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const source = read('public/local-kits/vial-masters-2026-11-03/kits.json').rows as Record<string, BuilderKit>;
const hosted = manifest.rows as unknown as Record<string, BuilderKit>;
const plan = read(directory + 'upload-plan.json');
const receipt = read(directory + 'asset-receipt.json') as Record<string, { key: string; sha256: string; bytes: number; url: string; verified: boolean }>;
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as Record<string, unknown>)[key])])) : value;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

describe('Vial review masters published (2026-11-04)', () => {
    it('publishes exactly the 16 reviewed Vial SKUs: 12 new, the four 2 ml vials replaced', () => {
        expect([...vialSkus].sort()).toEqual(Object.keys(source).sort());
        expect(vialReleaseReplacedSkus).toEqual(['GBVAmb2BlackCap', 'GBVAmb2WhtCap', 'GBVialClr2mlBlackCap', 'GBVialClr2mlWhtCap']);
        expect(vialReleaseNewSkus).toHaveLength(12);
        for (const sku of vialSkus) expect(hosted[sku], sku).toBeDefined();
        expect(Object.keys(hosted)).toHaveLength(1037);   /* + 179 Diva masters + 7 Pillar sprayers + 177 Empire/Grace/Diamond + 3 Pillar caps/rollers (2026-11-04) */
        expect(index.skus).toEqual(Object.keys(hosted).sort());
        expect(index.version).toBe(manifest.version);
    });
    it('leaves every other approved recipe exactly as it was', () => {
        const others = Object.fromEntries(Object.entries(beforeVialRelease(hosted)).filter(([sku]) => !vialSkus.includes(sku)));
        expect(digest(others)).toBe(plan.preservedRecipeSha256);
    });
    it('hosts every layer on Blob, byte-verified, with the reviewed recipe otherwise unchanged', () => {
        const byHash = new Map(Object.values(receipt).map(asset => [asset.sha256, asset]));
        for (const sku of vialSkus) {
            const kit = hosted[sku], original = source[sku];
            const restored = structuredClone(kit);
            restored.parts.forEach((part, i) => { part.image = original.parts[i].image; });
            expect(restored, sku).toEqual(original);
            for (const [i, part] of kit.parts.entries()) {
                expect(part.image.url, sku).toMatch(/^https:\/\/yzy7l20k4yt6znzz\.public\.blob\.vercel-storage\.com\/reviewed-master-media\/2026-11-04\//);
                const bytes = readFileSync('public' + original.parts[i].image.url);
                const asset = byHash.get(createHash('sha256').update(bytes).digest('hex'))!;
                expect(asset, sku).toBeDefined();
                expect(asset.verified).toBe(true);
                expect(part.image.url).toBe(asset.url);
            }
            for (const view of ['sidecar', 'capon', 'exploded'] as const) expect(stageLayout(kit, view, { websiteSku: sku }), `${sku} ${view}`).toBeTruthy();
        }
    });
    it('serves the hosted recipe from the approved route outside development', async () => {
        for (const sku of vialSkus) {
            const response = await GET(new Request(`https://preview.vercel.app/api/bottle-masters/approved?sku=${sku}&v=${index.version}`));
            expect(response.status, sku).toBe(200);
            expect((await response.json()).kit).toEqual(hosted[sku]);
            expect(cylinderMasterSource(sku)).toEqual({ family: 'approved', version: index.version });
        }
    });
});
