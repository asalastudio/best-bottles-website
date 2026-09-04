import { describe, expect, it } from "vitest";
import { decoratedCapFinish } from "@/lib/products/decorated-cap-finish";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import { photoKeysForVariant } from "@/lib/products/closure-swatch-keys";

describe("dotted cap identity", () => {
    it.each([
        ["GBCyl9RollBlkDot", "Black"],
        ["GBCyl9MtlRollSlDot", "Silver"],
        ["GBCyl9RollPinkDot", "Pink"],
        ["GBPillar9MtlRollBlkdot", "Black"],
    ])("preserves the decoration for %s despite sparse cap data", (websiteSku, color) => {
        const variant = { websiteSku, capColor: "Clear", applicator: "Metal Roller Ball" };
        expect(decoratedCapFinish(variant)).toBe(`${color} with Dots`);
        expect(getCustomerFacingProductName({
            group: { family: "Cylinder", capacityMl: 9, color: "Clear", category: "Glass Bottle" }, variant,
        }).displayName).toBe(`9 ml Clear Cylinder Roll-On Bottle - ${color} with Dots Cap`);
    });

    it("distinguishes solid Black and Shiny Black from Black with Dots", () => {
        expect(decoratedCapFinish({ websiteSku: "GBCyl9RollBlk", capColor: "Black" })).toBeNull();
        expect(decoratedCapFinish({ websiteSku: "GBCyl9MtlRollShnBlk", capColor: "Clear" })).toBeNull();
        expect(decoratedCapFinish({ websiteSku: "GBCyl9RollBlkDot", capColor: "Black" })).toBe("Black with Dots");
    });

    it("recognizes legacy Grace tokens and explicit product descriptions", () => {
        expect(decoratedCapFinish({ graceSku: "GB-CYL-BLU-5ML-MRL-BKDT" })).toBe("Black with Dots");
        expect(decoratedCapFinish({ itemName: "Bottle with silver dot cap" })).toBe("Silver with Dots");
        expect(decoratedCapFinish({ capColor: "Pink with Dots" })).toBe("Pink with Dots");
    });

    it("retains the existing photo lookup key separately from the customer label", () => {
        const variant = { websiteSku: "GBCyl9RollBlkDot" };
        expect(decoratedCapFinish(variant)).toBe("Black with Dots");
        expect(photoKeysForVariant(variant)).toEqual(["Black"]);
    });
});
