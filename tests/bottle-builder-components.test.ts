import { describe, expect, it, vi } from "vitest";
import { listedReplacementSku, resolveListedComponents, restoreListedComponent, type ActiveComponent } from "@/lib/bottle-builder/components";
import { assessBuilderConfiguration, reviewedFitmentImage, type BuilderConfiguration, type CatalogRow } from "@/lib/bottle-builder/model";
const sku = "CP13-415SpryBlkMt";
const part = { websiteSku: `${sku}__RETIRED__OLD__document`, graceSku: "OLD", shopifySellable: false, itemName: "Matte black sprayer", imageUrl: null, stockStatus: null, capColor: null, webPrice1pc: .65, webPrice12pc: .62, productGroupSlug: null, shopifyVariantId: "old" };
const active: ActiveComponent = { websiteSku: sku, graceSku: "CURRENT", neckThreadSize: "13-415", shopifyVariantId: "current", shopifySellable: true };
const row = { family: "Circle", capacityMl: 15, category: "Glass Bottle", color: "Clear", neckThreadSize: "13-415", websiteSku: "GBCrcl15SpryBlkMatt", graceSku: "BOTTLE", itemName: "Circle 15 ml spray", applicator: "Fine Mist Sprayer", capColor: "Matte Black", webPrice1pc: 1, shopifyVariantId: "bottle-variant", shopifySellable: true, resolution: "bottle_listed", productGroupSlug: "circle-15ml-clear-13-415-finemist", components: { Sprayer: [part] } } as unknown as CatalogRow;

describe("builder listed component replacement", () => {
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
