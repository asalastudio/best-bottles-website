import { describe, expect, it } from 'vitest';
import approved from '@/lib/paper-doll/approved-kits.generated.json';
import release from '@/lib/paper-doll/cylinder-jumbo-overcap.generated.json';
import index from '@/lib/paper-doll/cylinder-jumbo-overcap-index.json';
import { stageLayout, type KitLike, type StageView } from '@/lib/products/pdp-redesign/stage';

const existing = approved.rows as unknown as Record<string, KitLike>;
const updated = release.rows as unknown as Record<string, KitLike>;
const sizes = [
    ['GBCyl50MtlRollBlk', 'GBMtlRoll28Blk'],
    ['GBCyl50MtlRollWht', 'GBMtlRoll28Wht'],
    ['GBCyl50RollBlk', 'GBRoll28Blk'],
    ['GBCyl50RollWht', 'GBCyl1ozRollWht'],
];
const visible = (kit: KitLike, sku: string, view: StageView) => stageLayout(kit, view, { websiteSku: sku })!.parts;

describe('50 ml jumbo rolls and 25 ml clear lotion overcap', () => {
    it('indexes exactly the intended five SKUs', () => {
        expect(index.version).toBe(release.version);
        expect([...index.skus].sort()).toEqual([...sizes.map(([sku]) => sku), 'LBcyl25LtnClOvrCap'].sort());
        expect(Object.keys(updated).sort()).toEqual([...index.skus].sort());
    });

    it('shows just the approved metal and plastic 16 mm fitments across both cap colors in every view', () => {
        const rollers = new Set<string>();
        for (const [sku, reference] of sizes) {
            const kit = updated[sku];
            expect(kit.register?.bodyId).toBe('cylinder-50ml-16mm');
            for (const view of ['sidecar', 'capon', 'exploded'] as const) {
                const rendered = visible(kit, sku, view);
                const approvedParts = visible(existing[reference], reference, view);
                for (const slot of ['roller', 'cap']) {
                    const expected = approvedParts.filter(part => part.slot === slot).map(part => part.url);
                    expect(expected).toHaveLength(1);
                    expect(rendered.filter(part => part.slot === slot).map(part => part.url)).toEqual(expected);
                }
                expect(rendered.find(part => part.slot === 'body')!.url)
                    .not.toBe(approvedParts.find(part => part.slot === 'body')!.url);
                rollers.add(rendered.find(part => part.slot === 'roller')!.url);
            }
        }
        expect(rollers.size).toBe(2);
    });

    it('moves only the hollow shell on the clear-overcap pump', () => {
        const sku = 'LBcyl25LtnClOvrCap';
        const sidecar = visible(updated[sku], sku, 'sidecar'), capped = visible(updated[sku], sku, 'capon');
        expect(capped.filter(part => part.slot !== 'overcap')).toEqual(sidecar.filter(part => part.slot !== 'overcap'));
        for (const view of [sidecar, capped, visible(updated[sku], sku, 'exploded')]) {
            expect(view.map(part => part.slot).sort()).toEqual(['body', 'diptube', 'overcap', 'pump']);
            expect(view.find(part => part.slot === 'overcap')!.url).toMatch(/ltn-18-415-clear-overcap\.webp$/);
        }
        const parked = sidecar.find(part => part.slot === 'overcap')!;
        const on = capped.find(part => part.slot === 'overcap')!;
        expect(parked.dxPct).toBeGreaterThan(on.dxPct);
        expect(on.key).toEqual(parked.key);
        expect(on.opacity).toBeLessThan(1);
    });
});
