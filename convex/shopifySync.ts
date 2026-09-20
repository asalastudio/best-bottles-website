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
 * THE CATALOGUE IS THE SOURCE OF TRUTH. Convex pushes to Shopify
 * (scripts/push_convex_to_shopify.mjs); Shopify is the mirror. So a webhook may
 * write back only what Shopify alone knows: the variant / inventory-item /
 * product ids, whether Shopify will sell the variant, and whether it is
 * available. It never writes a name, a price, an image, a description, a group
 * assignment, and it never creates or deletes a catalogue row.
 *
 * Why (2026-09-20): activating 37 draft products in Shopify admin fired
 * products/update for each. The previous handler then, on PRODUCTION: renamed
 * 394 SKUs "<product title> — <variant title>", marked all 394 "Out of Stock"
 * because `inventory_quantity` was 0 (they are untracked / oversellable, and
 * Shopify reports them availableForSale), inserted 98 shell rows for variants
 * the catalogue never listed, overwrote one price, and replaced 36 groups' hero
 * image, description and primary SKU. Any admin edit by anyone did the same.
 */

/** Statuses the webhook may move between. Anything else ("Available to order",
 * "Discontinued", …) is a catalogue decision and is left alone. */
const SHOPIFY_OWNED_STOCK = new Set<string | null | undefined>([null, undefined, "In Stock", "Out of Stock"]);

/**
 * Is this variant available, the way Shopify's own `availableForSale` decides it?
 * Untracked inventory, or a policy that continues selling at zero, is available
 * whatever the quantity says. Returns null when the payload cannot tell us
 * (an older caller that sends no tracking fields): then stock is not touched.
 */
export function variantAvailability(variant: { inventoryQuantity: number; inventoryPolicy?: string | null; inventoryManagement?: string | null }): boolean | null {
    if (variant.inventoryPolicy === undefined && variant.inventoryManagement === undefined) return null;
    if (!variant.inventoryManagement) return true;                       // not tracked
    if ((variant.inventoryPolicy ?? "").toLowerCase() === "continue") return true;
    return variant.inventoryQuantity > 0;
}

export function nextStockStatus(current: string | null | undefined, available: boolean | null): string | null | undefined {
    if (available === null || !SHOPIFY_OWNED_STOCK.has(current)) return current;
    return available ? "In Stock" : "Out of Stock";
}

/** Same vocabulary as scripts/sync_shopify_sellability.mjs. */
export function sellabilityFromProduct(status: string, publishedAt: string | null | undefined, available: boolean | null): { sellable: boolean; reason: string | null } | null {
    if (publishedAt === undefined) return null;                          // older caller: leave the audited flag alone
    const problems: string[] = [];
    if (status.toLowerCase() !== "active") problems.push(`STATUS_${status.toUpperCase()}`);
    if (!publishedAt) problems.push("NOT_PUBLISHED");
    if (available === false) problems.push("NOT_AVAILABLE_FOR_SALE");
    return { sellable: problems.length === 0, reason: problems.length ? problems.join("+") : null };
}

function verifyWriteToken(writeToken: string) {
    const expected = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!expected) throw new Error("convex_write_token_not_configured");
    if (writeToken !== expected) throw new Error("unauthorized_convex_write");
}

// ─── Product Create / Update ────────────────────────────────────────────────

export const syncProduct = mutation({
    args: {
        writeToken: v.string(),
        shopifyProductId: v.number(),
        title: v.string(),
        handle: v.string(),
        productType: v.string(),
        status: v.string(),
        /** Shopify `published_at`. Optional so an older route still validates. */
        publishedAt: v.optional(v.union(v.string(), v.null())),
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
                imageUrl: v.optional(v.union(v.string(), v.null())),
                inventoryItemId: v.number(),
                inventoryQuantity: v.number(),
                /** "deny" | "continue". */
                inventoryPolicy: v.optional(v.union(v.string(), v.null())),
                /** "shopify" when tracked, null when not. */
                inventoryManagement: v.optional(v.union(v.string(), v.null())),
                option1: v.union(v.string(), v.null()),
                option2: v.union(v.string(), v.null()),
                option3: v.union(v.string(), v.null()),
            }),
        ),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        const shopifyGid = `gid://shopify/Product/${args.shopifyProductId}`;
        const now = Date.now();

        // ── Variants: link and report availability on rows the catalogue HAS ──
        const syncedSkus: string[] = [];
        const uncataloguedSkus: string[] = [];
        const groupIds = new Set<string>();

        for (const variant of args.variants) {
            if (!variant.sku) continue;

            const existing =
                (await ctx.db.query("products").withIndex("by_graceSku", (q) => q.eq("graceSku", variant.sku)).first()) ??
                (await ctx.db.query("products").withIndex("by_websiteSku", (q) => q.eq("websiteSku", variant.sku)).first());

            if (!existing) {
                // A Shopify variant the catalogue never listed is not a product. It is
                // reported, never inserted: a row with no family, neck or fitment is a
                // ghost that every catalogue surface then has to filter out.
                uncataloguedSkus.push(variant.sku);
                continue;
            }

            const available = variantAvailability(variant);
            const sellability = sellabilityFromProduct(args.status, args.publishedAt, available);
            await ctx.db.patch(existing._id, {
                shopifyVariantId: `gid://shopify/ProductVariant/${variant.shopifyVariantId}`,
                shopifyInventoryItemId: `gid://shopify/InventoryItem/${variant.inventoryItemId}`,
                shopifyUpdatedAt: now,
                ...(available === null ? {} : {
                    stockStatus: nextStockStatus(existing.stockStatus, available) ?? null,
                    shopifyInventoryTracked: Boolean(variant.inventoryManagement),
                    shopifyInventoryPolicy: variant.inventoryPolicy ?? null,
                }),
                ...(sellability ? {
                    shopifySellable: sellability.sellable,
                    shopifySellableReason: sellability.reason,
                    shopifySellableCheckedAt: now,
                } : {}),
            });
            if (existing.productGroupId) groupIds.add(String(existing.productGroupId));
            syncedSkus.push(variant.sku);
        }

        // ── Group: only the Shopify id, on the group the catalogue already has ──
        // Matched by the id we stored, then by slug == handle (the push writes it so).
        // Never created here, never renamed, never re-imaged, never re-described, and
        // its variants are never moved: all of that is catalogue truth.
        const groupByHandle = await ctx.db.query("productGroups").withIndex("by_slug", (q) => q.eq("slug", args.handle)).first();
        let groupId: string | null = null;
        if (groupByHandle) {
            await ctx.db.patch(groupByHandle._id, { shopifyProductId: shopifyGid, shopifyUpdatedAt: now });
            groupId = String(groupByHandle._id);
        }

        if (uncataloguedSkus.length > 0) {
            console.warn(`[shopifySync] ${args.handle}: ${uncataloguedSkus.length} Shopify variant(s) not in the catalogue, ignored: ${uncataloguedSkus.slice(0, 10).join(", ")}`);
        }

        return {
            groupId,
            groupMatched: Boolean(groupByHandle),
            variantsSynced: syncedSkus.length,
            uncataloguedSkus,
        };
    },
});

// ─── Product Delete ─────────────────────────────────────────────────────────

/**
 * A product deleted in Shopify can no longer be sold. It is still a product in
 * the catalogue: its rows keep every catalogue field and lose only the Shopify
 * link. (This used to delete the group and every variant under it.)
 */
export const syncProductDelete = mutation({
    args: {
        writeToken: v.string(),
        shopifyProductId: v.number(),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        const shopifyGid = `gid://shopify/Product/${args.shopifyProductId}`;
        const groups = await ctx.db.query("productGroups").collect();
        const group = groups.find((g) => g.shopifyProductId === shopifyGid);
        if (!group) {
            return { deleted: false, reason: "group_not_found" };
        }

        const now = Date.now();
        const variants = await ctx.db
            .query("products")
            .withIndex("by_productGroupId", (q) => q.eq("productGroupId", group._id))
            .collect();
        for (const variant of variants) {
            await ctx.db.patch(variant._id, {
                shopifyVariantId: null,
                shopifyInventoryItemId: null,
                shopifySellable: false,
                shopifySellableReason: "SHOPIFY_PRODUCT_DELETED",
                shopifySellableCheckedAt: now,
                shopifyUpdatedAt: now,
            });
        }
        await ctx.db.patch(group._id, { shopifyProductId: null, shopifyUpdatedAt: now });

        return {
            deleted: false,
            unlinked: true,
            groupId: String(group._id),
            variantsUnlinked: variants.length,
        };
    },
});

// ─── Inventory Level Update ─────────────────────────────────────────────────

export const syncInventoryLevel = mutation({
    args: {
        writeToken: v.string(),
        inventoryItemId: v.number(),
        locationId: v.number(),
        available: v.number(),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

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

        // A level of zero is only "out of stock" for a variant Shopify stops selling
        // at zero. Tracking and policy are recorded by syncProduct; until a product
        // webhook has told us, a zero proves nothing and the status is left alone.
        const row = product as { shopifyInventoryTracked?: boolean | null; shopifyInventoryPolicy?: string | null };
        const known = row.shopifyInventoryTracked !== undefined && row.shopifyInventoryTracked !== null;
        const available = args.available > 0 ? true
            : !known ? null
            : variantAvailability({ inventoryQuantity: args.available, inventoryPolicy: row.shopifyInventoryPolicy ?? null, inventoryManagement: row.shopifyInventoryTracked ? "shopify" : null });
        const newStatus = nextStockStatus(product.stockStatus, available) ?? null;
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
