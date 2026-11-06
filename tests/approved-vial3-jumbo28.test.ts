import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import manifest from '@/lib/paper-doll/approved-kits.generated.json';
import index from '@/lib/paper-doll/approved-kit-index.json';
import { displayDerivativeUrl } from '@/lib/products/display-derivative';
// The manifest is read on the server; importing the server module registers every source for this test.
import "@/lib/products/display-derivative.server";
vi.mock("server-only", () => ({}));
import { stageLayout, type KitLike } from '@/lib/products/pdp-redesign/stage';
import { beforeVialRelease } from './helpers/vial-release-2026-11-04';

const directory = 'docs/reviews/hosted-vial3-jumbo28-2026-11-02/';
const release = JSON.parse(readFileSync(directory + 'release-manifest.json', 'utf8'));
const rows = manifest.rows as unknown as Record<string, KitLike>;
const selected = new Set<string>(release.addedSkus);
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort()
        .map(key => [key, canonical((value as Record<string, unknown>)[key])])) : value;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

describe('hosted 28 ml archive body and 5/8 dram vial release', () => {
    it('adds seven exact configurations and preserves every earlier approved recipe', () => {
        expect(selected.size).toBe(7);
        const later = new Set(JSON.parse(readFileSync('docs/reviews/hosted-elegant-masters-2026-11-03/release-manifest.json', 'utf8')).addedSkus as string[]);
        const previous = Object.fromEntries(Object.entries(beforeVialRelease(rows)).filter(([sku]) => !selected.has(sku) && !later.has(sku)));
        expect(Object.keys(previous)).toHaveLength(456);
        expect(digest(previous)).toBe(release.preservedRecipeSha256);
        expect(index.skus).toEqual(Object.keys(rows).sort());
        expect(index.version).toBe(manifest.version);
        expect(Object.keys(rows)).not.toContain('GBCyl50MtlRollWht');
    });
    it('changes only image locations and keeps all source registration and view geometry', () => {
        for (const file of ['public/local-kits/jumbo28-archive-geometry-2026-11-02/kits.json',
            'public/local-kits/vial3-swatches-builder-2026-11-02/kits.json']) {
            const source = JSON.parse(readFileSync(file, 'utf8')).rows as Record<string, KitLike>;
            for (const [sku, original] of Object.entries(source)) {
                const kit = rows[sku], restored = structuredClone(kit);
                restored.parts.forEach((part, i) => { part.image = original.parts[i].image; });
                expect(restored, sku).toEqual(original);
                for (const view of ['sidecar', 'capon', 'exploded'] as const) {
                    const before = stageLayout(original, view, { websiteSku: sku })!;
                    const after = stageLayout(kit, view, { websiteSku: sku })!;
                    const geometry = (part: typeof after.parts[number]) => ({ slot: part.slot, box: part.box, dxPct: part.dxPct, dyPct: part.dyPct });
                    expect(after.parts.map(geometry), sku + view).toEqual(before.parts.map(geometry));
                }
            }
        }
    });
    it('provides verified public images and lossless delivery copies for every new layer', () => {
        const receipt = JSON.parse(readFileSync(directory + 'asset-receipt.json', 'utf8'));
        const checks = JSON.parse(readFileSync(directory + 'display-verification.json', 'utf8')) as Array<{ alphaDifferences: number; visibleColorDifferences: number }>;
        expect(checks).toHaveLength(36);
        expect(checks.every(row => row.alphaDifferences === 0 && row.visibleColorDifferences === 0)).toBe(true);
        for (const sku of selected) for (const part of rows[sku].parts) {
            expect(part.image.url).toMatch(/^https:\/\/yzy7l20k4yt6znzz\.public\.blob\.vercel-storage\.com\//);
            const sha = (part.image as unknown as { sha256: string }).sha256;
            expect(Object.values(receipt).some(entry => (entry as { sha256: string; verified: boolean }).sha256 === sha
                && (entry as { verified: boolean }).verified)).toBe(true);
            for (const width of [128, 256, 640, 1200]) expect(displayDerivativeUrl(part.image.url, width)).toMatch(/^https:/);
        }
    });
});
