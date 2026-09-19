import { expect, it } from "vitest";
import { layerCropStyle, previewFrame } from "@/lib/bottle-builder/preview-frame";

const anchors = { axisX: 500, seatY: 306, baselineY: 1051 };
const bounds = [{ left: 380, right: 625, top: 306, bottom: 1051 },
    { left: 430, right: 575, top: 10, bottom: 308 }];

it("keeps the complete sprayer above a short bottle inside the normal and expanded frame", () => {
    for (const expanded of [false, true]) {
        const frame = previewFrame(anchors, bounds, { scale: 1.18, expanded });
        for (const b of bounds) {
            expect(frame.x).toBeLessThan(b.left);
            expect(frame.y).toBeLessThan(b.top);
            expect(frame.x + frame.width).toBeGreaterThan(b.right);
            expect(frame.y + frame.height).toBeGreaterThan(b.bottom);
        }
    }
});

it("includes registered bulb hose and tassel bounds without stretching component geometry", () => {
    const hose = { left: -120, top: 80, right: 500, bottom: 1080 };
    const frame = previewFrame(anchors, [...bounds, hose], { expanded: true });
    expect(frame.x).toBeLessThan(hose.left);
    expect(frame.y + frame.height).toBeGreaterThan(hose.bottom);
});

it("centers the expanded frame on the bottle axis so zoom overlays do not sit left", () => {
    const frame = previewFrame(anchors, bounds, { expanded: true });
    expect(frame.x + frame.width / 2).toBeCloseTo(anchors.axisX);
    expect(frame.x).toBeLessThan(bounds[0].left);
    expect(frame.x + frame.width).toBeGreaterThan(bounds[0].right);
});

it("keeps thumbnail padding and normal bottle baseline conventions", () => {
    const frame = previewFrame(anchors, [bounds[0]], { thumbnail: true });
    expect(frame.width).toBe(frame.height);
    expect(frame.width).toBeCloseTo((1051 - 306) * 1.22);
});

it("crops a registered canvas layer to the same viewBox a chooser SVG would use", () => {
    const frame = { x: 100, y: 200, width: 400, height: 500 };
    const style = layerCropStyle({ width: 1000, height: 1100 }, frame);
    expect(parseFloat(style.left as string)).toBeCloseTo(-25);
    expect(parseFloat(style.top as string)).toBeCloseTo(-40);
    expect(parseFloat(style.width as string)).toBeCloseTo(250);
    expect(parseFloat(style.height as string)).toBeCloseTo(220);
});
