import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { BuilderKit } from '@/lib/bottle-builder/model';
import manifest from '@/lib/paper-doll/approved-kits.generated.json';
import index from '@/lib/paper-doll/approved-kit-index.json';
import display from '@/lib/products/display-images.generated.json';
import thumbs from '@/lib/products/cylinder-cap-thumbnails.generated.json';
import { cylinderMasterSource } from '@/lib/products/cylinder-master';
import { stageLayout } from '@/lib/products/pdp-redesign/stage';
import divaSkus from '@/lib/products/diva-master-skus.json';
import { beforeDivaRelease, divaReleaseSkus } from './helpers/diva-release-2026-11-04';
vi.mock('server-only', () => ({}));
import { GET } from '@/app/api/bottle-masters/approved/route';

const directory = 'docs/reviews/hosted-diva-masters-2026-11-04/';
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const review = read('public/local-kits/diva-masters-2026-11-03/kits.json');
const source = review.rows as Record<string, BuilderKit>;
const hosted = manifest.rows as unknown as Record<string, BuilderKit>;
const plan = read(directory + 'upload-plan.json');
const receipt = read(directory + 'asset-receipt.json') as Record<string, { key: string; sha256: string; bytes: number; url: string; verified: boolean }>;
const aliases = display.aliases as Record<string, string>;
const blob = 'https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/';
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as Record<string, unknown>)[key])])) : value;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
/** Every image reference reduced to its hosted URL (the release also stamps key/sha256/bytes on the hosted copies). */
const urlsOnly = (value: unknown, host: (url: string) => string): unknown => Array.isArray(value) ? value.map(item => urlsOnly(item, host))
    : value && typeof value === 'object' ? ('url' in value && typeof (value as { url: unknown }).url === 'string'
        ? { url: host((value as { url: string }).url), ...Object.fromEntries(Object.entries(value).filter(([key]) => !['url', 'key', 'sha256', 'bytes'].includes(key))) }
        : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, urlsOnly(item, host)]))) : value;

describe('Diva review masters published (2026-11-04)', () => {
    it('publishes exactly the 179 reviewed Diva SKUs, the kits Jordan approved on localhost, replacing nothing', () => {
        expect(review.version).toBe('32a89f9270c0');
        expect([...divaSkus].sort()).toEqual(Object.keys(source).sort());
        expect([...divaReleaseSkus].sort()).toEqual([...divaSkus].sort());
        expect(plan.replacedRecipes).toEqual([]);
        for (const sku of divaSkus) expect(hosted[sku], sku).toBeDefined();
        expect(Object.keys(hosted)).toHaveLength(1037);   // + 7 Pillar sprayers + 177 Empire/Grace/Diamond (2026-11-04) + 177 Empire/Grace/Diamond + 3 Pillar caps/rollers (2026-11-04)
        expect(index.skus).toEqual(Object.keys(hosted).sort());
        expect(index.version).toBe(manifest.version);
    });
    it('leaves every other approved recipe exactly as it was', () => {
        expect(digest(beforeDivaRelease(hosted))).toBe(plan.preservedRecipeSha256);
    });
    it('hosts every local layer on Blob, byte-verified, with the reviewed recipe otherwise unchanged', () => {
        const verified = new Map(Object.values(receipt).map(asset => [asset.url, asset]));
        for (const [url, asset] of Object.entries(plan.assets as Record<string, { sha256: string }>)) {
            const hostedUrl = aliases[url];
            expect(hostedUrl, url).toMatch(new RegExp('^' + blob + 'reviewed-master-media/2026-11-04/'));
            expect(verified.get(hostedUrl)?.verified, url).toBe(true);
            expect(createHash('sha256').update(readFileSync('public' + url)).digest('hex'), url).toBe(asset.sha256);
        }
        const host = (url: string) => url.startsWith('/') ? aliases[url] : url;
        for (const sku of divaSkus) {
            const kit = hosted[sku];
            expect(JSON.stringify(kit), sku).not.toMatch(/"url":"\/(?:local-kits|reviews)\//);
            expect(urlsOnly(kit, url => url), sku).toEqual(urlsOnly(source[sku], host));
            for (const view of ['sidecar', 'capon', 'exploded'] as const) expect(stageLayout(kit, view, { websiteSku: sku }), `${sku} ${view}`).toBeTruthy();
            const closeUp = (kit as BuilderKit & { capCloseUp?: { url: string } }).capCloseUp;
            if ((source[sku] as BuilderKit & { capCloseUp?: unknown }).capCloseUp) expect((thumbs as Record<string, string>)[sku], sku).toBe(closeUp!.url);
        }
    });
    it('keeps the thin, bent exploded dip tubes Jordan approved', () => {
        const tubes = divaSkus.map(sku => hosted[sku].parts.find(part => part.slot === 'diptube')).filter(Boolean);
        expect(tubes).toHaveLength(125);
        for (const tube of tubes) expect(tube!.views).toEqual(['exploded']);
    });
    it('serves the hosted recipe from the approved route outside development', async () => {
        for (const sku of divaSkus) {
            const response = await GET(new Request(`https://preview.vercel.app/api/bottle-masters/approved?sku=${sku}&v=${index.version}`));
            expect(response.status, sku).toBe(200);
            expect((await response.json()).kit).toEqual(hosted[sku]);
            expect(cylinderMasterSource(sku)).toEqual({ family: 'approved', version: index.version });
        }
    });
});
