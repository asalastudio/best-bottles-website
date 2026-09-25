import { describe, expect, it } from "vitest";
import { availableViews, closurePart, effectiveView, partCrop, stageLayout, type KitLike } from "@/lib/products/pdp-redesign/stage";

/** The published cobalt 9 ml metal roll-on kit (GBCylBlu9MtlRollBlkDot on dev), parts as stored. */
const KIT: KitLike = {
    sku: "GBCylBlu9MtlRollBlkDot",
    canvas: { width: 1000, height: 1100 },
    anchors: { axisX: 500, neckAxisX: 500, seatY: 283, baselineY: 1057 },
    parts: [
        { slot: "roller", zOrder: 1, explodeIndex: 1, bounds: { left: 424, top: 186, right: 575, bottom: 307 }, assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: -181 }, image: { url: "https://blob/roller.webp", width: 1000, height: 1100 } },
        { slot: "body", zOrder: 0, explodeIndex: 0, bounds: { left: 402, top: 283, right: 605, bottom: 1057 }, assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: 0 }, image: { url: "https://blob/body.webp", width: 1000, height: 1100 } },
        { slot: "cap", zOrder: 2, explodeIndex: 2, bounds: { left: 400, top: 144, right: 604, bottom: 427 }, assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: -455 }, image: { url: "https://blob/cap.webp", width: 1000, height: 1100 } },
    ],
};

const CONTEXT = { family: "Cylinder", capacityMl: 9, color: "Cobalt Blue", applicator: "Metal Roller Ball", websiteSku: "GBCylBlu9MtlRollBlkDot" };

describe("views", () => {
    it("offers all three views for a kitted roll-on and only SIDECAR without a kit", () => {
        expect(availableViews(KIT, CONTEXT)).toEqual(["sidecar", "capon", "exploded"]);
        expect(availableViews(null, CONTEXT)).toEqual(["sidecar"]);
    });

    it("keeps assembled closures assembled and never explodes a Boston roller", () => {
        const dropper = { ...CONTEXT, applicator: "Dropper" };
        expect(effectiveView("sidecar", KIT, dropper)).toBe("capon");
        expect(effectiveView("exploded", KIT, dropper)).toBe("capon");
        expect(availableViews(KIT, { ...CONTEXT, family: "Boston Round" })).toEqual(["sidecar", "capon"]);
    });
});

describe("layout", () => {
    it("paints every part in z order at its assembled position for CAP ON", () => {
        const layout = stageLayout(KIT, "capon", CONTEXT)!;
        expect(layout.parts.map((part) => part.slot)).toEqual(["body", "roller", "cap"]);
        expect(layout.parts.every((part) => part.dxPct === 0 && part.dyPct === 0)).toBe(true);
        expect(layout.baseline).toBe(true);
        expect(layout.grid).toBe(false);
        expect(layout.frame.scale).toBeGreaterThan(0);
        expect(layout.frame.scale).toBeLessThanOrEqual(1);
    });

    it("parks only the cap beside the glass for SIDECAR and keeps the glass where CAP ON had it", () => {
        const capOn = stageLayout(KIT, "capon", CONTEXT)!;
        const sidecar = stageLayout(KIT, "sidecar", CONTEXT)!;
        expect(sidecar.frameCss).toBe(capOn.frameCss);
        const cap = sidecar.parts.find((part) => part.slot === "cap")!;
        const body = sidecar.parts.find((part) => part.slot === "body")!;
        const roller = sidecar.parts.find((part) => part.slot === "roller")!;
        expect(cap.dxPct).toBeGreaterThan(0);
        // the detached cap's foot lands on the glass baseline: 1057 - 427 = 630 px down
        expect(cap.dyPct).toBeCloseTo((1057 - 427) / 11, 5);
        expect(body.dxPct).toBe(0);
        expect(roller.dyPct).toBe(0);
    });

    it("lifts each part by its own exploded offset and turns the callouts on", () => {
        const layout = stageLayout(KIT, "exploded", CONTEXT)!;
        const cap = layout.parts.find((part) => part.slot === "cap")!;
        const roller = layout.parts.find((part) => part.slot === "roller")!;
        expect(cap.dyPct).toBeCloseTo(-455 / 11, 5);
        expect(roller.dyPct).toBeCloseTo(-181 / 11, 5);
        expect(layout.grid).toBe(true);
        expect(layout.baseline).toBe(false);
        expect(Object.keys(layout.anchors).sort()).toEqual(["body", "cap", "fitment", "neck"]);
        // anchors sit inside the canvas box and read top to bottom: cap, fitment, neck, body
        for (const anchor of Object.values(layout.anchors)) {
            expect(anchor!.xPct).toBeGreaterThan(0);
            expect(anchor!.xPct).toBeLessThan(100);
            expect(anchor!.yPct).toBeGreaterThan(0);
            expect(anchor!.yPct).toBeLessThan(100);
        }
        expect(layout.anchors.cap!.yPct).toBeLessThan(layout.anchors.fitment!.yPct);
        expect(layout.anchors.fitment!.yPct).toBeLessThan(layout.anchors.neck!.yPct);
        expect(layout.anchors.neck!.yPct).toBeLessThan(layout.anchors.body!.yPct);
    });

    it("returns nothing without a kit, so the stage falls back to the photograph", () => {
        expect(stageLayout(null, "capon", CONTEXT)).toBeNull();
    });
});

describe("crops", () => {
    it("scales a full-canvas layer so its bounds fill the requested height", () => {
        const cap = closurePart(KIT)!;
        expect(cap.slot).toBe("cap");
        const crop = partCrop(cap, KIT.canvas, 48);
        const scale = 48 / (427 - 144);
        expect(crop.height).toBe(48);
        expect(crop.width).toBeCloseTo((604 - 400) * scale, 5);
        expect(crop.imgWidth).toBeCloseTo(1000 * scale, 5);
        expect(crop.left).toBeCloseTo(-400 * scale, 5);
        expect(crop.top).toBeCloseTo(-144 * scale, 5);
    });
});
