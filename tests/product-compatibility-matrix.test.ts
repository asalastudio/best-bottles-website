// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");

function product(family: string, graceSku: string) {
    return {
        websiteSku: `${graceSku}-WEB`,
        graceSku,
        category: "Glass Bottle",
        family,
        shape: "Cylinder",
        color: "Clear",
        capacity: "10 ml",
        capacityMl: 10,
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
        webPrice1pc: 1.5,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: `${family} bottle`,
        itemDescription: null,
        productUrl: null,
        dataGrade: "A",
        bottleCollection: null,
        fitmentStatus: null,
        components: [],
        graceDescription: null,
        verified: true,
    };
}

function group(family: string) {
    return {
        slug: family.toLowerCase().replaceAll(" ", "-"),
        displayName: family,
        family,
        capacity: "10 ml",
        capacityMl: 10,
        color: "Clear",
        category: "Glass Bottle",
        bottleCollection: null,
        neckThreadSize: "18-415",
        variantCount: 1,
        priceRangeMin: 1.5,
        priceRangeMax: 1.5,
    };
}

describe("customer Product Compatibility Matrix families", () => {
    it("returns only families backed by products and never exposes Unknown", async () => {
        const t = convexTest(schema, modules);
        await t.run(async (ctx) => {
            await ctx.db.insert("productGroups", group("Apothecary"));
            await ctx.db.insert("productGroups", group("Cylinder"));
            await ctx.db.insert("productGroups", group("Unknown"));
            await ctx.db.insert("products", product("Cylinder", "GB-CYL-10"));
            await ctx.db.insert("products", product("Unknown", "GB-UNK-10"));
        });

        await expect(t.query(api.matrix.listFamilies, {})).resolves.toEqual([
            { family: "Cylinder", groups: 1 },
        ]);
        await expect(t.query(api.matrix.listFamilies, { includeEmpty: true })).resolves.toEqual([
            { family: "Apothecary", groups: 1 },
            { family: "Cylinder", groups: 1 },
            { family: "Unknown", groups: 1 },
        ]);
    });
});
