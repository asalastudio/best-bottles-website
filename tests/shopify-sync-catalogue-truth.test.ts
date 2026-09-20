// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { nextStockStatus, sellabilityFromProduct, variantAvailability } from "../convex/shopifySync";

const modules = import.meta.glob("../convex/**/*.ts");
const syncProduct = makeFunctionReference<"mutation">("shopifySync:syncProduct");
const syncProductDelete = makeFunctionReference<"mutation">("shopifySync:syncProductDelete");
const syncInventoryLevel = makeFunctionReference<"mutation">("shopifySync:syncInventoryLevel");

const LEGACY_NAME = "Empire design 100 ml clear glass bottle with reducer and shiny gold cap. For use with cologne. Price each";
const row = {
    websiteSku: "GBEmp100RdcrShnGl", graceSku: "GB-EMP-CLR-100ML-RDC-SGLD", family: "Empire", category: "Glass Bottle",
    shape: null, color: "Clear", capacity: "100 ml", capacityMl: 100, capacityOz: null,
    applicator: "Reducer", capColor: "Shiny Gold", trimColor: null, capStyle: null, neckThreadSize: "18-415",
    heightWithCap: null, heightWithoutCap: null, diameter: null, bottleWeightG: null, caseQuantity: null,
    qbPrice: null, webPrice1pc: 2.47, webPrice10pc: null, webPrice12pc: null, stockStatus: "In Stock",
    itemName: LEGACY_NAME, itemDescription: null, productUrl: null, dataGrade: null,
    bottleCollection: null, fitmentStatus: null, components: [], graceDescription: null, verified: true,
};
const group = {
    slug: "empire-100ml-clear-18-415-reducer", displayName: "Empire 100 ml Reducer", family: "Empire", category: "Glass Bottle",
    capacity: "100 ml", capacityMl: 100, color: "Clear", bottleCollection: null, neckThreadSize: "18-415",
    variantCount: 12, priceRangeMin: 2.47, priceRangeMax: 2.6, heroImageUrl: "https://blob.example/plates/empire.webp",
    groupDescription: null, primaryGraceSku: row.graceSku, primaryWebsiteSku: row.websiteSku,
};
/** What Shopify sent on 2026-09-20 when the draft was activated: quantity 0, untracked, title-only names. */
const activation = (extra: Record<string, unknown> = {}) => ({
    writeToken: "test-token", shopifyProductId: 10433895104804, title: "100 ml Clear Empire Reducer Bottle", handle: group.slug,
    productType: "Empire", status: "active", publishedAt: "2026-09-20T12:09:16-07:00", bodyHtml: "", vendor: "Best Bottles", tags: "",
    heroImageUrl: null, options: [{ name: "Finish", values: ["Shiny Gold"] }],
    variants: [
        { shopifyVariantId: 53343643566372, sku: row.graceSku, title: row.graceSku, price: "9.99", inventoryItemId: 1, inventoryQuantity: 0, inventoryPolicy: "deny", inventoryManagement: null, option1: "Shiny Gold", option2: null, option3: null },
        { shopifyVariantId: 53343643566999, sku: "GB-EMP-CLR-100ML-RDC-SGLD-01", title: "dup", price: "2.47", inventoryItemId: 2, inventoryQuantity: 0, inventoryPolicy: "deny", inventoryManagement: null, option1: "dup", option2: null, option3: null },
    ],
    ...extra,
});

describe("Shopify webhooks treat the catalogue as the source of truth", () => {
    const saved = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    beforeEach(() => { process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = "test-token"; });
    afterEach(() => { process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = saved; });

    it("replays the 2026-09-20 activation: name, price, stock, group and row count all survive", async () => {
        const t = convexTest(schema, modules);
        const groupId = await t.run(ctx => ctx.db.insert("productGroups", group as never));
        const id = await t.run(ctx => ctx.db.insert("products", { ...row, productGroupId: groupId, shopifySellable: false, shopifySellableReason: "STATUS_DRAFT+NOT_PUBLISHED" } as never));

        const result = await t.mutation(syncProduct, activation());

        const after = await t.run(ctx => ctx.db.get(id));
        expect(after).toMatchObject({
            itemName: LEGACY_NAME,                 // was overwritten with "<title> — <sku>"
            webPrice1pc: 2.47,                     // Shopify said 9.99
            stockStatus: "In Stock",               // quantity 0, but untracked: Shopify sells it
            productGroupId: groupId,
            shopifyVariantId: "gid://shopify/ProductVariant/53343643566372",
            shopifySellable: true, shopifySellableReason: null,
        });
        expect(await t.run(ctx => ctx.db.query("products").collect())).toHaveLength(1);   // no shell row for the -01 variant
        expect(result).toMatchObject({ variantsSynced: 1, uncataloguedSkus: ["GB-EMP-CLR-100ML-RDC-SGLD-01"], groupMatched: true });
        expect(await t.run(ctx => ctx.db.get(groupId))).toMatchObject({
            displayName: group.displayName, heroImageUrl: group.heroImageUrl, groupDescription: null, variantCount: 12,
            primaryWebsiteSku: row.websiteSku, shopifyProductId: "gid://shopify/Product/10433895104804",
        });
    });

    it("creates nothing for a Shopify product the catalogue does not have", async () => {
        const t = convexTest(schema, modules);
        const result = await t.mutation(syncProduct, activation({ handle: "not-a-catalogue-group" }));
        expect(result).toMatchObject({ groupId: null, groupMatched: false, variantsSynced: 0 });
        expect(await t.run(ctx => ctx.db.query("products").collect())).toHaveLength(0);
        expect(await t.run(ctx => ctx.db.query("productGroups").collect())).toHaveLength(0);
    });

    it("reports a real stock-out, and leaves a catalogue-owned status alone", async () => {
        const t = convexTest(schema, modules);
        const tracked = (quantity: number) => activation({ variants: [{ ...activation().variants[0], inventoryManagement: "shopify", inventoryPolicy: "deny", inventoryQuantity: quantity }] });
        const id = await t.run(ctx => ctx.db.insert("products", row as never));
        await t.mutation(syncProduct, tracked(0));
        expect((await t.run(ctx => ctx.db.get(id)))?.stockStatus).toBe("Out of Stock");
        await t.mutation(syncProduct, tracked(40));
        expect((await t.run(ctx => ctx.db.get(id)))?.stockStatus).toBe("In Stock");
        await t.run(ctx => ctx.db.patch(id, { stockStatus: "Available to order" }));
        await t.mutation(syncProduct, tracked(0));
        expect((await t.run(ctx => ctx.db.get(id)))?.stockStatus).toBe("Available to order");
    });

    it("an older route that sends no tracking or publish fields changes neither stock nor sellability", async () => {
        const t = convexTest(schema, modules);
        const id = await t.run(ctx => ctx.db.insert("products", { ...row, shopifySellable: true } as never));
        const legacy = activation(); delete (legacy as Record<string, unknown>).publishedAt;
        legacy.variants = legacy.variants.map(v => { const rest: Record<string, unknown> = { ...v }; delete rest.inventoryPolicy; delete rest.inventoryManagement; return rest; }) as never;
        await t.mutation(syncProduct, legacy);
        expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ stockStatus: "In Stock", shopifySellable: true });
    });

    it("an inventory level of zero is not a stock-out until Shopify has said the variant is tracked and denies overselling", async () => {
        const t = convexTest(schema, modules);
        const id = await t.run(ctx => ctx.db.insert("products", { ...row, shopifyInventoryItemId: "gid://shopify/InventoryItem/1" } as never));
        const level = (available: number) => t.mutation(syncInventoryLevel, { writeToken: "test-token", inventoryItemId: 1, locationId: 9, available });
        await level(0);
        expect((await t.run(ctx => ctx.db.get(id)))?.stockStatus).toBe("In Stock");          // unknown tracking: untouched
        await t.run(ctx => ctx.db.patch(id, { shopifyInventoryTracked: false, shopifyInventoryPolicy: "deny" } as never));
        await level(0);
        expect((await t.run(ctx => ctx.db.get(id)))?.stockStatus).toBe("In Stock");          // untracked
        await t.run(ctx => ctx.db.patch(id, { shopifyInventoryTracked: true, shopifyInventoryPolicy: "deny" } as never));
        await level(0);
        expect((await t.run(ctx => ctx.db.get(id)))?.stockStatus).toBe("Out of Stock");
        await level(3);
        expect((await t.run(ctx => ctx.db.get(id)))?.stockStatus).toBe("In Stock");
    });

    it("deleting a product in Shopify unlinks it and deletes nothing from the catalogue", async () => {
        const t = convexTest(schema, modules);
        const groupId = await t.run(ctx => ctx.db.insert("productGroups", { ...group, shopifyProductId: "gid://shopify/Product/77" } as never));
        const id = await t.run(ctx => ctx.db.insert("products", { ...row, productGroupId: groupId, shopifyVariantId: "gid://shopify/ProductVariant/1", shopifySellable: true } as never));
        const result = await t.mutation(syncProductDelete, { writeToken: "test-token", shopifyProductId: 77 });
        expect(result).toMatchObject({ deleted: false, unlinked: true, variantsUnlinked: 1 });
        expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ itemName: LEGACY_NAME, shopifyVariantId: null, shopifySellable: false, shopifySellableReason: "SHOPIFY_PRODUCT_DELETED" });
        expect(await t.run(ctx => ctx.db.get(groupId))).toMatchObject({ displayName: group.displayName, shopifyProductId: null });
    });

    it("decides availability the way Shopify's availableForSale does", () => {
        expect(variantAvailability({ inventoryQuantity: 0, inventoryPolicy: "deny", inventoryManagement: null })).toBe(true);
        expect(variantAvailability({ inventoryQuantity: 0, inventoryPolicy: "continue", inventoryManagement: "shopify" })).toBe(true);
        expect(variantAvailability({ inventoryQuantity: 0, inventoryPolicy: "deny", inventoryManagement: "shopify" })).toBe(false);
        expect(variantAvailability({ inventoryQuantity: 5, inventoryPolicy: "deny", inventoryManagement: "shopify" })).toBe(true);
        expect(variantAvailability({ inventoryQuantity: 0 })).toBeNull();
        expect(nextStockStatus("Discontinued", false)).toBe("Discontinued");
        expect(nextStockStatus("In Stock", null)).toBe("In Stock");
        expect(sellabilityFromProduct("draft", null, true)).toEqual({ sellable: false, reason: "STATUS_DRAFT+NOT_PUBLISHED" });
        expect(sellabilityFromProduct("active", "2026-09-20", true)).toEqual({ sellable: true, reason: null });
        expect(sellabilityFromProduct("active", undefined, true)).toBeNull();
    });
});
