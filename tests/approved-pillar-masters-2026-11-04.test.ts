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
import { beforePillarRelease, pillarReleaseSkus } from './helpers/pillar-release-2026-11-04';
vi.mock('server-only', () => ({}));
import { GET } from '@/app/api/bottle-masters/approved/route';

const directory = 'docs/reviews/hosted-pillar-masters-2026-11-04/';
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
// Freeze the source recipe used to publish this release so localhost edits can be reviewed independently.
const review = read('tests/helpers/pillar-hosted-release-source-2026-11-04.json');
const pillarSkus = ['GBPillar9SpryBlkMatt', 'GBPillar9SpryBlkShn', 'GBPillar9SpryBluMatt', 'GBPillar9SpryGlMatt', 'GBPillar9SpryGlShn', 'GBPillar9SprySlMatt', 'GBPillar9SprySlShn'];
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

describe('Pillar 9 ml sprayer masters published (2026-11-04)', () => {
    it('publishes exactly the seven reviewed Pillar sprayers, the kits Jordan approved on localhost, replacing nothing', () => {
        expect(review.version).toBe('f3f66c0fdda7');
        expect(Object.keys(source).sort()).toEqual(pillarSkus);
        expect([...pillarReleaseSkus].sort()).toEqual(pillarSkus);
        expect(plan.replacedRecipes).toEqual([]);
        for (const sku of pillarSkus) expect(hosted[sku], sku).toBeDefined();
        expect(Object.keys(hosted)).toHaveLength(1037);
        expect(index.skus).toEqual(Object.keys(hosted).sort());
        expect(index.version).toBe(manifest.version);
    });
    it('leaves every other approved recipe exactly as it was', () => {
        expect(digest(beforePillarRelease(hosted))).toBe(plan.preservedRecipeSha256);
    });
    it('hosts every local layer on Blob, byte-verified (new) or reused from an earlier release with its copies', () => {
        const verified = new Map(Object.values(receipt).map(asset => [asset.url, asset]));
        const assets = plan.assets as Record<string, { sha256: string; reuse: string | null }>;
        expect(Object.values(assets).filter(asset => asset.reuse)).toHaveLength(14);   // the Cylinder 5 13-415 sprayers and overcaps
        for (const [url, asset] of Object.entries(assets)) {
            const hostedUrl = aliases[url];
            expect(createHash('sha256').update(readFileSync('public' + url)).digest('hex'), url).toBe(asset.sha256);
            expect((display.sources as Record<string, unknown>)[hostedUrl], url).toBeDefined();
            if (asset.reuse) { expect(hostedUrl, url).toBe(asset.reuse); expect(hostedUrl.endsWith('/' + asset.sha256 + '.svg'), url).toBe(true); continue; }
            expect(hostedUrl, url).toMatch(new RegExp('^' + blob + 'reviewed-master-media/2026-11-04/'));
            expect(verified.get(hostedUrl)?.verified, url).toBe(true);
        }
        const host = (url: string) => url.startsWith('/') ? aliases[url] : url;
        for (const sku of pillarSkus) {
            const kit = hosted[sku];
            expect(JSON.stringify(kit), sku).not.toMatch(/"url":"\/(?:local-kits|reviews)\//);
            expect(urlsOnly(kit, url => url), sku).toEqual(urlsOnly(source[sku], host));
            for (const view of ['sidecar', 'capon', 'exploded'] as const) expect(stageLayout(kit, view, { websiteSku: sku }), `${sku} ${view}`).toBeTruthy();
            const closeUp = (kit as BuilderKit & { capCloseUp?: { url: string } }).capCloseUp;
            if ((source[sku] as BuilderKit & { capCloseUp?: unknown }).capCloseUp) expect((thumbs as Record<string, string>)[sku], sku).toBe(closeUp!.url);
        }
    });
    it('draws the photographed Pillar body and the dip tube that ends on the glass floor', () => {
        for (const sku of pillarSkus) {
            const body = hosted[sku].parts.find(part => part.slot === 'body')!;
            expect((body as { derivation?: string }).derivation, sku).toContain('27. GBPillar9RollBlk.psd');
            const tubes = hosted[sku].parts.filter(part => part.slot === 'diptube');
            expect(tubes, sku).toHaveLength(2);
            for (const tube of tubes) expect(tube.bounds.bottom, sku).toBeLessThan(review.measured.baseFloorY);
        }
    });
    it('serves the hosted recipe from the approved route outside development', async () => {
        for (const sku of pillarSkus) {
            const response = await GET(new Request(`https://preview.vercel.app/api/bottle-masters/approved?sku=${sku}&v=${index.version}`));
            expect(response.status, sku).toBe(200);
            expect((await response.json()).kit).toEqual(hosted[sku]);
        }
    });
});

it('serves the shared Pillar pour body with ten distinct caps through the hosted master route', async () => {
    const suffixes = ['BlkShSht', 'BlkSht', 'WhtSht', 'CuSht', 'GlMattSht', 'SlMattSht', 'Gl', 'GlSht', 'Sl', 'SlSht'];
    const kits = await Promise.all(suffixes.map(async suffix => {
        const sku = `GBPillar9${suffix}`;
        const master = cylinderMasterSource(sku);
        expect(master?.family, sku).toBe('approved');
        const response = await GET(new Request(`https://example.com/api/bottle-masters/approved?sku=${sku}&v=${master?.version}`));
        expect(response.status, sku).toBe(200);
        const { kit } = await response.json() as { kit: BuilderKit };
        expect(kit.sku).toBe(sku);
        return kit;
    }));
    expect(new Set(kits.map(kit => kit.parts.find(part => part.slot === 'body')?.image.url)).size).toBe(1);
    expect(new Set(kits.map(kit => kit.parts.find(part => part.slot === 'cap')?.componentId)).size).toBe(10);
});

it('serves the current Pillar and clear Tulip art for exact catalog SKUs', async () => {
    const rollCaps = ['BlkDot', 'BlkSh', 'CuMatt', 'GlMatt', 'GlSh', 'PinkDot', 'SlDot', 'SlMatt', 'SlSh'];
    const metalSkus = rollCaps.map(cap => `GBPillar9MtlRoll${cap === 'BlkDot' ? 'Blkdot' : cap}`);
    const plasticSkus = rollCaps.map(cap => `GBPillar9Roll${cap}`);
    const tulipSkus = Object.keys(hosted).filter(sku => sku.startsWith('GBTulip6'));
    expect(tulipSkus).toHaveLength(34);
    for (const sku of [...pillarSkus, ...metalSkus, ...plasticSkus, ...tulipSkus]) {
        const pillar = sku.startsWith('GBPillar');
        const version = pillar ? 'pillar-shared-glass-v1' : 'tulip6-clear-glass-v1';
        expect(cylinderMasterSource(sku), sku).toEqual({ family: 'approved', version });
        const response = await GET(new Request(`https://preview.vercel.app/api/bottle-masters/approved?sku=${sku}&v=${version}`));
        expect(response.status, sku).toBe(200);
        const { kit, displayDerivatives } = await response.json() as { kit: BuilderKit; displayDerivatives: Record<string, { urls: Record<string, string> }> };
        expect(kit.sku).toBe(sku);
        expect(JSON.stringify(kit), sku).not.toMatch(/"url":"\/(?:local-kits|reviews)\//);
        const body = kit.parts.find(part => part.slot === 'body')!;
        expect(body.image.url, sku).toBe(pillar
            ? '/images/approved-masters/body-pillar-9ml-clear-glass.33ffa1b36577.webp'
            : '/images/approved-masters/tulip6-clear-master.18117b2e238d.webp');
        for (const asset of Object.values(displayDerivatives[body.image.url].urls)) {
            expect(readFileSync('public' + asset).length, asset).toBeGreaterThan(0);
        }
        if (metalSkus.includes(sku) || plasticSkus.includes(sku)) {
            expect(kit.parts.find(part => part.slot === 'roller')?.image.url, sku).toMatch(
                metalSkus.includes(sku) ? /\/roller-metal\.2c4bc8ffee8b\.png$/ : /\/roller-plastic\.4b356a2a9537\.png$/);
        }
        for (const view of ['sidecar', 'capon', 'exploded'] as const) {
            expect(stageLayout(kit, view, { websiteSku: sku }), `${sku} ${view}`).toBeTruthy();
        }
    }
});
