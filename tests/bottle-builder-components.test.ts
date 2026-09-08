import { describe, expect, it, vi } from "vitest";
import { listedReplacementSku, resolveListedComponents, restoreListedComponent, unavailableVintageFinishes, type ActiveComponent } from "@/lib/bottle-builder/components";
import { assessBuilderConfiguration, compatibleFinishComponent, reviewedFitmentImage, type BuilderConfiguration, type CatalogRow } from "@/lib/bottle-builder/model";
const sku = "CP13-415SpryBlkMt";
const part = { websiteSku: `${sku}__RETIRED__OLD__document`, graceSku: "OLD", shopifySellable: false, itemName: "Matte black sprayer", imageUrl: null, stockStatus: null, capColor: null, webPrice1pc: .65, webPrice12pc: .62, productGroupSlug: null, shopifyVariantId: "old" };
const active: ActiveComponent = { websiteSku: sku, graceSku: "CURRENT", neckThreadSize: "13-415", shopifyVariantId: "current", shopifySellable: true };
const row = { family: "Circle", capacityMl: 15, category: "Glass Bottle", color: "Clear", neckThreadSize: "13-415", websiteSku: "GBCrcl15SpryBlkMatt", graceSku: "BOTTLE", itemName: "Circle 15 ml spray", applicator: "Fine Mist Sprayer", capColor: "Matte Black", webPrice1pc: 1, shopifyVariantId: "bottle-variant", shopifySellable: true, resolution: "bottle_listed", productGroupSlug: "circle-15ml-clear-13-415-finemist", components: { Sprayer: [part] } } as unknown as CatalogRow;

describe("builder listed component replacement", () => {
    it("shows an exact out-of-stock vintage replacement without making it purchasable", () => {
        const retired = { ...part, websiteSku: "AnSp18-415Lvn__RETIRED__OLD__document" };
        const vintage: CatalogRow = { ...row, capacityMl: 50, neckThreadSize: "18-415", websiteSku: "GBCrcl50AnSpLvn", applicator: "Vintage Bulb Sprayer", components: { Sprayer: [retired] } };
        const replacement = { ...active, websiteSku: "AnSp18-415Lvn", neckThreadSize: "18-415", stockStatus: "Out of Stock", imageUrl: "https://example.com/lavender.webp" };
        const options = unavailableVintageFinishes(vintage, new Map([[replacement.websiteSku, replacement]]));
        expect(options).toEqual([{ id: vintage.websiteSku, color: "Clear", fitment: "Vintage Bulb Sprayer", closure: "Lavender", imageUrl: "/images/bottle-builder/components/AnSp18-415Lvn.png" }]);
        expect(restoreListedComponent(retired, replacement, "18-415")).toBe(retired);
        expect(assessBuilderConfiguration(vintage).configuration).toBeNull();
        for (const invalid of [
            { ...replacement, neckThreadSize: "13-415" }, { ...replacement, websiteSku: "AnSp18-415Red" },
            { ...replacement, stockStatus: "In Stock" }, { ...replacement, stockStatus: "Discontinued" },
            { ...replacement, imageUrl: null }, { ...replacement, graceSku: "OLD" },
        ]) expect(unavailableVintageFinishes(vintage, new Map([[replacement.websiteSku, invalid]]))).toEqual([]);
        expect(unavailableVintageFinishes({ ...vintage, components: {} }, new Map([[replacement.websiteSku, replacement]]))).toEqual([]);
        expect(unavailableVintageFinishes({ ...vintage, applicator: "Vintage Bulb Sprayer with Tassel" }, new Map([[replacement.websiteSku, replacement]]))).toEqual([]);
    });
    it("only extracts a retired alias tied to the original listed Grace identity", () => {
        expect(listedReplacementSku(part)).toBe(sku);
        expect(listedReplacementSku({ ...part, websiteSku: `${sku}__RETIRED__OTHER__document` })).toBeNull();
        expect(listedReplacementSku({ ...part, websiteSku: sku })).toBeNull();
    });
    it("resolves the exact website SKU while preserving component kind and bottle assembly identity", async () => {
        const lookup = vi.fn(async () => active);
        const [resolved] = await resolveListedComponents([row, row], lookup);
        expect(lookup).toHaveBeenCalledExactlyOnceWith(sku);
        expect(Object.keys(resolved.components)).toEqual(["Sprayer"]);
        expect(resolved.components.Sprayer[0].graceSku).toBe("CURRENT");
        expect(resolved.websiteSku).toBe(row.websiteSku);
        expect(resolved.shopifyVariantId).toBe("bottle-variant");
        expect(resolved.resolution).toBe("bottle_listed");
        expect(assessBuilderConfiguration(resolved).configuration?.product.websiteSku).toBe(row.websiteSku);
    });
    it.each([
        null, { ...active, websiteSku: "CP13-415SpryGlSh" }, { ...active, neckThreadSize: "18-415" },
        { ...active, shopifySellable: false }, { ...active, shopifyVariantId: null },
        { ...active, stockStatus: "Out of Stock" }, { ...active, graceSku: "OLD" },
    ])("retains rejection when the replacement is absent, mismatched or unavailable: %j", replacement => {
        expect(restoreListedComponent(part, replacement, "13-415")).toBe(part);
    });
    it("does not introduce unlisted compatible-looking components", async () => {
        const lookup = vi.fn(async () => active);
        const [resolved] = await resolveListedComponents([{ ...row, components: {} }], lookup);
        expect(lookup).not.toHaveBeenCalled();
        expect(resolved.components).toEqual({});
    });
    it("distinguishes unresolved compatibility from unavailable imagery and sale status", () => {
        expect(assessBuilderConfiguration(row).issue).toBe("compatibility_unresolved");
        const resolved = { ...row, components: { Sprayer: [restoreListedComponent(part, active, "13-415")] } };
        expect(assessBuilderConfiguration(resolved).issue).toBeNull();
        expect(assessBuilderConfiguration({ ...resolved, websiteSku: "UnreviewedSpryBlkMatt" }).issue).toBe("media_unavailable");
        expect(assessBuilderConfiguration({ ...resolved, shopifySellable: false }).issue).toBe("catalog_unavailable");
    });
    it("uses distinct mechanism photographs for metal and plastic rollers", () => {
        const config = { family: "Circle", capacityMl: 15, neck: "13-415" } as BuilderConfiguration;
        const metal = reviewedFitmentImage({ ...config, fitment: "Metal Roller" });
        const plastic = reviewedFitmentImage({ ...config, fitment: "Plastic Roller" });
        expect(metal?.url).toContain("fitment-metal-roller");
        expect(plastic?.url).toContain("fitment-plastic-roller");
        expect(reviewedFitmentImage({ ...config, neck: "18-415", fitment: "Metal Roller" })).toBeNull();
    });
});


describe("source-backed exact component matches", () => {
    const component = (websiteSku: string) => ({ ...part, websiteSku, graceSku: websiteSku, shopifySellable: true });
    const pump: CatalogRow = { ...row, family: "Cylinder", capacityMl: 50, neckThreadSize: "18-415", websiteSku: "LBCyl50LtnMtSl", applicator: "Lotion Pump", capColor: "Matte Silver", components: { "Lotion Pump": [component("Ltn18-415MtSl"), component("Ltn18-415MtSlCl")] } };
    it("distinguishes the standard matte silver pump from the clear-overcap assembly", () => {
        expect(compatibleFinishComponent(pump)?.websiteSku).toBe("Ltn18-415MtSl");
        expect(compatibleFinishComponent({ ...pump, websiteSku: "UnverifiedLtnMtSl" })).toBeNull();
        expect(compatibleFinishComponent({ ...pump, capacityMl: 100 })).toBeNull();
    });
    it("matches the two documented Circle 30 ml caps without globally treating gold as shiny gold", () => {
        const cap: CatalogRow = { ...row, capacityMl: 30, neckThreadSize: "15-415", applicator: null, capColor: "Gold", websiteSku: "GBCrcl30GlCap", components: { Cap: [component("CP15-415ShnGl"), component("CP15-415ShnSl")] } };
        expect(compatibleFinishComponent(cap)?.websiteSku).toBe("CP15-415ShnGl");
        expect(compatibleFinishComponent({ ...cap, websiteSku: "GBCrcl30SlCap", capColor: "Silver" })?.websiteSku).toBe("CP15-415ShnSl");
        expect(compatibleFinishComponent({ ...cap, websiteSku: "UnverifiedGlCap" })).toBeNull();
    });
    it("never bypasses availability, retirement, exact identity, or listed compatibility", () => {
        expect(compatibleFinishComponent({ ...pump, components: {} })).toBeNull();
        expect(compatibleFinishComponent({ ...pump, components: { "Lotion Pump": [component("Ltn18-415MtSlCl")] } })).toBeNull();
        for (const change of [{ shopifySellable: false }, { stockStatus: "Out of Stock" }, { websiteSku: "Ltn18-415MtSl__RETIRED__OLD__record" }]) {
            expect(compatibleFinishComponent({ ...pump, components: { "Lotion Pump": [{ ...component("Ltn18-415MtSl"), ...change }] } })).toBeNull();
        }
    });
});
