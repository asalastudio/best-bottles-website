import { describe, expect, it } from 'vitest';
import { canonicalBody, neckSeatY, registerVintagePreview, seatPreviewLayers } from '@/lib/bottle-builder/preview-registration';
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
    it('reports the ground from the selected kit, not from the reference kit\'s own anchor', () => {
        // Empire 100 ml, 2026-09-20: the fixed body came from a kit recording baselineY 979 while its
        // glass ends at 1060. A sidecar overcap stood on 979 floated 80 px above the ground.
        const reference = config('bare', 400, 200, 800);
        reference.kit!.anchors.baselineY = 919;                 // wrong by 81 px; bounds.bottom is 1000
        const source = config('sprayer', 516);                  // own baseline = own glass bottom (980)
        const result = registerVintagePreview(source, source.kit!.parts, reference)!;
        expect(result.anchors.baselineY).toBe(919);
        expect(result.groundY).toBeCloseTo(reference.kit!.parts[0].bounds.bottom);
    });
    it('holds the one fixed body for a bottle that has one, even for the reference itself and with no reference', () => {
        // Empire 100 ml, 2026-09-20: every kit body carries the orifice reducer in its neck.
        const fixed = canonicalBody({ family: 'Empire', capacityMl: 100, color: 'Clear', neck: '18-415' })!;
        expect(fixed.part.image.url).toMatch(/^\/images\/bottle-builder\/bodies\/canonical\/empire-100-clear-18-415\.[0-9a-f]{12}\.webp$/);
        expect(fixed.part.bounds.top).toBeGreaterThan(fixed.anchors.seatY - 700);
        const source = { ...config('pump', 324, 247, 830), family: 'Empire', capacityMl: 100 } as BuilderConfiguration;
        const result = registerVintagePreview(source, source.kit!.parts)!;
        expect(result.layers[0].part).toBe(fixed.part);
        expect(result.layers[0].transform).toBeUndefined();
        expect(result.groundY).toBe(fixed.groundY);
        const [x, y, scale] = result.layers[1].transform!.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!.map(Number);
        const own = source.kit!.parts[0].bounds;
        expect((own.left + own.right) / 2 * scale + x).toBeCloseTo((fixed.part.bounds.left + fixed.part.bounds.right) / 2);
        expect(own.bottom * scale + y).toBeCloseTo(fixed.part.bounds.bottom);
        // a bottle without one is untouched
        expect(canonicalBody({ family: 'Cylinder', capacityMl: 50, color: 'Clear', neck: '18-415' })).toBeNull();
    });
    it('does not borrow glass across physical bottles, glass types or unseparated kits', () => {
        const source = config('black', 516);
        const reference = config('bare', 400);
        for (const mismatch of [{ bodyId: 'different-mold' }, { color: 'Frosted' }, { capacityMl: 100 }, { neck: '13-415' }, { family: 'Circle' }]) {
            expect(registerVintagePreview(source, source.kit!.parts, { ...reference, ...mismatch })).toBeNull();
        }
        expect(registerVintagePreview(source, source.kit!.parts)).toBeNull();
        // Every fitment keeps the bottle's one fixed body (Jordan, 2026-09-16): a roller
        // on the same physical bottle registers onto the reference glass, it is not refused.
        const roller = registerVintagePreview({ ...source, fitment: 'Metal Roller' }, source.kit!.parts, reference);
        expect(roller).not.toBeNull();
        expect(roller!.layers.find(layer => layer.part.slot === 'body')!.part).toBe(reference.kit!.parts.find(part => part.slot === 'body'));
        expect(registerVintagePreview(reference, reference.kit!.parts, reference)).toBeNull();
        expect(registerVintagePreview({ ...source, kit: { ...source.kit!, completeness: 'capSplit' } }, source.kit!.parts, reference)).toBeNull();
    });
});

function layer(slot: string, bounds: { left: number; top: number; right: number; bottom: number }) {
    return { part: { slot, bounds, image: { url: `https://example.com/${slot}.webp` } } as BuilderPart, bounds, transform: undefined };
}

describe('neck seating for fused spray and pump layers', () => {
    // Production GBCyl50SpryShnSl / GBCyl50SpryMtSl bounds (2026-09-20).
    const cyl50 = {
        anchors: { axisX: 500, seatY: 235, baselineY: 980 },
        body: { left: 399, top: 235, right: 605, bottom: 980 },
        sprayer: { left: 435, top: 110, right: 570, bottom: 352 },
        overcap: { left: 425, top: 90, right: 576, bottom: 352 },
        diptube: { left: 481, top: 353, right: 524, bottom: 945 },
    };
    // Production GBCyl100SpryShnSl.
    const cyl100 = {
        anchors: { axisX: 500, seatY: 157, baselineY: 1036 },
        body: { left: 411, top: 157, right: 592, bottom: 1036 },
        sprayer: { left: 449, top: 122, right: 554, bottom: 311 },
        pump: { left: 447, top: 122, right: 554, bottom: 311 },
    };
    // Production GBCyl9SpryBlk: actuator already on seatY, collar covers the neck.
    const cyl9 = {
        anchors: { axisX: 500, seatY: 278, baselineY: 1054 },
        body: { left: 394, top: 278, right: 609, bottom: 1054 },
        sprayer: { left: 421, top: 80, right: 578, bottom: 278 },
        overcap: { left: 407, top: 42, right: 592, bottom: 283 },
        collar: { left: 406, top: 265, right: 603, bottom: 429 },
    };

    it('lifts a 50 ml fused sprayer and overcap off the shoulder onto the neck finish', () => {
        const seated = seatPreviewLayers([
            layer('diptube', cyl50.diptube),
            layer('body', cyl50.body),
            layer('sprayer', cyl50.sprayer),
            layer('overcap', cyl50.overcap),
        ], cyl50.anchors);
        const seat = neckSeatY(cyl50.anchors);
        expect(seat).toBeCloseTo(235 + (980 - 235) * 0.08);
        const sprayer = seated.find(l => l.part.slot === 'sprayer')!;
        const overcap = seated.find(l => l.part.slot === 'overcap')!;
        expect(sprayer.bounds.bottom).toBeCloseTo(seat);
        expect(overcap.bounds.bottom).toBeCloseTo(seat);
        expect(sprayer.bounds.top).toBeCloseTo(cyl50.sprayer.top + (seat - cyl50.sprayer.bottom));
        expect(sprayer.transform).toBe(`translate(0 ${seat - cyl50.sprayer.bottom})`);
        expect(seated.find(l => l.part.slot === 'body')!.bounds).toEqual(cyl50.body);
        expect(seated.find(l => l.part.slot === 'diptube')!.bounds).toEqual(cyl50.diptube);
        expect(seated.find(l => l.part.slot === 'diptube')!.transform).toBeUndefined();
    });

    it('lifts 100 ml spray and lotion-pump layers through the same path', () => {
        const spray = seatPreviewLayers([
            layer('body', cyl100.body),
            layer('sprayer', cyl100.sprayer),
        ], cyl100.anchors);
        const lotion = seatPreviewLayers([
            layer('body', cyl100.body),
            layer('pump', cyl100.pump),
        ], cyl100.anchors);
        const seat = neckSeatY(cyl100.anchors);
        expect(spray.find(l => l.part.slot === 'sprayer')!.bounds.bottom).toBeCloseTo(seat);
        expect(lotion.find(l => l.part.slot === 'pump')!.bounds.bottom).toBeCloseTo(seat);
    });

    it('does not move a 9 ml actuator already on seatY, or its collar', () => {
        const seated = seatPreviewLayers([
            layer('body', cyl9.body),
            layer('sprayer', cyl9.sprayer),
            layer('overcap', cyl9.overcap),
            layer('collar', cyl9.collar),
        ], cyl9.anchors);
        expect(seated.find(l => l.part.slot === 'sprayer')!.bounds).toEqual(cyl9.sprayer);
        expect(seated.find(l => l.part.slot === 'sprayer')!.transform).toBeUndefined();
        expect(seated.find(l => l.part.slot === 'overcap')!.bounds).toEqual(cyl9.overcap);
        expect(seated.find(l => l.part.slot === 'collar')!.bounds).toEqual(cyl9.collar);
    });

    it('does not lift a vintage bulb or tassel that is wider than the glass', () => {
        const vintage = layer('sprayer', { left: 277, top: 77, right: 687, bottom: 351 });
        const tassel = layer('sprayer', { left: 161, top: 126, right: 797, bottom: 940 });
        const body = layer('body', { left: 516, top: 235, right: 721, bottom: 980 });
        expect(seatPreviewLayers([body, vintage], cyl50.anchors)[1].bounds).toEqual(vintage.bounds);
        expect(seatPreviewLayers([body, tassel], cyl50.anchors)[1].bounds).toEqual(tassel.bounds);
    });

    it('does not lift a roller cap that covers the housing', () => {
        const cap = layer('cap', { left: 404, top: 152, right: 597, bottom: 427 });
        const seated = seatPreviewLayers([layer('body', cyl9.body), cap], cyl9.anchors);
        expect(seated.find(l => l.part.slot === 'cap')!.bounds).toEqual(cap.bounds);
    });

    it('seats after vintage width/baseline registration so a spray finish keeps the fixed glass', () => {
        const source = config('silver-spray', 399);
        source.fitment = 'Perfume Sprayer';
        source.kit!.parts = [
            { slot: 'body', bounds: cyl50.body, image: { url: 'https://example.com/spray-body.webp' } } as BuilderPart,
            { slot: 'sprayer', bounds: cyl50.sprayer, image: { url: 'https://example.com/spray-sprayer.webp' } } as BuilderPart,
        ];
        const reference = config('bare', 516);
        const registered = registerVintagePreview(source, source.kit!.parts, reference)!;
        const seated = seatPreviewLayers(registered.layers, registered.anchors);
        const body = seated.find(l => l.part.slot === 'body')!;
        const sprayer = seated.find(l => l.part.slot === 'sprayer')!;
        expect(body.part).toBe(reference.kit!.parts[0]);
        expect(body.transform).toBeUndefined();
        expect(sprayer.bounds.bottom).toBeCloseTo(neckSeatY(registered.anchors));
        expect(sprayer.transform).toMatch(/^translate\(0 /);
    });
});
