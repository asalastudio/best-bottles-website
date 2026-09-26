import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compose, footY, frameFromDatum, frameFromLegacyKit, orderLayers, placeLayer, placePlate, placementStyle, shoulderLiftMm, type Frame, type LayerGeometry, type PlateGeometry } from "@/lib/register/compose";

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
        expect(order.front.map((l) => l.slot)).toEqual(["pump", "overcap", "collar"]);
        const stack = compose(plate, [collar, roller, overcap, pump], frame);
        expect(stack.map((p) => (p.kind === "plate" ? "plate" : (p.source as LayerGeometry).slot))).toEqual(["roller", "plate", "pump", "overcap", "collar"]);
        expect(stack.map((p) => p.zIndex)).toEqual([0, 1, 2, 3, 4]);
    });

    it("draws the overcap over the nozzle it covers (Jordan 2026-09-26), and over a one-piece sprayer with no collar", () => {
        const sprayer: LayerGeometry = { ...cap, slot: "sprayer", explodeIndex: 2 };
        const collar: LayerGeometry = { ...cap, slot: "collar", explodeIndex: 1 };
        const overcap: LayerGeometry = { ...cap, slot: "overcap", explodeIndex: 3 };
        expect(orderLayers([sprayer, collar, overcap]).front.map((l) => l.slot)).toEqual(["sprayer", "overcap", "collar"]);
        const oneCap: LayerGeometry = { ...cap, slot: "overcap", explodeIndex: 2 };
        const onePiece: LayerGeometry = { ...cap, slot: "sprayer", explodeIndex: 1 };
        expect(orderLayers([oneCap, onePiece]).front.map((l) => l.slot)).toEqual(["sprayer", "overcap"]);
    });

    it("lifts a closure that reaches past this plate's shoulder so it ends where the shoulder begins (Jordan 2026-09-26)", () => {
        // plate: 27.21 px/mm, seat 167, shoulder 13 mm under the rim; cap: 10 px/mm, anchor y 50, solid to row 200 = 15 mm under the rim
        const shouldered: PlateGeometry = { ...plate, anchors: { ...plate.anchors, shoulderY: plate.anchors.seatY + 13 * plate.pxPerMm } };
        const deep: LayerGeometry = { ...cap, pxPerMm: 10, anchor: { x: cap.anchor.x, y: 50 }, solidBottomY: 200 };
        const insert: LayerGeometry = { ...roller, pxPerMm: 10, anchor: { x: 10, y: 0 }, solidBottomY: 400 };  // behind the glass: never lifts
        expect(shoulderLiftMm(shouldered, [deep, insert])).toBeCloseTo(2, 6);
        const placed = compose(shouldered, [deep, insert], frame);
        const capAt = placed.find((p) => p.kind === "layer" && (p.source as LayerGeometry).slot === "cap")!;
        const insertAt = placed.find((p) => p.kind === "layer" && (p.source as LayerGeometry).slot === "roller")!;
        expect(capAt.y + 50 * capAt.scale).toBeCloseTo(frame.seatY - 2 * frame.pxPerMm, 6);
        expect(insertAt.y).toBeCloseTo(frame.seatY, 6);
        // a closure that ends above the shoulder, a plate with no shoulder mark, or a layer with no solid bottom: no lift
        expect(shoulderLiftMm(shouldered, [{ ...deep, solidBottomY: 150 }])).toBe(0);
        expect(shoulderLiftMm({ ...plate, anchors: { ...plate.anchors, shoulderY: null } }, [deep])).toBe(0);
        expect(shoulderLiftMm(shouldered, [{ ...deep, solidBottomY: undefined }])).toBe(0);
        expect(shoulderLiftMm(shouldered, [{ ...deep, usage: "exploded" }])).toBe(0);
    });

    it("expresses a placement as percentages of the stage box", () => {
        const style = placementStyle(placePlate(plate, frame, 0), frame);
        expect(style.position).toBe("absolute");
        expect(parseFloat(style.width)).toBeCloseTo((768 * frame.pxPerMm / plate.pxPerMm) / 1000 * 100, 6);
        expect(style.zIndex).toBe(0);
    });
});

describe("register compose: the pilot measurements compose without error", () => {
    const m = JSON.parse(readFileSync(resolve(__dirname, "..", "data", "register", "phase3", "pilot-measurements.json"), "utf8")) as {
        plates: PlateGeometry[]; components: { componentId: string; layers: LayerGeometry[] }[];
    };
    it("places every plate on the kit frame with its foot on the baseline and every layer's anchor on the seat, a front layer lifted clear of the shoulder", () => {
        for (const p of m.plates) {
            const frame = frameFromLegacyKit(kit, p);
            expect(footY(p, frame)).toBeCloseTo(1055, 6);
            for (const c of m.components) {
                const lift = shoulderLiftMm(p, c.layers) * frame.pxPerMm;
                expect(lift).toBeLessThan(1.5 * frame.pxPerMm);  // a nudge, never a jump
                for (const placed of compose(p, c.layers, frame)) {
                    if (placed.kind !== "layer") continue;
                    const layer = placed.source as LayerGeometry;
                    expect(placed.y + layer.anchor.y * placed.scale).toBeCloseTo(layer.z === "front" ? 279 - lift : 279, 6);
                    expect(placed.width).toBeGreaterThan(0);
                    expect(placed.width).toBeLessThan(1000);
                }
            }
        }
    });
});
