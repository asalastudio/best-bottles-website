import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '@/lib/paper-doll/approved-kits.generated.json';
import index from '@/lib/paper-doll/approved-kit-index.json';
import display from '@/lib/products/display-images.generated.json';
import { CIRCLE_MASTER_REVIEW_VERSION } from '@/lib/products/circle-master';
import { DIVA_MASTER_REVIEW_VERSION } from '@/lib/products/diva-master';
import { ELEGANT60_100_MASTER_REVIEW_VERSION } from '@/lib/products/elegant60-100-master';
import { ROUND_SLEEK_MASTER_REVIEW_VERSION } from '@/lib/products/round-sleek-master';
import { beforeReducerLevelling, reducerLevelling } from './helpers/reducer-levelling-2026-11-24';

type Part = { slot: string; image: { url: string; sha256: string; width: number; height: number; bytes: number }; box?: unknown; derivation?: string };
type Kit = { sku: string; parts: Part[] };
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const hosted = manifest.rows as unknown as Record<string, Kit>;
const TILTED = ['9a7c899be4dff12716d0597af4609b88143b4c5fb5e22ca1c1eb1354c1cc6e8d', 'df76f6c3620dba019b9414e9dc9fab1a5de80ff49aa4ea4407ba9ea643e0a715'];
const flat = 'public/local-kits/egd-masters-2026-11-04/reducer/';
const LEVELLED = { seated: sha(flat + 'reducer-18415-seated-flat.c3ff73208e1b.png'), full: sha(flat + 'reducer-18415-full-flat.5801c2af9038.png') };
const reducers = (rows: Record<string, Kit>) => Object.values(rows).flatMap(kit => kit.parts.filter(part => part.slot === 'reducer').map(part => ({ sku: kit.sku, part })));
const localKits: Array<[string, string]> = [
    ['public/local-kits/circle-masters-2026-11-03/kits.json', CIRCLE_MASTER_REVIEW_VERSION],
    ['public/local-kits/diva-masters-2026-11-03/kits.json', DIVA_MASTER_REVIEW_VERSION],
    ['public/local-kits/elegant60-100-masters-2026-11-03/kits.json', ELEGANT60_100_MASTER_REVIEW_VERSION],
    ['public/local-kits/round-sleek-masters-2026-11-03/kits.json', ROUND_SLEEK_MASTER_REVIEW_VERSION],
];

describe('reducer insert levelled on every reducer bottle (2026-11-24)', () => {
    it('leaves no live recipe on the insert photographed from above', () => {
        const parts = reducers(hosted);
        expect(parts).toHaveLength(288);   // 144 reducer bottles (Elegant 60/100, Diva, Empire, Grace, Diamond), seated and exploded
        for (const { sku, part } of parts) {
            expect(TILTED, sku).not.toContain(part.image.sha256);
            expect([LEVELLED.seated, LEVELLED.full], sku).toContain(part.image.sha256);
            expect(part.derivation, sku).toBe('psd-layer:levelled (flat-reducer.py)');
        }
    });

    it('reuses the levelled images already hosted with the Empire/Grace/Diamond masters, with their display copies', () => {
        const receipt = read('docs/reviews/hosted-egd-masters-2026-11-04/asset-receipt.json') as Record<string, { url: string; sha256: string; bytes: number; verified: boolean }>;
        const urls = new Set(reducers(hosted).map(({ part }) => part.image.url));
        expect(urls.size).toBe(2);
        for (const url of urls) {
            const asset = Object.values(receipt).find(entry => entry.url === url);
            expect(asset?.verified, url).toBe(true);
            expect([LEVELLED.seated, LEVELLED.full]).toContain(asset!.sha256);
            expect((display.sources as Record<string, unknown>)[url], url).toBeDefined();
        }
    });

    it('changes only the insert: same recipes, same size and box, and undoing it gives back the approved version exactly', () => {
        expect(reducerLevelling.levelledSkus).toHaveLength(96);
        expect(reducerLevelling.levelledSkus.every(sku => /^GB(?:Elg|ElgFrst|Diva|DivaFrst)\d+Rdcr/.test(sku))).toBe(true);
        expect(manifest.version).toBe(reducerLevelling.version);
        expect(index.version).toBe(manifest.version);
        const before = beforeReducerLevelling(hosted);
        expect(Object.keys(before)).toEqual(Object.keys(hosted));
        // the manifest's own version: the first 16 hex of sha256 over its rows as written
        expect(createHash('sha256').update(JSON.stringify(before)).digest('hex').slice(0, 16)).toBe(reducerLevelling.priorVersion);
        for (const [sku, replaced] of Object.entries(reducerLevelling.replacedParts)) {
            for (const { part, image } of replaced) {
                const now = hosted[sku].parts[part];
                const was = image as Part['image'];
                expect(TILTED, sku).toContain(was.sha256);
                expect([now.image.width, now.image.height], sku).toEqual([was.width, was.height]);
                expect(now.box, sku).toEqual(before[sku].parts[part].box);
            }
        }
    });

    it('levels the localhost review kits too, each served at the version its route expects', () => {
        let bottles = 0;
        for (const [file, version] of localKits) {
            const kits = read(file) as { version: string; rows: Record<string, Kit> };
            expect(kits.version, file).toBe(version);
            const parts = reducers(kits.rows);
            expect(parts.length, file).toBeGreaterThan(0);
            bottles += parts.length / 2;
            for (const { sku, part } of parts) {
                expect(TILTED, sku).not.toContain(part.image.sha256);
                expect(part.image.url, sku).toMatch(/^\/local-kits\/egd-masters-2026-11-04\/reducer\/reducer-18415-(?:seated|full)-flat\.[0-9a-f]{12}\.png$/);
                expect(sha('public' + part.image.url), sku).toBe(part.image.sha256);
            }
        }
        expect(bottles).toBe(227);   // Circle 47, Diva 48, Elegant 60/100 48, Round and Sleek 84
    });
});
