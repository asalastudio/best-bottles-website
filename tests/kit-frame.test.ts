import { describe, expect, it } from "vitest";
import { explodedKitFrame, orderExplodedOvercap } from "../src/lib/products/kit-frame";
describe("exploded kit framing", () => {
    it.each(["pump", "sprayer"])("places the overcap above the %s while preserving the photographed parts and stack envelope", (slot) => {
        const part = (slot: string, top: number, bottom: number, dy: number) => ({
            slot, bounds: { left: 427, right: 575, top, bottom }, exploded: { dx: 0, dy },
        });
        const parts = [part("body", 157, 1036, 0), part(slot, 86, 293, -1131),
            part("overcap", 71, 295, -885), part("diptube", 292, 991, -858)];
        const before = structuredClone(parts);
        const corrected = orderExplodedOvercap(parts);
        const [, mechanism, cap] = corrected;
        expect(cap.bounds.bottom + cap.exploded.dy + 24).toBe(mechanism.bounds.top + mechanism.exploded.dy);
        expect(cap.bounds.top + cap.exploded.dy).toBe(-1045);
        expect(mechanism.bounds.bottom + mechanism.exploded.dy).toBe(-590);
        expect(corrected[0]).toBe(parts[0]);
        expect(corrected[3]).toBe(parts[3]);
        expect(parts).toEqual(before);
        expect(corrected.map(p => p.bounds)).toEqual(parts.map(p => p.bounds));
        expect(explodedKitFrame(corrected)).toEqual(explodedKitFrame(parts));
        expect(orderExplodedOvercap(corrected)).toEqual(corrected);
        expect(orderExplodedOvercap(parts.filter(p => p.slot !== "overcap"))).toEqual(parts.filter(p => p.slot !== "overcap"));
    });
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
