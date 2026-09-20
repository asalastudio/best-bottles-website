// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const restoreProducts = makeFunctionReference<"mutation">("catalogRestore:restoreProductFields");
const restoreGroups = makeFunctionReference<"mutation">("catalogRestore:restoreGroupFields");
const removeShells = makeFunctionReference<"mutation">("catalogRestore:removeWebhookShellRows");

const base = {
    websiteSku: "GBEmp100RdcrShnGl", graceSku: "GB-EMP-CLR-100ML-RDC-SGLD", family: "Empire", category: "Glass Bottle",
    shape: null, color: "Clear", capacity: "100 ml", capacityMl: 100, capacityOz: null, applicator: "Reducer", capColor: null, trimColor: null,
    capStyle: null, neckThreadSize: "18-415", heightWithCap: null, heightWithoutCap: null, diameter: null, bottleWeightG: null, caseQuantity: null,
    qbPrice: null, webPrice1pc: 2.47, webPrice10pc: null, webPrice12pc: null, itemDescription: null, productUrl: null, dataGrade: null,
    bottleCollection: null, fitmentStatus: null, components: [], graceDescription: null, verified: true,
};
const corrupted = { ...base, itemName: "100 ml Clear Empire Reducer Bottle — GB-EMP-CLR-100ML-RDC-SGLD", stockStatus: "Out of Stock" };
const entry = { graceSku: base.graceSku, expect: { itemName: corrupted.itemName, stockStatus: "Out of Stock" }, patch: { itemName: "Empire design 100 ml…", stockStatus: "In Stock" } };
/** Exactly what the old handler inserted for an uncatalogued variant. */
const shell = { ...base, websiteSku: "GB-EMP-CLR-100ML-RDC-SGLD-01", graceSku: "GB-EMP-CLR-100ML-RDC-SGLD-01", family: null, color: null, capacity: null, capacityMl: null,
    applicator: null, neckThreadSize: null, verified: false, itemName: "100 ml Clear Empire Reducer Bottle — GB-EMP-CLR-100ML-RDC-SGLD-01", stockStatus: "Out of Stock" };

describe("guarded catalogue restore", () => {
    const saved = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    beforeEach(() => { process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = "test-token"; });
    afterEach(() => { process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = saved; });

    it("dry-runs by default, then restores, then is a no-op", async () => {
        const t = convexTest(schema, modules);
        const id = await t.run(ctx => ctx.db.insert("products", corrupted as never));
        expect(await t.mutation(restoreProducts, { writeToken: "test-token", entries: [entry] })).toMatchObject({ dryRun: true, restored: 1, fieldsWritten: 2 });
        expect((await t.run(ctx => ctx.db.get(id)))?.stockStatus).toBe("Out of Stock");
        expect(await t.mutation(restoreProducts, { writeToken: "test-token", dryRun: false, entries: [entry] })).toMatchObject({ dryRun: false, restored: 1 });
        expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ itemName: "Empire design 100 ml…", stockStatus: "In Stock", webPrice1pc: 2.47, family: "Empire" });
        expect(await t.mutation(restoreProducts, { writeToken: "test-token", dryRun: false, entries: [entry] })).toMatchObject({ restored: 0, alreadyCorrect: 1 });
    });

    it("leaves a field someone has changed since, and says so", async () => {
        const t = convexTest(schema, modules);
        const id = await t.run(ctx => ctx.db.insert("products", { ...corrupted, itemName: "A name an editor typed this afternoon" } as never));
        const result = await t.mutation(restoreProducts, { writeToken: "test-token", dryRun: false, entries: [entry] });
        expect(result).toMatchObject({ restored: 1, fieldsWritten: 1, changedSince: [{ graceSku: base.graceSku, fields: ["itemName"] }] });
        expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ itemName: "A name an editor typed this afternoon", stockStatus: "In Stock" });
    });

    it("refuses a wrong token and any field outside the list", async () => {
        const t = convexTest(schema, modules);
        await expect(t.mutation(restoreProducts, { writeToken: "nope", entries: [] })).rejects.toThrow("unauthorized_convex_write");
        await expect(t.mutation(restoreProducts, { writeToken: "test-token", entries: [{ ...entry, patch: { websiteSku: "X" } }] })).rejects.toThrow();
    });

    it("restores a group's hero, description and primary SKU under the same guard", async () => {
        const t = convexTest(schema, modules);
        const group = { slug: "empire-100ml-clear-18-415-reducer", displayName: "Empire 100 ml Reducer", family: "Empire", category: "Glass Bottle", capacity: "100 ml", capacityMl: 100,
            color: "Clear", bottleCollection: null, neckThreadSize: "18-415", variantCount: 14, priceRangeMin: 2.47, priceRangeMax: 2.6, heroImageUrl: null, groupDescription: "",
            primaryGraceSku: base.graceSku, primaryWebsiteSku: base.graceSku };
        const id = await t.run(ctx => ctx.db.insert("productGroups", group as never));
        const result = await t.mutation(restoreGroups, { writeToken: "test-token", dryRun: false, entries: [{ slug: group.slug,
            expect: { heroImageUrl: null, groupDescription: "", primaryWebsiteSku: base.graceSku, variantCount: 14 },
            patch: { heroImageUrl: "https://blob.example/plate.webp", groupDescription: null, primaryWebsiteSku: base.websiteSku, variantCount: 12 } }] });
        expect(result).toMatchObject({ restored: 1, fieldsWritten: 4 });
        expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ heroImageUrl: "https://blob.example/plate.webp", groupDescription: null, primaryWebsiteSku: base.websiteSku, variantCount: 12, displayName: group.displayName });
    });

    it("removes a webhook shell row and refuses anything that is a real product", async () => {
        const t = convexTest(schema, modules);
        const shellId = await t.run(ctx => ctx.db.insert("products", shell as never));
        const realId = await t.run(ctx => ctx.db.insert("products", corrupted as never));
        const rows = [{ id: shellId, graceSku: shell.graceSku }, { id: realId, graceSku: corrupted.graceSku }, { id: shellId, graceSku: "SOME-OTHER-SKU" }];
        expect(await t.mutation(removeShells, { writeToken: "test-token", rows })).toMatchObject({ dryRun: true, removed: 1 });
        expect(await t.run(ctx => ctx.db.query("products").collect())).toHaveLength(2);
        const result = await t.mutation(removeShells, { writeToken: "test-token", dryRun: false, rows });
        expect(result.removed).toBe(1);
        expect(result.refused.map((r: { why: string }) => r.why)).toEqual(["has its own website SKU"]);
        expect(result.alreadyGone).toBe(1);           // the third entry pointed at the row the first one removed
        expect(await t.run(ctx => ctx.db.get(realId))).not.toBeNull();
        expect(await t.run(ctx => ctx.db.get(shellId))).toBeNull();
    });
});
