import { describe, expect, it } from 'vitest';
import { registerVintagePreview } from '@/lib/bottle-builder/preview-registration';
import type { BuilderConfiguration, BuilderKit, BuilderPart } from '@/lib/bottle-builder/model';

function config(id: string, left: number, top = 235, height = 745): BuilderConfiguration {
    const body = { slot: 'body', bounds: { left, right: left + 205, top, bottom: top + height }, image: { url: `https://example.com/${id}-body.webp` } } as BuilderPart;
    const sprayer = { slot: 'sprayer', bounds: { left: left - 239, right: left + 171, top: top - 158, bottom: top + 116 }, image: { url: `https://example.com/${id}-sprayer.webp` } } as BuilderPart;
    return { id, bodyId: 'cylinder-50ml|18-415|Glass Bottle', family: 'Cylinder', capacityMl: 50, neck: '18-415', color: 'Clear', fitment: 'Vintage Bulb Sprayer',
        kit: { completeness: 'full', anchors: { axisX: 500, seatY: top, baselineY: top + height }, parts: [body, sprayer] } as BuilderKit } as BuilderConfiguration;
}

describe('vintage bottle registration', () => {
    it('holds the same glass and viewport across offset and differently framed finishes', () => {
        const reference = config('bare', 400, 200, 800);
        // Source offsets reproduce the varying 50 ml vintage-kit registrations.
        for (const source of [config('black', 516), config('gold', 511), config('white', 513, 234), config('tassel', 430, 190, 900)]) {
            const before = JSON.stringify(source);
            const result = registerVintagePreview(source, source.kit!.parts, reference)!;
            expect(result.anchors).toEqual({ ...reference.kit!.anchors, axisX: 502.5 });
            expect(result.layers[0].part).toBe(reference.kit!.parts[0]);
            expect(result.layers[0].transform).toBeUndefined();
            expect(result.layers[1].part).toBe(source.kit!.parts[1]);
            const [x, y, scale] = result.layers[1].transform!.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!.map(Number);
            const sourceBody = source.kit!.parts[0].bounds;
            const target = reference.kit!.parts[0].bounds;
            expect((sourceBody.left + sourceBody.right) / 2 * scale + x).toBeCloseTo((target.left + target.right) / 2);
            expect(sourceBody.bottom * scale + y).toBeCloseTo(target.bottom);
            expect((sourceBody.right - sourceBody.left) * scale).toBeCloseTo(target.right - target.left);
            expect(JSON.stringify(source)).toBe(before);
        }
    });
    it('does not borrow glass across physical bottles, glass types or unseparated kits', () => {
        const source = config('black', 516);
        const reference = config('bare', 400);
        for (const mismatch of [{ bodyId: 'different-mold' }, { color: 'Frosted' }, { capacityMl: 100 }, { neck: '13-415' }, { family: 'Circle' }]) {
            expect(registerVintagePreview(source, source.kit!.parts, { ...reference, ...mismatch })).toBeNull();
        }
        expect(registerVintagePreview(source, source.kit!.parts)).toBeNull();
        expect(registerVintagePreview({ ...source, fitment: 'Metal Roller' }, source.kit!.parts, reference)).toBeNull();
        expect(registerVintagePreview({ ...source, kit: { ...source.kit!, completeness: 'capSplit' } }, source.kit!.parts, reference)).toBeNull();
    });
});
