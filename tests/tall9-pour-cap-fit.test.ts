import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import manifest from '@/lib/paper-doll/approved-kits.generated.json';
import index from '@/lib/paper-doll/approved-kit-index.json';
import { stageLayout, type KitLike } from '@/lib/products/pdp-redesign/stage';
vi.mock('server-only', () => ({}));
import { localGpt13ComponentKits, localPdpComponentKits, readLocalComponentKits } from '@/lib/paper-doll/local-component-kits';
const dir = 'docs/reviews/tall9-pour-cap-fit-2026-11-01/';
const before = JSON.parse(readFileSync(dir + 'before-kits.json', 'utf8')).rows as Record<string, KitLike>;
const prior = JSON.parse(readFileSync(dir + 'prior-recipe-hashes.json', 'utf8')).recipes;
const registration = JSON.parse(readFileSync(dir + 'cap-registration.json', 'utf8'));
const rows = manifest.rows as unknown as Record<string, KitLike>;
// Reconstruct the earlier cap-fit release before the later tube-only revision.
const lotionTubeBefore = JSON.parse(readFileSync('docs/reviews/cylinder-lotion-pumps-2026-11-02/before-kits.json', 'utf8')).rows as Record<string, KitLike>;
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as Record<string, unknown>)[key])])) : value;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
afterEach(() => vi.unstubAllEnvs());

describe('9 ml 13-415 pour-cap visible-edge registration', () => {
    it('centers all 20 clear/frosted caps and seats visible edges without resizing or repainting', () => {
        expect(registration.corrections).toHaveLength(20);
        for (const correction of registration.corrections) {
            const sku = correction.sku as string, kit = rows[sku], old = before[sku];
            const cap = kit.parts.find(part => part.slot === 'cap')!, original = old.parts.find(part => part.slot === 'cap')!;
            const pixels = correction.visiblePixels;
            expect(correction.previousVisibleCenter).not.toBeCloseTo(correction.targetAxis, 1);
            expect(cap.box!.x + (pixels.left + pixels.right) / 2 / pixels.width * cap.box!.width).toBeCloseTo(correction.targetAxis, 8);
            expect(cap.box!.y + pixels.bottom / pixels.height * cap.box!.height).toBeCloseTo(correction.targetBottom, 8);
            expect([cap.box!.width, cap.box!.height, cap.image]).toEqual([original.box!.width, original.box!.height, original.image]);
            expect({ ...kit, parts: kit.parts.map(part => part.slot === 'cap' ? original : part) }).toEqual(old);
            const layouts = (['sidecar', 'capon', 'exploded'] as const).map(view => stageLayout(kit, view, { websiteSku: sku })!);
            for (const layout of layouts) expect(layout.parts.find(part => part.slot === 'body')).toEqual(layouts[0].parts.find(part => part.slot === 'body'));
        }
    });
    it('keeps all other 436 recipes unchanged and shares the fit with current pages, pilots and builder', () => {
        let count = 0;
        for (const [sku, digest] of Object.entries(prior)) if (!before[sku]) { expect(hash(lotionTubeBefore[sku] ?? rows[sku]), sku).toBe(digest); count++; }
        expect(count).toBe(436); expect(Object.keys(rows)).toHaveLength(463);
        expect(index.skus).toEqual(Object.keys(rows).sort()); expect(index.version).toBe(manifest.version);
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
        const normal = localPdpComponentKits('localhost:3010', undefined, Object.keys(before).map(websiteSku => ({ websiteSku })));
        const pilot = localGpt13ComponentKits('localhost:3010', 'gpt13'), builder = readLocalComponentKits();
        for (const sku of Object.keys(before)) { expect(normal[sku]).toEqual(rows[sku]); expect(pilot[sku]).toEqual(rows[sku]); expect(builder?.[sku]).toEqual(rows[sku]); }
    });
});
