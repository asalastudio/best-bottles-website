// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
const modules = import.meta.glob("../convex/**/*.ts");
const reconcile = makeFunctionReference<"mutation">("cylinderRelease:reconcile");
const base = { dryRun: true, products: [], groups: [], newGroups: [], newProducts: [] };
const product = {
    websiteSku: "EXACT", graceSku: "GRACE", family: "Cylinder", category: "Glass Bottle",
    shape: null, color: "Clear", capacity: "5.5 ml", capacityMl: 5.5, capacityOz: null,
    applicator: null, capColor: null, trimColor: null, capStyle: null, neckThreadSize: "13-415",
    heightWithCap: null, heightWithoutCap: null, diameter: null, bottleWeightG: null, caseQuantity: null,
    qbPrice: null, webPrice1pc: 1, webPrice10pc: null, webPrice12pc: null, stockStatus: null,
    itemName: "Cylinder", itemDescription: null, productUrl: null, dataGrade: null,
    bottleCollection: null, fitmentStatus: null, components: [], graceDescription: null, verified: true,
    shopifyVariantId: "gid://shopify/ProductVariant/123",
};
describe("bounded Cylinder catalog release", () => {
    it("dry-runs, then changes the approved field while retaining the record ID and Shopify link", async () => {
        const t = convexTest(schema, modules);
        const id = await t.run(ctx => ctx.db.insert("products", product));
        const args = { ...base, products: [{ id, expected: { capacityMl: 5.5 }, set: { capacityMl: 5 } }] };
        await t.mutation(reconcile, args);
        expect((await t.run(ctx => ctx.db.get(id)))?.capacityMl).toBe(5.5);
        await t.mutation(reconcile, { ...args, dryRun: false });
        const updated = await t.run(ctx => ctx.db.get(id));
        expect(updated).toMatchObject({ _id: id, websiteSku: "EXACT", graceSku: "GRACE", capacityMl: 5, shopifyVariantId: product.shopifyVariantId });
        await t.mutation(reconcile, { ...args, dryRun: false });
        expect(await t.run(ctx => ctx.db.query("products").collect())).toHaveLength(1);
    });
    it("refuses stale before-values and forbidden identity changes", async () => {
        const t = convexTest(schema, modules);
        const id = await t.run(ctx => ctx.db.insert("products", product));
        await expect(t.mutation(reconcile, { ...base, dryRun: false, products: [{ id, expected: { capacityMl: 9 }, set: { capacityMl: 5 } }] })).rejects.toThrow("Concurrent change");
        await expect(t.mutation(reconcile, { ...base, dryRun: false, products: [{ id, expected: { websiteSku: "EXACT" }, set: { websiteSku: "REPLACED" } }] })).rejects.toThrow("Forbidden field");
    });
});
