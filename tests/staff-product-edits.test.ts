// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { validatePriceRungs, validateProductPatch } from "../convex/staffProductEditRules";

const modules = import.meta.glob("../convex/**/*.ts");
const fn = (name: string) => makeFunctionReference<"mutation">(`staffProductEdits:${name}`);
const q = (name: string) => makeFunctionReference<"query">(`staffProductEdits:${name}`);
const token = "test-token", actor = { id: "user_1", email: "sam@bestbottles.com" };

const product = {
    websiteSku: "GBEmp100RdcrShnGl", graceSku: "GB-EMP-CLR-100ML-RDC-SGLD", family: "Empire", category: "Glass Bottle", shape: null, color: "Clear",
    capacity: "100 ml", capacityMl: 100, capacityOz: null, applicator: "Reducer", capColor: "Shiny Gold", trimColor: null, capStyle: null, neckThreadSize: "18-415",
    heightWithCap: null, heightWithoutCap: null, diameter: null, bottleWeightG: null, caseQuantity: 144, qbPrice: null, webPrice1pc: 2.47, webPrice10pc: null, webPrice12pc: 2.3,
    priceTiers: [{ minQty: 1, unitPrice: 2.47, totalPrice: 2.47 }, { minQty: 12, unitPrice: 2.3, totalPrice: 27.6 }],
    stockStatus: "In Stock", itemName: "Empire design 100 ml clear glass bottle with reducer", itemDescription: null, productUrl: null, dataGrade: null,
    bottleCollection: null, fitmentStatus: null, components: [], graceDescription: null, verified: true, shopifyVariantId: "gid://shopify/ProductVariant/1",
};
const ladder = [{ minQty: 1, unitPrice: 2.47 }, { minQty: 12, unitPrice: 2.3 }];

describe("Team Hub product edits", () => {
    const saved = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    beforeEach(() => { process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = token; });
    afterEach(() => { process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = saved; });

    it("saves a description and a price ladder, keeps the mirrored price columns in step, and logs one entry per field", async () => {
        const t = convexTest(schema, modules);
        const id = await t.run(ctx => ctx.db.insert("products", product as never));
        const result = await t.mutation(fn("updateProduct"), { writeToken: token, productId: id, actor,
            expect: { itemDescription: null, priceTiers: ladder },
            patch: { itemDescription: "A tall square bottle with a reducer.", priceTiers: [{ minQty: 1, unitPrice: 2.6 }, { minQty: 12, unitPrice: 2.4 }, { minQty: 144, unitPrice: 2.105 }] } });
        expect(result).toMatchObject({ ok: true, priceChanged: { before: 2.47, after: 2.6 }, shopifyVariantId: product.shopifyVariantId });
        expect(result.changes.map((c: { field: string }) => c.field)).toEqual(["itemDescription", "priceTiers"]);
        expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({
            itemDescription: "A tall square bottle with a reducer.", itemName: product.itemName, webPrice1pc: 2.6, webPrice12pc: 2.4, webPrice10pc: null,
            priceTiers: [{ minQty: 1, unitPrice: 2.6, totalPrice: 2.6 }, { minQty: 12, unitPrice: 2.4, totalPrice: 28.8 }, { minQty: 144, unitPrice: 2.11, totalPrice: 303.12 }],
            family: "Empire", neckThreadSize: "18-415", websiteSku: product.websiteSku,
        });
        const history = await t.query(q("changeLogFor"), { writeToken: token, targets: [{ targetType: "product", targetId: id }] });
        expect(history).toHaveLength(2);
        expect(history[0]).toMatchObject({ label: product.websiteSku, actorEmail: actor.email, reverted: false });
    });

    it("refuses a save made against a value someone else has since changed, and writes nothing", async () => {
        const t = convexTest(schema, modules);
        const id = await t.run(ctx => ctx.db.insert("products", product as never));
        await t.run(ctx => ctx.db.patch(id, { stockStatus: "Available to order" }));
        const result = await t.mutation(fn("updateProduct"), { writeToken: token, productId: id, actor, expect: { stockStatus: "In Stock" }, patch: { stockStatus: "Out of Stock" } });
        expect(result).toMatchObject({ ok: false, conflicts: [{ field: "stockStatus", current: "Available to order" }] });
        expect((await t.run(ctx => ctx.db.get(id)))?.stockStatus).toBe("Available to order");
        expect(await t.run(ctx => ctx.db.query("catalogChangeLog").collect())).toHaveLength(0);
    });

    it("cannot touch identity or fitment, and rejects a bad ladder, a blank name and a made-up status", async () => {
        const t = convexTest(schema, modules);
        const id = await t.run(ctx => ctx.db.insert("products", product as never));
        const save = (patch: Record<string, unknown>) => t.mutation(fn("updateProduct"), { writeToken: token, productId: id, actor, expect: {}, patch });
        await expect(save({ neckThreadSize: "13-415" })).rejects.toThrow();            // not in the validator at all
        await expect(save({ websiteSku: "X" })).rejects.toThrow();
        await expect(save({ itemName: "A legacy sentence staff can no longer overwrite" })).rejects.toThrow();   // a fallback, not a name
        expect(await save({ stockStatus: "Maybe" })).toMatchObject({ ok: false });
        expect(await save({ priceTiers: [{ minQty: 1, unitPrice: 2 }, { minQty: 12, unitPrice: 2.5 }] })).toMatchObject({ ok: false, error: expect.stringContaining("cannot be higher") });
        await expect(t.mutation(fn("updateProduct"), { writeToken: "nope", productId: id, actor, expect: {}, patch: {} })).rejects.toThrow("unauthorized");
        expect(validatePriceRungs([{ minQty: 12, unitPrice: 2 }])).toContain("quantity must be 1");
        expect(validatePriceRungs([{ minQty: 1, unitPrice: 2 }, { minQty: 1, unitPrice: 1.9 }])).toContain("must rise");
        expect(validateProductPatch({ caseQuantity: 1.5 })).toContain("whole number");
    });

    it("reverts one field, once, and only while it still holds the edited value", async () => {
        const t = convexTest(schema, modules);
        const id = await t.run(ctx => ctx.db.insert("products", product as never));
        const first = await t.mutation(fn("updateProduct"), { writeToken: token, productId: id, actor, expect: { priceTiers: ladder }, patch: { priceTiers: [{ minQty: 1, unitPrice: 9.99 }] } });
        const reverted = await t.mutation(fn("revertChange"), { writeToken: token, changeId: first.changes[0].logId, actor });
        expect(reverted).toMatchObject({ ok: true, priceChanged: { before: 9.99, after: 2.47 } });
        expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ webPrice1pc: 2.47, webPrice12pc: 2.3 });
        expect(await t.mutation(fn("revertChange"), { writeToken: token, changeId: first.changes[0].logId, actor })).toMatchObject({ ok: false, error: expect.stringContaining("already been reverted") });
        const second = await t.mutation(fn("updateProduct"), { writeToken: token, productId: id, actor, expect: {}, patch: { stockStatus: "Out of Stock" } });
        await t.run(ctx => ctx.db.patch(id, { stockStatus: "Discontinued" }));
        expect(await t.mutation(fn("revertChange"), { writeToken: token, changeId: second.changes[0].logId, actor })).toMatchObject({ ok: false, conflicts: [{ field: "stockStatus" }] });
    });

    it("sets, trims and clears a group's custom name, never touches displayName, and returns the sheet's edit view", async () => {
        const t = convexTest(schema, modules);
        const groupId = await t.run(ctx => ctx.db.insert("productGroups", { slug: "empire-100ml-clear-18-415-reducer", displayName: "Empire 100 ml Reducer", family: "Empire", category: "Glass Bottle",
            capacity: "100 ml", capacityMl: 100, color: "Clear", bottleCollection: null, neckThreadSize: "18-415", variantCount: 1, priceRangeMin: 2.47, priceRangeMax: 2.47 } as never));
        await t.run(ctx => ctx.db.insert("products", { ...product, productGroupId: groupId } as never));
        expect(await t.mutation(fn("updateGroup"), { writeToken: token, groupId, actor, expect: { groupDescription: null }, patch: { groupDescription: "A tall square bottle with a reducer." } })).toMatchObject({ ok: true });
        const group = () => t.run(ctx => ctx.db.get(groupId));
        const rename = (expect: string | null, customName: string | null) => t.mutation(fn("updateGroup"), { writeToken: token, groupId, actor, expect: { customName: expect }, patch: { customName } });
        expect(await rename(null, "  Empire Tower, 100 ml  ")).toMatchObject({ ok: true });
        expect(await group()).toMatchObject({ customName: "Empire Tower, 100 ml", displayName: "Empire 100 ml Reducer" });
        expect(await rename(null, "Another")).toMatchObject({ ok: false, conflicts: [{ field: "customName", current: "Empire Tower, 100 ml" }] });
        expect(await rename("Empire Tower, 100 ml", "ab")).toMatchObject({ ok: false, error: expect.stringContaining("at least three characters") });
        expect(await rename("Empire Tower, 100 ml", null)).toMatchObject({ ok: true });
        expect((await group())?.customName).toBeNull();
        await expect(t.mutation(fn("updateGroup"), { writeToken: token, groupId, actor, expect: {}, patch: { displayName: "X" } as never })).rejects.toThrow();
        const view = await t.query(q("getGroupForEdit"), { writeToken: token, slug: "empire-100ml-clear-18-415-reducer" });
        expect(view?.group).toMatchObject({ customName: null, groupDescription: "A tall square bottle with a reducer.", naming: { displayName: "Empire 100 ml Reducer", family: "Empire" } });
        expect(view?.variants[0]).toMatchObject({ websiteSku: product.websiteSku, priceTiers: ladder, caseQuantity: 144 });
        expect(view?.variants[0]).not.toHaveProperty("neckThreadSize");
    });
});
