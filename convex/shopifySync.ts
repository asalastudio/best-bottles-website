import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Shopify → Convex Mirror Sync
 *
 * These mutations are called by the Next.js webhook route when Shopify
 * sends product or inventory events. They upsert into the existing
 * productGroups and products tables, populating Shopify-sourced fields
 * alongside the existing Convex-owned fields (fitment, Paper Doll, etc).
 *
 * Design principle: additive upsert only. These mutations never delete
 * Convex-owned fields like components, paperDollFamilyKey, or fitmentStatus.
 */

// ─── Product Create / Update ────────────────────────────────────────────────

export const syncProduct = mutation({
    args: {
        shopifyProductId: v.number(),
        title: v.string(),
        handle: v.string(),
        productType: v.string(),
        status: v.string(),
        bodyHtml: v.string(),
        vendor: v.string(),
        tags: v.string(),
        heroImageUrl: v.union(v.string(), v.null()),
        options: v.array(
            v.object({
                name: v.string(),
                values: v.array(v.string()),
            }),
        ),
        variants: v.array(
            v.object({
                shopifyVariantId: v.number(),
                sku: v.string(),
                title: v.string(),
                price: v.string(),
                inventoryItemId: v.number(),
                inventoryQuantity: v.number(),
                option1: v.union(v.string(), v.null()),
                option2: v.union(v.string(), v.null()),
                option3: v.union(v.string(), v.null()),
            }),
        ),
    },
    handler: async (ctx, args) => {
        const shopifyGid = `gid://shopify/Product/${args.shopifyProductId}`;
        const now = Date.now();

        // ── Upsert productGroup by slug (handle) ────────────────────────
        const existingGroup = await ctx.db
            .query("productGroups")
            .withIndex("by_slug", (q) => q.eq("slug", args.handle))
            .first();

        // Compute price range from variants
        const prices = args.variants
            .map((v) => parseFloat(v.price))
            .filter((p) => !isNaN(p) && p > 0);
        const priceMin = prices.length > 0 ? Math.min(...prices) : null;
        const priceMax = prices.length > 0 ? Math.max(...prices) : null;

        // Extract applicator types from option values
        const applicatorOption = args.options.find(
            (o) =>
                o.name.toLowerCase() === "applicator" ||
                o.name.toLowerCase() === "applicator type",
        );
        const applicatorTypes = applicatorOption?.values ?? [];

        const groupPatch = {
            displayName: args.title,
            category: args.productType || "Glass Bottle",
            variantCount: args.variants.length,
            priceRangeMin: priceMin,
            priceRangeMax: priceMax,
            shopifyProductId: shopifyGid,
            heroImageUrl: args.heroImageUrl,
            groupDescription: args.bodyHtml,
            shopifyUpdatedAt: now,
            ...(applicatorTypes.length > 0 ? { applicatorTypes } : {}),
        };

        let groupId;
        if (existingGroup) {
            await ctx.db.patch(existingGroup._id, groupPatch);
            groupId = existingGroup._id;
        } else {
            groupId = await ctx.db.insert("productGroups", {
                slug: args.handle,
                family: args.productType || "Uncategorized",
                capacity: null,
                capacityMl: null,
                color: null,
                bottleCollection: null,
                neckThreadSize: null,
                ...groupPatch,
            });
        }

        // ── Upsert each variant into products table ─────────────────────
        const syncedSkus: string[] = [];

        for (const variant of args.variants) {
            if (!variant.sku) continue;

            const existing = await ctx.db
                .query("products")
                .withIndex("by_graceSku", (q) =>
                    q.eq("graceSku", variant.sku),
                )
                .first();

            const priceNum = parseFloat(variant.price);
            const variantPatch = {
                itemName: `${args.title} — ${variant.title}`,
                webPrice1pc: isNaN(priceNum) ? null : priceNum,
                stockStatus:
                    variant.inventoryQuantity > 0 ? "In Stock" : "Out of Stock",
                productGroupId: groupId,
                shopifyVariantId: `gid://shopify/ProductVariant/${variant.shopifyVariantId}`,
                shopifyInventoryItemId: `gid://shopify/InventoryItem/${variant.inventoryItemId}`,
                shopifyUpdatedAt: now,
            };

            if (existing) {
                await ctx.db.patch(existing._id, variantPatch);
            } else {
                await ctx.db.insert("products", {
                    websiteSku: variant.sku,
                    graceSku: variant.sku,
                    category: args.productType || "Glass Bottle",
                    family: null,
                    shape: null,
                    color: null,
                    capacity: null,
                    capacityMl: null,
                    capacityOz: null,
                    applicator: null,
                    capColor: null,
                    trimColor: null,
                    capStyle: null,
                    neckThreadSize: null,
                    heightWithCap: null,
                    heightWithoutCap: null,
                    diameter: null,
                    bottleWeightG: null,
                    caseQuantity: null,
                    qbPrice: null,
                    webPrice10pc: null,
                    webPrice12pc: null,
                    itemDescription: null,
                    productUrl: null,
                    dataGrade: null,
                    bottleCollection: null,
                    fitmentStatus: null,
                    components: [],
                    graceDescription: null,
                    verified: false,
                    ...variantPatch,
                });
            }

            syncedSkus.push(variant.sku);
        }

        // Update primary SKU cache on group
        if (syncedSkus.length > 0) {
            await ctx.db.patch(groupId, {
                primaryGraceSku: syncedSkus[0],
                primaryWebsiteSku: syncedSkus[0],
            });
        }

        return {
            groupId: String(groupId),
            variantsSynced: syncedSkus.length,
        };
    },
});

// ─── Product Delete ─────────────────────────────────────────────────────────

export const syncProductDelete = mutation({
    args: {
        shopifyProductId: v.number(),
    },
    handler: async (ctx, args) => {
        const shopifyGid = `gid://shopify/Product/${args.shopifyProductId}`;

        // Find the product group by shopifyProductId
        const groups = await ctx.db.query("productGroups").collect();
        const group = groups.find((g) => g.shopifyProductId === shopifyGid);

        if (!group) {
            return { deleted: false, reason: "group_not_found" };
        }

        // Find and remove all variants linked to this group
        const variants = await ctx.db
            .query("products")
            .withIndex("by_productGroupId", (q) =>
                q.eq("productGroupId", group._id),
            )
            .collect();

        for (const v of variants) {
            await ctx.db.delete(v._id);
        }

        await ctx.db.delete(group._id);

        return {
            deleted: true,
            groupId: String(group._id),
            variantsDeleted: variants.length,
        };
    },
});

// ─── Inventory Level Update ─────────────────────────────────────────────────

export const syncInventoryLevel = mutation({
    args: {
        inventoryItemId: v.number(),
        locationId: v.number(),
        available: v.number(),
    },
    handler: async (ctx, args) => {
        const variantGid = `gid://shopify/InventoryItem/${args.inventoryItemId}`;

        // Find the product variant with this inventory item ID.
        // shopifyInventoryItemId is optional and not indexed, so we scan
        // products. Once the catalog is fully synced this could use a
        // dedicated index, but the table is ~2,300 rows — safe to scan.
        const allProducts = await ctx.db.query("products").collect();
        const product = allProducts.find(
            (p) =>
                (p as Record<string, unknown>).shopifyInventoryItemId ===
                variantGid,
        );

        if (!product) {
            return { updated: false, reason: "variant_not_found" };
        }

        const newStatus = args.available > 0 ? "In Stock" : "Out of Stock";
        await ctx.db.patch(product._id, {
            stockStatus: newStatus,
            shopifyUpdatedAt: Date.now(),
        });

        return {
            updated: true,
            graceSku: product.graceSku,
            newStatus,
        };
    },
});
