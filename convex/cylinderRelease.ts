import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

const allowedProductFields = new Set([
    "category", "family", "shape", "color", "capacity", "capacityMl", "capacityOz",
    "applicator", "capColor", "trimColor", "capStyle", "capHeight", "componentProfile",
    "componentFinish", "componentTexture", "componentColor", "neckThreadSize",
    "heightWithCap", "heightWithoutCap", "diameter", "measurementSource", "itemName",
    "itemDescription", "imageUrl", "productUrl", "dataGrade", "bottleCollection",
    "fitmentStatus", "assemblyType", "productGroupId", "webPrice1pc", "webPrice12pc",
    "priceTiers", "priceTiersSyncedAt", "shopifySellableReason", "stockStatus",
]);
const allowedGroupFields = new Set([
    "slug", "displayName", "category", "capacity", "capacityMl", "color", "neckThreadSize",
    "variantCount", "priceRangeMin", "priceRangeMax", "applicatorTypes", "primaryGraceSku", "primaryWebsiteSku",
]);
const patchV = v.object({ id: v.string(), expected: v.any(), set: v.any() });

/** Operator-only, bounded, compare-before-write catalog reconciliation.
 * No delete path, no identity renaming, no changes to existing Shopify links.
 * An entire batch rolls back when a reviewed before-value has drifted.
 */
export const reconcile = internalMutation({
    args: {
        dryRun: v.boolean(), products: v.array(patchV), groups: v.array(patchV),
        newGroups: v.array(v.any()), newProducts: v.array(v.any()),
    },
    returns: v.object({ patched: v.number(), groupsPatched: v.number(), inserted: v.number(), groupsInserted: v.number(), alreadyPresent: v.number() }),
    handler: async (ctx, args) => {
        if (args.products.length > 50 || args.groups.length > 20 || args.newProducts.length > 50 || args.newGroups.length > 20) throw new Error("Release batch is too large");
        const result = { patched: 0, groupsPatched: 0, inserted: 0, groupsInserted: 0, alreadyPresent: 0 };
        const groupIds = new Map<string, Id<"productGroups">>();
        const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
        for (const [table, patches, allowed] of [["products", args.products, allowedProductFields], ["productGroups", args.groups, allowedGroupFields]] as const) {
            for (const patch of patches) {
                const id = ctx.db.normalizeId(table, patch.id);
                if (!id) throw new Error("Invalid record ID");
                const current = await ctx.db.get(id);
                if (!current || current.family !== "Cylinder") throw new Error("Record outside Cylinder scope");
                for (const key of Object.keys(patch.set)) {
                    if (!allowed.has(key)) throw new Error(`Forbidden field ${key}`);
                    if (!(key in patch.expected)) throw new Error(`Missing before-value for ${key}`);
                    const value = (current as unknown as Record<string, unknown>)[key];
                    if (!same(value, patch.expected[key]) && !same(value, patch.set[key])) throw new Error(`Concurrent change: ${patch.id}.${key}`);
                }
                if (table === "productGroups" && patch.set.slug) groupIds.set(patch.set.slug, id as Id<"productGroups">);
                if (table === "products" && patch.set.productGroupId) {
                    const target = await ctx.db.get(patch.set.productGroupId as Id<"productGroups">);
                    if (target?.family !== "Cylinder") throw new Error("Target group outside Cylinder");
                }
                if (!args.dryRun) await ctx.db.patch(id, patch.set);
                if (table === "products") result.patched++; else result.groupsPatched++;
            }
        }
        for (const group of args.newGroups) {
            if (group.family !== "Cylinder") throw new Error("New group outside Cylinder");
            const matches = await ctx.db.query("productGroups").withIndex("by_slug", q => q.eq("slug", group.slug)).collect();
            if (matches.length > 1 || (matches[0] && matches[0].family !== "Cylinder")) throw new Error("Conflicting group");
            if (matches[0]) groupIds.set(group.slug, matches[0]._id);
            else { if (!args.dryRun) groupIds.set(group.slug, await ctx.db.insert("productGroups", group)); result.groupsInserted++; }
        }
        for (const raw of args.newProducts) {
            const { groupSlug, ...product } = raw;
            if (product.family !== "Cylinder" || !product.websiteSku || !product.graceSku || !product.itemName) throw new Error("Invalid new Cylinder identity");
            const exact = await ctx.db.query("products").withIndex("by_websiteSku", q => q.eq("websiteSku", product.websiteSku)).collect();
            const grace = await ctx.db.query("products").withIndex("by_graceSku", q => q.eq("graceSku", product.graceSku)).collect();
            if (exact.length === 1 && grace.length === 1 && exact[0]._id === grace[0]._id) { result.alreadyPresent++; continue; }
            if (exact.length || grace.length) throw new Error(`Identity collision: ${product.websiteSku}`);
            let groupId = groupIds.get(groupSlug);
            if (!groupId) {
                const group = await ctx.db.query("productGroups").withIndex("by_slug", q => q.eq("slug", groupSlug)).unique();
                if (group?.family === "Cylinder") groupId = group._id;
            }
            if (!groupId && !args.newGroups.some(g => g.slug === groupSlug)) throw new Error(`Missing group: ${groupSlug}`);
            if (!args.dryRun) await ctx.db.insert("products", { ...product, productGroupId: groupId } as Omit<Doc<"products">, "_id" | "_creationTime">);
            result.inserted++;
        }
        return result;
    },
});

/** Bind newly created, externally verified Shopify variants. Existing links may
 * only be repeated verbatim; this cannot reassign a linked product or group. */
export const bindShopify = internalMutation({
    args: { rows: v.array(v.object({ websiteSku: v.string(), graceSku: v.string(), variantId: v.string(), inventoryItemId: v.string(), productId: v.string(), sellable: v.boolean() })) },
    returns: v.object({ linked: v.number() }),
    handler: async (ctx, args) => {
        if (args.rows.length > 40) throw new Error("Too many Shopify links");
        for (const row of args.rows) {
            const product = await ctx.db.query("products").withIndex("by_websiteSku", q => q.eq("websiteSku", row.websiteSku)).unique();
            if (!product || product.family !== "Cylinder" || product.capacityMl !== 25 || product.graceSku !== row.graceSku) throw new Error("Unexpected Shopify binding identity");
            if (product.shopifyVariantId && product.shopifyVariantId !== row.variantId) throw new Error("Existing Shopify link cannot be replaced");
            const group = product.productGroupId ? await ctx.db.get(product.productGroupId) : null;
            if (!group || (group.shopifyProductId && group.shopifyProductId !== row.productId)) throw new Error("Conflicting Shopify group");
            if (!row.variantId.startsWith("gid://shopify/ProductVariant/") || !row.productId.startsWith("gid://shopify/Product/")) throw new Error("Invalid Shopify GID");
            await ctx.db.patch(product._id, { shopifyVariantId: row.variantId, shopifyInventoryItemId: row.inventoryItemId, shopifyUpdatedAt: Date.now(), shopifySellable: row.sellable, shopifySellableReason: row.sellable ? null : "PENDING_CHECKOUT_VERIFICATION", shopifySellableCheckedAt: Date.now() });
            await ctx.db.patch(group._id, { shopifyProductId: row.productId, shopifyUpdatedAt: Date.now() });
        }
        return { linked: args.rows.length };
    },
});
