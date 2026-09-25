import { describe, expect, it } from "vitest";
import { compose, footY, frameFromDatum, frameFromLegacyKit, orderLayers, placeLayer, placePlate, placementStyle, type Frame, type LayerGeometry, type PlateGeometry } from "@/lib/register/compose";

// The placement arithmetic is shared with the register lane (PR #270); its
// per-plate measurement suite lives there with data/register/phase3/.
const plate: PlateGeometry = { width: 768, height: 2304, pxPerMm: 27.2142, anchors: { axisX: 383, seatY: 167, shoulderY: 550, baselineY: 2176 } };
// The legacy 9 mL Cylinder kit frame on dev: 1000 × 1100, axis 500, seat 279, foot 1055.
const kit = { canvas: { width: 1000, height: 1100 }, anchors: { axisX: 500, seatY: 279, baselineY: 1055 } };
const cap: LayerGeometry = { slot: "cap", z: "front", explodeIndex: 1, width: 316, height: 431, pxPerMm: 15.7596, anchor: { x: 163.1, y: 203.5 } };
const roller: LayerGeometry = { slot: "roller", z: "behind-body", explodeIndex: 0, width: 172, height: 135, pxPerMm: 12.3676, anchor: { x: 91.5, y: 126 } };

describe("register compose: frames", () => {
    it("stands the plate on a legacy kit's seat and foot exactly", () => {
        const frame = frameFromLegacyKit(kit, plate);
        expect(frame.axisX).toBe(500);
        expect(frame.seatY).toBe(279);
        expect(footY(plate, frame)).toBeCloseTo(1055, 6);
        // 776 px for 73.82 mm of glass
        expect(frame.pxPerMm).toBeCloseTo(776 / ((2176 - 167) / 27.2142), 6);
        expect(frameFromDatum(kit.canvas, kit.anchors, plate)).toEqual(frame);
    });

    it("refuses a plate or kit whose seat is not above its foot", () => {
        expect(() => frameFromLegacyKit({ ...kit, anchors: { ...kit.anchors, baselineY: 279 } }, plate)).toThrow();
        expect(() => frameFromLegacyKit(kit, { ...plate, anchors: { ...plate.anchors, baselineY: 100 } })).toThrow();
    });
});

describe("register compose: placement", () => {
    const frame: Frame = frameFromLegacyKit(kit, plate);

    it("scales each image by the px/mm ratio and lands its anchor on the frame's seat", () => {
        const p = placePlate(plate, frame, 1);
        expect(p.scale).toBeCloseTo(frame.pxPerMm / plate.pxPerMm, 9);
        expect(p.x + plate.anchors.axisX * p.scale).toBeCloseTo(500, 6);
        expect(p.y + plate.anchors.seatY * p.scale).toBeCloseTo(279, 6);
        const c = placeLayer(cap, frame, 2);
        expect(c.scale).toBeCloseTo(frame.pxPerMm / cap.pxPerMm, 9);
        expect(c.x + cap.anchor.x * c.scale).toBeCloseTo(500, 6);
        expect(c.y + cap.anchor.y * c.scale).toBeCloseTo(279, 6);
        // A 17-415 cap from a 15.76 px/mm PSD and a 27.21 px/mm plate meet at one physical scale.
        expect((c.width / c.scale) / cap.pxPerMm).toBeCloseTo(cap.width / cap.pxPerMm, 6);
    });

    it("draws behind-body layers, then the plate, then front layers with the highest explodeIndex first", () => {
        const collar: LayerGeometry = { ...cap, slot: "collar", explodeIndex: 1 };
        const overcap: LayerGeometry = { ...cap, slot: "overcap", explodeIndex: 4 };
        const pump: LayerGeometry = { ...cap, slot: "pump", explodeIndex: 3 };
        const order = orderLayers([collar, roller, overcap, pump]);
        expect(order.behind.map((l) => l.slot)).toEqual(["roller"]);
        expect(order.front.map((l) => l.slot)).toEqual(["overcap", "pump", "collar"]);
        const stack = compose(plate, [collar, roller, overcap, pump], frame);
        expect(stack.map((p) => (p.kind === "plate" ? "plate" : (p.source as LayerGeometry).slot))).toEqual(["roller", "plate", "overcap", "pump", "collar"]);
        expect(stack.map((p) => p.zIndex)).toEqual([0, 1, 2, 3, 4]);
    });

    it("expresses a placement as percentages of the stage box", () => {
        const style = placementStyle(placePlate(plate, frame, 0), frame);
        expect(style.position).toBe("absolute");
        expect(parseFloat(style.width)).toBeCloseTo((768 * frame.pxPerMm / plate.pxPerMm) / 1000 * 100, 6);
        expect(style.zIndex).toBe(0);
    });
});
