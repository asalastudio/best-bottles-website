import { describe, expect, it } from "vitest";
import { stageLayout, type KitLike, type StageView } from "@/lib/products/pdp-redesign/stage";

const views: StageView[] = ["sidecar", "capon", "exploded"];
const context = { family: "Vial", capacityMl: 2, color: "Clear", applicator: "Cap/Closure" };

// Registration bounds of the corrected local clear 2 ml body and its two source caps.
function vial(black = false, resolution = 1): KitLike {
    const bounds = (left: number, top: number, right: number, bottom: number) => ({
        left: left * resolution, top: top * resolution, right: right * resolution, bottom: bottom * resolution,
    });
    return {
        sku: black ? "GBVialClr2mlBlackCap" : "GBVialClr2mlWhtCap",
        canvas: { width: 1000 * resolution, height: 1100 * resolution },
        anchors: { axisX: 500 * resolution, neckAxisX: 500 * resolution, seatY: 286 * resolution, baselineY: 1001 * resolution },
        glassSizing: { heightPct: 40.24, baselinePct: 91 },
        parts: [
            { slot: "body", zOrder: 0, explodeIndex: 0, bounds: bounds(349.0590405904059, 103.17712177121781, 646.1180811808117, 998.468634686347),
                assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: 0 }, image: { url: "/body.png", width: 1196, height: 1315 } },
            { slot: "cap", zOrder: 1, explodeIndex: 1, bounds: black ? bounds(338, 83, 656, 289) : bounds(343, 75, 658, 287),
                assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: -211 * resolution }, image: { url: "/cap.webp", width: 1000, height: 1100 } },
        ],
    };
}

describe("reviewed product-page glass size", () => {
    it("holds the approved bare-glass height and baseline across cap colours and every view, with all parts visible", () => {
        const frames = [];
        for (const black of [false, true]) for (const view of views) {
            const kit = vial(black);
            const layout = stageLayout(kit, view, context)!;
            const body = kit.parts[0].bounds;
            const { scale, x, y } = layout.frame;
            expect((body.bottom - body.top) * scale / kit.canvas.height * 100).toBeCloseTo(40.24, 8);
            expect(y + body.bottom * scale / kit.canvas.height * 100).toBeCloseTo(91, 8);
            expect(x + kit.anchors.axisX * scale / kit.canvas.width * 100).toBeCloseTo(50, 8);
            expect(layout.baselinePct).toBe(91);
            for (const part of layout.parts) {
                const bounds = kit.parts.find(p => p.slot === part.slot)!.bounds;
                expect(y + (bounds.top / kit.canvas.height * 100 + part.dyPct) * scale).toBeGreaterThanOrEqual(0);
                expect(y + (bounds.bottom / kit.canvas.height * 100 + part.dyPct) * scale).toBeLessThanOrEqual(100);
                expect(x + (bounds.left / kit.canvas.width * 100 + part.dxPct) * scale).toBeGreaterThanOrEqual(0);
                expect(x + (bounds.right / kit.canvas.width * 100 + part.dxPct) * scale).toBeLessThanOrEqual(100);
            }
            frames.push(layout.frame);
        }
        for (const frame of frames) expect(frame).toEqual(frames[0]);
    });

    it("keeps the same on-screen glass size when the registration canvas is exported at twice the resolution", () => {
        for (const view of views) {
            const original = stageLayout(vial(), view, context)!;
            const doubled = stageLayout(vial(false, 2), view, context)!;
            expect(doubled.frame).toEqual(original.frame);
            expect(doubled.anchors.body).toEqual(original.anchors.body);
        }
    });

    it("retains existing framing for kits without a reviewed size or with an invalid size", () => {
        const kit = vial();
        delete kit.glassSizing;
        const original = stageLayout(kit, "sidecar", context)!;
        expect(original.frame.scale).toBe(0.95);
        expect(original.baselinePct).toBeUndefined();
        for (const heightPct of [0, -1, 95, Number.NaN]) {
            kit.glassSizing = { heightPct, baselinePct: 91 };
            const invalid = stageLayout(kit, "sidecar", context)!;
            expect(invalid.frame).toEqual(original.frame);
            expect(invalid.baselinePct).toBeUndefined();
        }
    });
});
