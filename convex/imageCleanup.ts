/**
 * Dead-Shopify-media cleanup (2026-07-20, Jordan-ordered Cylinder clean slate).
 *
 * The Cylinder family's Shopify product media was bulk-deleted pre-launch
 * (see Best-Bottles-Website pipeline/aios-shopify-pdp-images wipe manifests),
 * but Convex still caches the now-dead cdn.shopify.com URLs in
 * products.imageUrl / products.imageUrlCapOff / productGroups.heroImageUrl.
 * Dead URLs render as broken images; a null renders the intentional
 * "Photography coming soon" placeholder — and null IS the "needs image"
 * flag for the push workflow.
 *
 * The action HEAD-checks every distinct cached cdn.shopify.com URL and nulls
 * only fields whose URL is confirmed dead — anything still live (e.g. media
 * on the separate "Tall Cylinder" Shopify product type) is left untouched.
 * Dry-run by default.
 */
import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Explicit types on everything the action consumes via `internal.imageCleanup.*`:
// a module referencing its own generated `internal` entry is circular for TS
// inference, which collapses the whole generated `api` type to `any` and
// breaks typechecking in every api consumer (observed in CI on PR #57).
interface FamilyImageRefs {
    products: Array<{
        id: Id<"products">;
        graceSku: string | null;
        imageUrl: string | null;
        imageUrlCapOff: string | null;
    }>;
    groups: Array<{
        id: Id<"productGroups">;
        slug: string;
        heroImageUrl: string | null;
    }>;
}

interface CleanupReport {
    family: string;
    dryRun: boolean;
    productsScanned: number;
    groupsScanned: number;
    distinctShopifyUrls: number;
    deadUrls: number;
    liveUrlsKept: number;
    productsPatched: number;
    groupsPatched: number;
}

export const listFamilyImageRefs = internalQuery({
    args: { family: v.string() },
    handler: async (ctx, args): Promise<FamilyImageRefs> => {
        const products = await ctx.db
            .query("products")
            .withIndex("by_family", (q) => q.eq("family", args.family))
            .collect();
        const groups = await ctx.db
            .query("productGroups")
            .withIndex("by_family", (q) => q.eq("family", args.family))
            .collect();
        return {
            products: products.map((p) => ({
                id: p._id,
                graceSku: p.graceSku ?? null,
                imageUrl: p.imageUrl ?? null,
                imageUrlCapOff: p.imageUrlCapOff ?? null,
            })),
            groups: groups.map((g) => ({
                id: g._id,
                slug: g.slug,
                heroImageUrl: g.heroImageUrl ?? null,
            })),
        };
    },
});

export const clearDeadImageFields = internalMutation({
    args: {
        products: v.array(v.object({
            id: v.id("products"),
            clearImageUrl: v.boolean(),
            clearImageUrlCapOff: v.boolean(),
        })),
        groups: v.array(v.object({
            id: v.id("productGroups"),
        })),
    },
    handler: async (ctx, args) => {
        for (const item of args.products) {
            const patch: { imageUrl?: null; imageUrlCapOff?: null } = {};
            if (item.clearImageUrl) patch.imageUrl = null;
            if (item.clearImageUrlCapOff) patch.imageUrlCapOff = null;
            if (Object.keys(patch).length > 0) await ctx.db.patch(item.id, patch);
        }
        for (const item of args.groups) {
            await ctx.db.patch(item.id, { heroImageUrl: null });
        }
        return { products: args.products.length, groups: args.groups.length };
    },
});

function isShopifyCdn(url: string): boolean {
    try {
        return new URL(url).hostname === "cdn.shopify.com";
    } catch {
        return false;
    }
}

export const cleanupDeadShopifyImages = action({
    args: {
        family: v.string(),
        dryRun: v.optional(v.boolean()),
        /**
         * Skip HEAD checks and treat every cached cdn.shopify.com URL in the
         * family as dead. For use after a verified full-family media wipe:
         * Shopify's CDN keeps serving deleted files for a while, so HEAD
         * reports false positives (2026-07-20: 39 of 360 URLs still returned
         * 200 after the Cylinder wipe left 0 media on all 53 products).
         */
        assumeAllDead: v.optional(v.boolean()),
        /**
         * Restrict the sweep to these grace SKUs. Used to repair the exact
         * fallout of a family wipe when the Shopify product_type and the
         * Convex family disagree (2026-07-20: two Vial-family rows sat on
         * Cylinder-typed Shopify products and were missed by the
         * family-scoped pass).
         */
        graceSkus: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args): Promise<CleanupReport> => {
        const dryRun = args.dryRun ?? true;
        const all: FamilyImageRefs = await ctx.runQuery(
            internal.imageCleanup.listFamilyImageRefs,
            { family: args.family },
        );
        const only = args.graceSkus ? new Set(args.graceSkus) : null;
        const refs: FamilyImageRefs = only
            ? { products: all.products.filter((p) => p.graceSku && only.has(p.graceSku)), groups: [] }
            : all;

        // HEAD-check each distinct cdn.shopify.com URL once.
        const urls = new Set<string>();
        for (const p of refs.products) {
            if (p.imageUrl && isShopifyCdn(p.imageUrl)) urls.add(p.imageUrl);
            if (p.imageUrlCapOff && isShopifyCdn(p.imageUrlCapOff)) urls.add(p.imageUrlCapOff);
        }
        for (const g of refs.groups) {
            if (g.heroImageUrl && isShopifyCdn(g.heroImageUrl)) urls.add(g.heroImageUrl);
        }
        const dead = new Set<string>();
        for (const url of urls) {
            if (args.assumeAllDead) {
                dead.add(url);
                continue;
            }
            try {
                const res = await fetch(url, { method: "HEAD" });
                if (!res.ok) dead.add(url);
            } catch {
                dead.add(url);
            }
        }

        const productPatches: Array<{
            id: Id<"products">;
            clearImageUrl: boolean;
            clearImageUrlCapOff: boolean;
        }> = [];
        for (const p of refs.products) {
            const clearImageUrl = Boolean(p.imageUrl && dead.has(p.imageUrl));
            const clearImageUrlCapOff = Boolean(p.imageUrlCapOff && dead.has(p.imageUrlCapOff));
            if (clearImageUrl || clearImageUrlCapOff) {
                productPatches.push({ id: p.id, clearImageUrl, clearImageUrlCapOff });
            }
        }
        const groupPatches = refs.groups
            .filter((g) => g.heroImageUrl && dead.has(g.heroImageUrl))
            .map((g) => ({ id: g.id }));

        if (!dryRun && (productPatches.length > 0 || groupPatches.length > 0)) {
            await ctx.runMutation(internal.imageCleanup.clearDeadImageFields, {
                products: productPatches,
                groups: groupPatches,
            });
        }

        return {
            family: args.family,
            dryRun,
            productsScanned: refs.products.length,
            groupsScanned: refs.groups.length,
            distinctShopifyUrls: urls.size,
            deadUrls: dead.size,
            liveUrlsKept: urls.size - dead.size,
            productsPatched: productPatches.length,
            groupsPatched: groupPatches.length,
        };
    },
});
