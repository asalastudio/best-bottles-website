import { describe, expect, it } from "vitest";
import { normalizeImportedCapColor } from "../src/lib/products/cap-finish-evidence";
import { getCustomerFacingProductName } from "../src/lib/products/customer-facing-names";
import { resolveGlassSiblingVariant } from "../src/lib/products/guided-variant-resolver";
const frosted = ["BlkMatt", "BlkSh", "BluMatt", "CuMatt", "GlMatt", "GlSh", "SlMatt", "SlSh"].map(finish => ({
    websiteSku: `GBTallCylFrst9Spry${finish}`, color: "Frosted", capColor: "Frosted", applicator: "Fine Mist Sprayer",
}));
describe("imported cap finish evidence", () => {
    it("keeps eight real Frosted sprayer finishes available on the PDP", () => {
        const variants = frosted.map(normalizeImportedCapColor);
        expect(new Set(variants.map(v => v.capColor)).size).toBe(8);
        const chosen = resolveGlassSiblingVariant(variants, { applicator: "Fine Mist Sprayer", capOption: "Matte Silver" }, {
            sku: v => v.websiteSku, applicator: v => v.applicator, capFinish: v => v.capColor,
        });
        expect(getCustomerFacingProductName({ group: { family: "Cylinder", capacityMl: 9, color: "Frosted", category: "Glass Bottle" }, variant: frosted[6] }).displayName).toContain("Matte Silver");
        expect(chosen?.websiteSku).toBe("GBTallCylFrst9SprySlMatt");
        expect(getCustomerFacingProductName({ group: { family: "Cylinder", capacityMl: 9, color: "Frosted", category: "Glass Bottle" }, variant: chosen }).displayName).toContain("Matte Silver");
    });
    it("preserves explicit component colors and unknown-SKU evidence", () => {
        const explicit = { ...frosted[0], capColor: "Shiny Black" };
        expect(normalizeImportedCapColor(explicit)).toBe(explicit);
        const unknown = { color: "Frosted", capColor: "Frosted", websiteSku: "unknown" };
        expect(normalizeImportedCapColor(unknown)).toBe(unknown);
    });
});
