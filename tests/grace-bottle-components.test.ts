// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");

function product(overrides: { websiteSku: string; graceSku: string; itemName: string }) {
    return {
        websiteSku: overrides.websiteSku,
        graceSku: overrides.graceSku,
        category: "Glass Bottle",
        family: "Elegant",
        shape: "Round",
        color: "Clear",
        capacity: "30 ml",
        capacityMl: 30,
        capacityOz: null,
        applicator: "Fine Mist Sprayer" as const,
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
        webPrice1pc: 1.5,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: overrides.itemName,
        itemDescription: null,
        imageUrl: null,
        productUrl: null,
        dataGrade: "A",
        bottleCollection: null,
        fitmentStatus: null,
        components: [],
        graceDescription: null,
        verified: true,
        shopifyVariantId: null,
        shopifySellable: null,
    };
}

async function catalogWithOverlappingSkuNamespaces() {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
        await ctx.db.insert("products", product({
            websiteSku: "SHARED-SKU",
            graceSku: "CORRECT-GRACE",
            itemName: "Website SKU product",
        }));
        await ctx.db.insert("products", product({
            websiteSku: "WRONG-WEB",
            graceSku: "SHARED-SKU",
            itemName: "Grace namespace collision",
        }));
    });
    return t;
}

describe("grace.getBottleComponents identity resolution", () => {
    it("prefers a website SKU when the legacy bottleSku overlaps the Grace namespace", async () => {
        const t = await catalogWithOverlappingSkuNamespaces();

        const result = await t.query(api.grace.getBottleComponents, { bottleSku: "SHARED-SKU" });

        expect(result?.bottle).toMatchObject({
            websiteSku: "SHARED-SKU",
            graceSku: "CORRECT-GRACE",
            itemName: "Website SKU product",
        });
    });

    it("accepts an explicit website SKU for the server-initialized PDP path", async () => {
        const t = await catalogWithOverlappingSkuNamespaces();

        const result = await t.query(api.grace.getBottleComponents, { websiteSku: "SHARED-SKU" });

        expect(result?.bottle).toMatchObject({
            websiteSku: "SHARED-SKU",
            graceSku: "CORRECT-GRACE",
        });
    });
});
