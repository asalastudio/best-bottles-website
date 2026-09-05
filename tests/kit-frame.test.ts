import { describe, expect, it } from "vitest";
import { explodedKitFrame } from "../src/lib/products/kit-frame";
describe("exploded kit framing", () => {
    it("keeps a lifted closure and hanging tassel inside the stage without changing individual part proportions", () => {
        const parts = [
            { bounds: { left: 350, top: 300, right: 650, bottom: 1060 }, exploded: { dx: 0, dy: 0 } },
            { bounds: { left: 80, top: 60, right: 700, bottom: 750 }, exploded: { dx: 0, dy: -900 } },
        ];
        const frame = explodedKitFrame(parts);
        for (const p of parts) {
            expect((p.bounds.top + p.exploded.dy) * frame.scale + frame.y * 11).toBeGreaterThanOrEqual(23.99);
            expect((p.bounds.bottom + p.exploded.dy) * frame.scale + frame.y * 11).toBeLessThanOrEqual(1076.01);
        }
    });
});
