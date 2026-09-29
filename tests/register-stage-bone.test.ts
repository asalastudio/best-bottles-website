import { describe, expect, it } from "vitest";
import { hasRegisterBodyPlate } from "@/lib/products/register-stage-bone";

describe("register body stage background", () => {
    it("uses bone for a measured register body plate", () => {
        expect(hasRegisterBodyPlate([
            { slot: "body", box: { x: 10, y: 20, width: 100, height: 200 } },
            { slot: "cap" },
        ])).toBe(true);
    });

    it("preserves the legacy stage for full-canvas parts", () => {
        expect(hasRegisterBodyPlate([{ slot: "body" }, { slot: "cap" }])).toBe(false);
        expect(hasRegisterBodyPlate([{ slot: "cap", box: { x: 0 } }])).toBe(false);
        expect(hasRegisterBodyPlate(null)).toBe(false);
    });
});
