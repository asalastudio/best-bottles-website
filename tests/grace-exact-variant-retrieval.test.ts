// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import { catalogVariantMatcher, detectCapacityMl, buildSearchCatalogToolResult } from "../convex/graceSearchUtils";

const modules = import.meta.glob("../convex/**/*.ts");
const targetSku = "GBElg15MtlRollSlSh";
const request = "clear 15ml Elegant metal roller with shiny-silver cap";
function product(sku: string, overrides: Partial<Doc<"products">> = {}) {
    return {
        websiteSku: sku, graceSku: sku === targetSku ? "GB-ELG-CLR-15ML-MRL-SSLV" : `GRACE-${sku}`,
        category: "Glass Bottle", family: "Elegant", shape: "Rectangle", color: "Clear",
        capacity: "15 ml", capacityMl: 15, capacityOz: null,
        applicator: "Plastic Roller Ball" as const, capColor: "Shiny Silver", trimColor: null, capStyle: null,
        neckThreadSize: "13-415", heightWithCap: null, heightWithoutCap: null, diameter: null,
        bottleWeightG: null, caseQuantity: null, qbPrice: null, webPrice1pc: 0.88,
        webPrice10pc: null, webPrice12pc: 0.84, stockStatus: "In Stock",
        itemName: "Elegant 15ml Clear roller bottle", itemDescription: null, imageUrl: null, productUrl: null,
        dataGrade: "A", bottleCollection: null, fitmentStatus: null, components: [], graceDescription: null,
        verified: true, shopifyVariantId: null, shopifySellable: null,
        ...overrides,
    };
}
async function fixture(includeMetal = true) {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
        const productGroupId = await ctx.db.insert("productGroups", {
            slug: "elegant-15ml-clear-13-415-rollon", displayName: "Elegant 15ml Clear Roll-on",
            family: "Elegant", capacity: "15 ml", capacityMl: 15, color: "Clear", category: "Glass Bottle",
            bottleCollection: null, neckThreadSize: "13-415", variantCount: 22, priceRangeMin: 0.8, priceRangeMax: 1,
            groupDescription: "Elegant clear roller bottle",
        });
        // Deliberately bury the correct row behind the old eight-row cutoff.
        for (let i = 0; i < 12; i++) await ctx.db.insert("products", product(i === 0 ? "GBElg15RollSlSh" : `plastic-${i}`, { productGroupId }));
        if (includeMetal) {
            for (let i = 0; i < 9; i++) await ctx.db.insert("products", product(`metal-gold-${i}`, { productGroupId, applicator: "Metal Roller Ball", capColor: "Shiny Gold" }));
            await ctx.db.insert("products", product(targetSku, {
                productGroupId, applicator: "Metal Roller Ball",
                priceTiers: [{ minQty: 12, unitPrice: 0.84, totalPrice: 10.08 }],
            }));
        }
    });
    return t;
}

describe("Grace exact material retrieval", () => {
    it.each([undefined, "Metal Roller Ball", "Metal Roller Ball,Plastic Roller Ball"])("finds the metal silver variant past the group cutoff, filter=%s", async (applicatorFilter) => {
        const t = await fixture();
        const rows = await t.query(api.grace.searchCatalog, { searchTerm: request, ...(applicatorFilter ? { applicatorFilter } : {}) });
        expect(rows.map((r) => r.websiteSku)).toEqual([targetSku]);
        expect(rows[0]).toMatchObject({ applicator: "Metal Roller Ball", color: "Clear", capacityMl: 15, capColor: "Shiny Silver", neckThreadSize: "13-415", webPrice12pc: 0.84 });
    });
    it("never merges structured plastic rows back through an explicit metal filter", async () => {
        const t = await fixture(false);
        expect(await t.query(api.grace.searchCatalog, { searchTerm: "15ml Elegant roller", applicatorFilter: "Metal Roller Ball" })).toEqual([]);
    });
    it("returns no match when exact metal criteria have only plastic or a different cap", async () => {
        const t = await fixture(false);
        expect(await t.query(api.grace.searchCatalog, { searchTerm: request })).toEqual([]);
        const withMetal = await fixture();
        expect(await withMetal.query(api.grace.searchCatalog, { searchTerm: "clear 15ml Elegant metal roller with matte black cap" })).toEqual([]);
    });
    it("does not substitute 15ml clear rows for an impossible 999ml Cobalt Elegant", async () => {
        const t = await fixture();
        expect(await t.query(api.grace.searchCatalog, { searchTerm: "Elegant 999ml Cobalt Blue roll-on 13-415" })).toEqual([]);
    });
    it("preserves exact website and Grace SKU lookup, neck, tier and link", async () => {
        const t = await fixture();
        for (const sku of [targetSku, "GB-ELG-CLR-15ML-MRL-SSLV"]) {
            const result = await t.query(api.products.lookupSku, { sku });
            expect(result?.product).toMatchObject({ websiteSku: targetSku, neckThreadSize: "13-415", priceTiers: [{ minQty: 12, unitPrice: 0.84, totalPrice: 10.08 }] });
            expect(result?.slug).toBe("elegant-15ml-clear-13-415-rollon");
        }
    });
    it("keeps broad roller browsing open to both materials", async () => {
        const t = await fixture();
        const rows = await t.query(api.grace.searchCatalog, { searchTerm: "15ml Elegant roller" });
        expect(new Set(rows.map((r) => r.applicator))).toEqual(new Set(["Metal Roller Ball", "Plastic Roller Ball"]));
    });
    it("rejects wrong dimensions and coverage candidates under exact material criteria", () => {
        const match = catalogVariantMatcher({ searchTerm: request });
        const correct = product(targetSku, { applicator: "Metal Roller Ball" });
        expect(match(correct)).toBe(true);
        for (const wrong of [{ color: "Frosted" }, { family: "Cylinder" }, { capacityMl: 9 }, { applicator: "Plastic Roller Ball" }, { capColor: "Shiny Gold" }]) {
            expect(match({ ...correct, ...wrong })).toBe(false);
        }
        expect(catalogVariantMatcher({ searchTerm: "roller bottle with metal cap" })(product("plastic"))).toBe(true);
        const both = catalogVariantMatcher({ searchTerm: "15ml Elegant metal or plastic rollers" });
        expect(both(product("plastic"))).toBe(true);
        expect(both(correct)).toBe(true);
    });
});

describe("Grace decimal millilitre sizes", () => {
    it.each([3.3, 1.5])("preserves %s ml in retrieval and model coverage", async (ml) => {
        expect(detectCapacityMl(`${ml}ml bottle`)).toBe(ml);
        const t = convexTest(schema, modules);
        await t.run(async (ctx) => {
            for (const size of [1.5, 3.3, 3, 5]) await ctx.db.insert("products", product(`size-${size}`, { capacityMl: size, capacity: `${size} ml`, itemName: `${size}ml roller bottle`, applicator: "Metal Roller Ball" }));
        });
        const rows = await t.query(api.grace.searchCatalog, { searchTerm: `${ml}ml metal roller` });
        expect(rows.map((r) => r.capacityMl)).toEqual([ml]);
        const formatted = buildSearchCatalogToolResult({ searchTerm: `${ml}ml bottle` }, [{ capacityMl: ml, neckThreadSize: "13-415" }]);
        expect(formatted).not.toContain("We do NOT stock");
    });
});
