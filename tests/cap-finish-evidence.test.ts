import { describe, expect, it } from "vitest";
import { capOptions, derivePicks, resolveVariant } from "../src/lib/products/pdp-redesign/model";
import type { ProductVariant } from "../src/app/products/[slug]/ProductDetailClient";
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
    it("keeps both amber 2 ml cap SKUs selectable despite the imported Clear finish", () => {
        const variants = ["GBVAmb2BlackCap", "GBVAmb2WhtCap"].map(websiteSku => ({
            _id: websiteSku, websiteSku, color: "Amber", capColor: "Clear", applicator: null,
        } as ProductVariant));
        expect(capOptions(variants, null).map(o => o.id)).toEqual(["black", "white"]);
        const group = { primaryWebsiteSku: "GBVAmb2BlackCap", primaryGraceSku: null };
        for (const [cap, sku] of [["black", "GBVAmb2BlackCap"], ["white", "GBVAmb2WhtCap"]]) {
            expect(resolveVariant(variants, derivePicks(variants, group, { cap }))?.websiteSku).toBe(sku);
        }
        expect(resolveVariant(variants, derivePicks(variants, group, { cap: "clear" }))?.websiteSku).toBe("GBVAmb2BlackCap");
        const explicit = { ...variants[0], capColor: "Shiny Black" };
        expect(normalizeImportedCapColor(explicit)).toBe(explicit);
        const unrelated = { websiteSku: "unrelated", color: "Amber", capColor: "Clear" };
        expect(normalizeImportedCapColor(unrelated)).toBe(unrelated);
    });
    it.each([
        ["Clear", "GBV1DrmBlackCapSht", "GBV1DrmWhtCapSht"],
        ["Amber", "GBVAmb1DrmBlackCapSht", "GBVAmb1DrmWhtCapSht"],
        ["Blue", "GBVBlu1DrmBlackCapSht", "GBVBlu1DrmWhtCapSht"],
        ["Cobalt Blue", "GBVBlu1DrmBlackCapSht", "GBVBlu1DrmWhtCapSht"],
        ["Green", "GBVGr1DrmBlackCapSht", "GBVGr1DrmWhtCapSht"],
    ])("keeps both %s 1 dram cap SKUs distinct", (color, black, white) => {
        const variants = [black, white].map(websiteSku => ({
            _id: websiteSku, websiteSku, color, capColor: "Clear", applicator: null, capStyle: "Short",
        } as ProductVariant));
        expect(capOptions(variants, null).map(o => o.id)).toEqual(["black", "white"]);
        for (const [cap, sku] of [["black", black], ["white", white]]) {
            expect(resolveVariant(variants, { cap, roller: null })?.websiteSku).toBe(sku);
        }
    });
    it("preserves explicit component colors and unknown-SKU evidence", () => {
        const explicit = { ...frosted[0], capColor: "Shiny Black" };
        expect(normalizeImportedCapColor(explicit)).toBe(explicit);
        const unknown = { color: "Frosted", capColor: "Frosted", websiteSku: "unknown" };
        expect(normalizeImportedCapColor(unknown)).toBe(unknown);
    });
});
