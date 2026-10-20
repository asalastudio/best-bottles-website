// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import schema from "../convex/schema";
import patches from "../data/migrations/legacy-finish-images-2026-10-02/patches.json";

const modules = import.meta.glob("../convex/**/*.ts");
const fn = makeFunctionReference<"mutation">("legacyFinishImages:migrate");
const token = "migration-test-token";
const args = { writeToken: token, dryRun: false };
const base = {
    family: null, category: "Component", shape: null, color: null,
    capacity: null, capacityMl: null, capacityOz: null, applicator: null,
    capColor: null, trimColor: null, capStyle: null, neckThreadSize: "18-415",
    heightWithCap: null, heightWithoutCap: null, diameter: null, bottleWeightG: null,
    caseQuantity: 1000, qbPrice: null, webPrice1pc: 1, webPrice10pc: null, webPrice12pc: 0.9,
    stockStatus: "In Stock", itemName: "Preserve original component name", itemDescription: "Preserve copy",
    productUrl: null, dataGrade: "B", bottleCollection: null, fitmentStatus: "verified", components: [],
    graceDescription: null, verified: true, shopifyVariantId: "gid://shopify/ProductVariant/123",
    imageUrlCapOff: "https://example.test/approved-secondary.png",
};
async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
        const ids = [];
        for (const p of patches) ids.push(await ctx.db.insert("products", {
            ...base, websiteSku: p.websiteSku, graceSku: p.graceSku, imageUrl: p.expectedUrl,
        } as never));
        return ids;
    });
    return { t, ids };
}
describe("legacy finish image cutover", () => {
    const saved = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    beforeEach(() => { process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = token; });
    afterEach(() => { if (saved === undefined) delete process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN; else process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = saved; });

    it("rejects unauthorized requests before looking up products", async () => {
        const t = convexTest(schema, modules);
        await expect(t.mutation(fn, { writeToken: "wrong", dryRun: false })).rejects.toThrow("unauthorized_product_image_write");
        delete process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
        await expect(t.mutation(fn, args)).rejects.toThrow("product_image_write_token_not_configured");
    });
    it("defaults to dry-run, changes only imageUrl, logs all 93 writes and retries idempotently", async () => {
        const { t } = await setup();
        const before = await t.run(ctx => ctx.db.query("products").collect());
        expect((await t.mutation(fn, { writeToken: token })).dryRun).toBe(true);
        expect(await t.run(ctx => ctx.db.query("products").collect())).toEqual(before);
        expect(await t.run(ctx => ctx.db.query("catalogChangeLog").collect())).toHaveLength(0);
        expect((await t.mutation(fn, args)).changed).toHaveLength(93);
        const after = await t.run(ctx => ctx.db.query("products").collect());
        expect(after).toEqual(before.map(p => ({ ...p, imageUrl: patches.find(e => e.websiteSku === p.websiteSku)!.imageUrl })));
        expect(await t.run(ctx => ctx.db.query("catalogChangeLog").collect())).toHaveLength(93);
        expect((await t.mutation(fn, args)).unchanged).toHaveLength(93);
        expect(await t.run(ctx => ctx.db.query("catalogChangeLog").collect())).toHaveLength(93);
        expect((await t.mutation(fn, { ...args, rollback: true })).changed).toHaveLength(93);
        expect(await t.run(ctx => ctx.db.query("products").collect())).toEqual(before);
        expect((await t.mutation(fn, { ...args, rollback: true })).unchanged).toHaveLength(93);
    });
    it("aborts the entire batch if a later approved image replaced any legacy URL", async () => {
        const { t, ids } = await setup();
        await t.run(ctx => ctx.db.patch(ids[92], { imageUrl: "https://example.test/new-approved-art.png" }));
        const before = await t.run(ctx => ctx.db.query("products").collect());
        await expect(t.mutation(fn, args)).rejects.toThrow("legacy_finish_image_changed");
        expect(await t.run(ctx => ctx.db.query("products").collect())).toEqual(before);
        expect(await t.run(ctx => ctx.db.query("catalogChangeLog").collect())).toHaveLength(0);
    });
    it.each(["graceSku", "category"])("rejects changed %s identity", async field => {
        const { t, ids } = await setup();
        await t.run(ctx => ctx.db.patch(ids[0], { [field]: "changed" }));
        await expect(t.mutation(fn, args)).rejects.toThrow("legacy_finish_identity_changed");
    });
    it("does not fall back to a matching Grace alias when exact website SKU is absent", async () => {
        const { t, ids } = await setup();
        await t.run(ctx => ctx.db.patch(ids[0], { websiteSku: "__RETIRED__alias" }));
        await expect(t.mutation(fn, args)).rejects.toThrow("legacy_finish_identity_changed");
    });
    it("holds rollback if an approved image was added after migration", async () => {
        const { t, ids } = await setup();
        await t.mutation(fn, args);
        await t.run(ctx => ctx.db.patch(ids[0], { imageUrl: "https://example.test/later-approved.png" }));
        await expect(t.mutation(fn, { ...args, rollback: true })).rejects.toThrow("legacy_finish_image_changed");
        expect((await t.run(ctx => ctx.db.get(ids[1])))?.imageUrl).toBe(patches[1].imageUrl);
    });
});
