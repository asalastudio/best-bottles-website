// @vitest-environment edge-runtime
/// <reference types="vite/client" />
/**
 * Order-pad product search.
 *
 * The bug this pins: searching "9ml roll metal" returned a 1 oz Boston round
 * first. Ranking by the search index alone scores term overlap and treats a
 * capacity as just another word, so "roll" and "metal" matched while "9ml" was
 * ignored. The pad now uses the storefront's matcher, which requires every
 * token to appear somewhere on the row.
 */

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");

type Fixture = {
    sku: string;
    itemName: string;
    capacityMl: number | null;
    capacity: string | null;
    category?: string;
    group?: string;
    variantId?: string | null;
    sellable?: boolean | null;
};

function product(f: Fixture) {
    return {
        websiteSku: f.sku,
        graceSku: `G-${f.sku}`,
        itemName: f.itemName,
        category: f.category ?? "Glass Bottle",
        family: "Cylinder",
        shape: null,
        color: "Clear",
        capacity: f.capacity,
        capacityMl: f.capacityMl,
        capacityOz: null,
        applicator: null,
        capColor: null,
        trimColor: null,
        capStyle: null,
        neckThreadSize: "18-415",
        heightWithCap: null,
        heightWithoutCap: null,
        diameter: null,
        bottleWeightG: null,
        caseQuantity: null,
        qbPrice: null,
        webPrice1pc: 1,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: null,
        itemDescription: null,
        imageUrl: null,
        productUrl: null,
        dataGrade: null,
        bottleCollection: null,
        fitmentStatus: null,
        components: null,
        graceDescription: null,
        verified: false,
        shopifyVariantId: f.variantId === undefined ? "gid://shopify/ProductVariant/1" : f.variantId,
        shopifySellable: f.sellable,
    };
}

const BOSTON_1OZ: Fixture = {
    sku: "GBBSTN1OZMTLROLLONBLK",
    itemName: "Boston round clear glass bottle with metal roll on and black cap, 1 oz capacity",
    capacityMl: 30,
    capacity: "30 ml (1.01 oz)",
};
const CYL_9ML_ROLLER: Fixture = {
    sku: "GBCYLSWRL9MTLROLLWHT",
    itemName: "Cylinder swirl design 9ml glass bottle with metal roller ball plug and white cap.",
    capacityMl: 9,
    capacity: "9 ml (0.3 oz)",
};
const CYL_50ML_ROLLER: Fixture = {
    sku: "GBCYL50MTLROLLBLK",
    itemName: "Cylinder style 50 ml bottle with metal roller ball plug and black cap.",
    capacityMl: 50,
    capacity: "50 ml (1.69 oz)",
};

async function seed(t: ReturnType<typeof convexTest>, rows: Fixture[]) {
    await t.run(async (ctx) => {
        for (const row of rows) {
            await ctx.db.insert("products", {
                ...product(row),
                productGroupId: undefined,
            } as never);
        }
    });
}

const search = (t: ReturnType<typeof convexTest>, term: string, limit = 8) =>
    t.query(api.products.searchForOrderPad, { term, limit });

describe("searchForOrderPad", () => {
    it("does not return the wrong capacity for a capacity-qualified query", async () => {
        const t = convexTest(schema, modules);
        await seed(t, [BOSTON_1OZ, CYL_50ML_ROLLER, CYL_9ML_ROLLER]);

        const results = await search(t, "9ml roll metal");
        expect(results.map((r) => r.sku)).toContain(CYL_9ML_ROLLER.sku);
        expect(results.map((r) => r.sku)).not.toContain(BOSTON_1OZ.sku);
        expect(results.map((r) => r.sku)).not.toContain(CYL_50ML_ROLLER.sku);
    });

    it("puts the exact SKU first even when other rows score well", async () => {
        const t = convexTest(schema, modules);
        await seed(t, [CYL_9ML_ROLLER, CYL_50ML_ROLLER, BOSTON_1OZ]);

        const results = await search(t, CYL_50ML_ROLLER.sku);
        expect(results[0]?.sku).toBe(CYL_50ML_ROLLER.sku);
    });

    it("ignores a term too short to mean anything", async () => {
        const t = convexTest(schema, modules);
        await seed(t, [CYL_9ML_ROLLER]);
        expect(await search(t, "9")).toEqual([]);
    });

    it("hides retired rows and rows Shopify cannot sell", async () => {
        const t = convexTest(schema, modules);
        await seed(t, [
            { ...CYL_9ML_ROLLER, sku: "GBCYL9__RETIRED__OLD" },
            { ...CYL_9ML_ROLLER, sku: "GBCYL9NOTSELLABLE", sellable: false },
        ]);
        expect(await search(t, "9ml roller")).toEqual([]);
    });

    it("marks a product with no Shopify variant as not orderable", async () => {
        const t = convexTest(schema, modules);
        await seed(t, [{ ...CYL_9ML_ROLLER, variantId: null }]);

        const results = await search(t, "9ml roller");
        expect(results).toHaveLength(1);
        expect(results[0].orderable).toBe(false);
    });
});
