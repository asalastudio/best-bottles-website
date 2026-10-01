import { describe, expect, it } from "vitest";
import { stackedExplodeOffsets } from "@/lib/products/exploded-stack";

describe("EXPLODED stack", () => {
    it("lifts the closure and leaves a ring on the glass with the body (the Diva 46 jeweled rings, 2026-10-01)", () => {
        const body = { slot: "body", explodeIndex: 0, bounds: { left: 300, top: 200, right: 700, bottom: 1000 } };
        const ring = { slot: "ring", explodeIndex: 0, componentId: "LIB-18-415-DivaRngLvn", bounds: { left: 300, top: 420, right: 700, bottom: 500 } };
        const sprayer = { slot: "sprayer", explodeIndex: 1, componentId: "CMP-SPR-LVN-18-415-01", bounds: { left: 100, top: 50, right: 640, bottom: 380 } };
        const offsets = stackedExplodeOffsets([body, ring, sprayer]);
        expect(offsets.get(0)).toEqual({ dx: 0, dy: 0 });
        expect(offsets.get(1)).toEqual({ dx: 0, dy: 0 });
        expect(offsets.get(2)!.dy).toBeLessThan(0);
        // the sprayer stacks exactly as it does on the same glass without a ring
        expect(offsets.get(2)).toEqual(stackedExplodeOffsets([body, sprayer]).get(1));
    });
});
