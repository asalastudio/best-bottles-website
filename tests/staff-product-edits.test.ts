// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { isStandardLadder, standardLadder, tiersFromRungs, validatePriceRungs, validateProductPatch } from "../convex/staffProductEditRules";

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

    it("moves the group's From price when a SKU's price is saved, and back when it is reverted", async () => {
        const t = convexTest(schema, modules);
        const groupId = await t.run(ctx => ctx.db.insert("productGroups", { slug: "empire-100ml-clear-18-415-reducer", displayName: "Empire 100 ml Reducer", family: "Empire", category: "Glass Bottle",
            capacity: "100 ml", capacityMl: 100, color: "Clear", bottleCollection: null, neckThreadSize: "18-415", variantCount: 2, priceRangeMin: 2.47, priceRangeMax: 2.9 } as never));
        const cheap = await t.run(ctx => ctx.db.insert("products", { ...product, productGroupId: groupId } as never));
        await t.run(ctx => ctx.db.insert("products", { ...product, websiteSku: "OTHER", graceSku: "OTHER", webPrice1pc: 2.9, priceTiers: [{ minQty: 1, unitPrice: 2.9, totalPrice: 2.9 }], productGroupId: groupId } as never));
        const range = async () => { const g = await t.run(ctx => ctx.db.get(groupId)); return [g?.priceRangeMin, g?.priceRangeMax]; };
        const saved = await t.mutation(fn("updateProduct"), { writeToken: token, productId: cheap, actor, expect: { priceTiers: ladder }, patch: { priceTiers: [{ minQty: 1, unitPrice: 3.25 }] } });
        expect(await range()).toEqual([2.9, 3.25]);                      // the cheapest SKU became the dearest
        await t.mutation(fn("revertChange"), { writeToken: token, changeId: saved.changes[0].logId, actor });
        expect(await range()).toEqual([2.47, 2.9]);
        await t.mutation(fn("updateProduct"), { writeToken: token, productId: cheap, actor, expect: {}, patch: { stockStatus: "Out of Stock" } });
        expect(await range()).toEqual([2.47, 2.9]);                      // a non-price edit leaves it alone
    });

    it("tabulates the ladder from the 1-piece price on Best Bottles' schedule, with the pack total as the truth", () => {
        // a real live ladder (Alu-style breaks): 5 / 10 / 15 / 22 % off the PACK, price each derived from it
        const breaks = [1, 12, 144, 288, 1440];
        expect(standardLadder(3.65, breaks)).toEqual([{ minQty: 1, unitPrice: 3.65 }, { minQty: 12, unitPrice: 3.47 }, { minQty: 144, unitPrice: 3.29 }, { minQty: 288, unitPrice: 3.1 }, { minQty: 1440, unitPrice: 2.85 }]);
        const tiers = tiersFromRungs(standardLadder(3.65, breaks));
        expect(tiers[1]).toEqual({ minQty: 12, unitPrice: 3.47, totalPrice: 41.61 });        // NOT 12 x 3.47 = 41.64
        expect(tiers[4].totalPrice).toBe(4099.68);
        expect(isStandardLadder(standardLadder(0.89, breaks))).toBe(true);
        expect(isStandardLadder([{ minQty: 1, unitPrice: 2 }, { minQty: 12, unitPrice: 1.5 }])).toBe(false);
        // a hand-priced ladder keeps price each x quantity
        expect(tiersFromRungs([{ minQty: 1, unitPrice: 2 }, { minQty: 10, unitPrice: 1.5 }])[1].totalPrice).toBe(15);
        // and a rung the editor did not change keeps its stored total, whatever the schedule would say
        const stored = [{ minQty: 1, unitPrice: 0.37, totalPrice: 0.37 }, { minQty: 10, unitPrice: 0.35, totalPrice: 3.5 }, { minQty: 100, unitPrice: 0.33, totalPrice: 33 }, { minQty: 1000, unitPrice: 0.31, totalPrice: 310 }, { minQty: 5000, unitPrice: 0.29, totalPrice: 1450 }];
        expect(tiersFromRungs(stored.map(({ minQty, unitPrice }) => ({ minQty, unitPrice })), stored)).toEqual(stored);
    });

    it("a save that raises the 1-piece price stores the schedule's pack totals, and an untouched ladder is left byte-identical", async () => {
        const t = convexTest(schema, modules);
        const breaks = [1, 12, 144, 288, 1440];
        const before = tiersFromRungs(standardLadder(2.47, breaks));
        const id = await t.run(ctx => ctx.db.insert("products", { ...product, priceTiers: before, webPrice12pc: before[1].unitPrice } as never));
        await t.mutation(fn("updateProduct"), { writeToken: token, productId: id, actor, expect: {}, patch: { stockStatus: "Out of Stock" } });
        expect((await t.run(ctx => ctx.db.get(id)))?.priceTiers).toEqual(before);
        await t.mutation(fn("updateProduct"), { writeToken: token, productId: id, actor, expect: { priceTiers: standardLadder(2.47, breaks) }, patch: { priceTiers: standardLadder(2.6, breaks) } });
        const after = await t.run(ctx => ctx.db.get(id));
        expect(after?.priceTiers).toEqual(tiersFromRungs(standardLadder(2.6, breaks)));
        expect(after).toMatchObject({ webPrice1pc: 2.6, webPrice12pc: 2.47 });
        expect(after?.priceTiers?.[1]).toEqual({ minQty: 12, unitPrice: 2.47, totalPrice: 29.64 });
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
