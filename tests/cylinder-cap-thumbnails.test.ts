import { describe, expect, it } from 'vitest';
import thumbnails from '../src/lib/products/cylinder-cap-thumbnails.generated.json';
import reducerSources from '../docs/data-audit/cylinder-release-2026-09-04/reducer-thumbnail-sources.json';
const bySku: Record<string, string> = thumbnails;
describe('reviewed Cylinder cap-only picker photographs', () => {
    it('covers all 36 reviewed reducer assemblies without reusing standard photos for tall caps', () => {
        expect(reducerSources.rows).toHaveLength(36);
        for (const { sku } of reducerSources.rows) {
            expect(bySku[sku]).toMatch(/\/reviewed-cap-thumbs\/[a-f0-9]{64}\.webp$/);
        }
        for (const prefix of ['GBcyl25', 'GBCyl50', 'GBCyl100']) {
            expect(bySku[prefix + 'RdcrMtSlTall']).not.toBe(bySku[prefix + 'RdcrMtSl']);
            expect(bySku[prefix + 'RdcrShnBlkTall']).not.toBe(bySku[prefix + 'RdcrShnBlk']);
        }
    });
    it('covers all ten exact cap assemblies for both 5 mL bottle colors', () => {
        for (const prefix of ['GBCyl5', 'GBCylBlu5']) {
            for (const cap of ['BlkShSht', 'BlkSht', 'WhtSht', 'CuSht', 'GlMattSht', 'GlSht', 'SlMattSht', 'SlSht', 'Gl', 'Sl']) {
                expect(bySku[prefix + cap]).toMatch(/\/reviewed-cap-thumbs\/[a-f0-9]{64}\.webp$/);
            }
        }
    });
    it('keeps the short and regular gold/silver caps and the two black textures distinct', () => {
        for (const prefix of ['GBCyl5', 'GBCylBlu5']) {
            expect(bySku[prefix + 'Gl']).not.toBe(bySku[prefix + 'GlSht']);
            expect(bySku[prefix + 'Sl']).not.toBe(bySku[prefix + 'SlSht']);
            expect(bySku[prefix + 'BlkShSht']).not.toBe(bySku[prefix + 'BlkSht']);
        }
    });
});
