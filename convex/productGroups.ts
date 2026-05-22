import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";

function isSanityCdnUrl(value: string) {
    try {
        return new URL(value).hostname === "cdn.sanity.io";
    } catch {
        return value.includes("cdn.sanity.io/");
    }
}

async function resolveProductGroup(
    ctx: MutationCtx,
    args: {
        productGroupId?: string;
        slug?: string;
        graceSku?: string;
        websiteSku?: string;
        productId?: string;
    },
) {
    if (args.productGroupId) {
        const id = ctx.db.normalizeId("productGroups", args.productGroupId);
        if (id) {
            const group = await ctx.db.get(id);
            if (group) return { group, method: "productGroupId" as const };
        }
    }

    const slug = args.slug?.trim();
    if (slug) {
        const exact = await ctx.db
            .query("productGroups")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .first();
        if (exact) return { group: exact, method: "exact_slug" as const };
    }

    const productLookups = [
        args.graceSku
            ? ctx.db.query("products").withIndex("by_graceSku", (q) => q.eq("graceSku", args.graceSku!)).first()
            : null,
        args.websiteSku
            ? ctx.db.query("products").withIndex("by_websiteSku", (q) => q.eq("websiteSku", args.websiteSku!)).first()
            : null,
        args.productId
            ? ctx.db.query("products").withIndex("by_productId", (q) => q.eq("productId", args.productId!)).first()
            : null,
    ].filter(Boolean);

    for (const lookup of productLookups) {
        const product = await lookup;
        if (!product?.productGroupId) continue;
        const group = await ctx.db.get(product.productGroupId);
        if (group) return { group, method: "sku_or_product_id" as const };
    }

    if (slug) {
        const normalized = slug.toLowerCase();
        const matches = (await ctx.db.query("productGroups").collect())
            .filter((group) => group.slug.toLowerCase() === normalized);
        if (matches.length === 1) {
            return {
                group: matches[0],
                method: "case_insensitive_slug" as const,
                warning: `Slug differs by case. Canonical slug is "${matches[0].slug}".`,
            };
        }
        if (matches.length > 1) {
            return {
                group: null,
                method: "ambiguous_alias" as const,
                error: "ambiguous_alias" as const,
                matches: matches.map((group) => group.slug),
            };
        }
    }

    return { group: null, method: "not_found" as const, error: "not_found" as const };
}

/**
 * Internal-only catalog write: sets the live catalog grid hero URL for a
 * product group. Public callers should route through an authenticated server
 * endpoint instead of calling Convex directly.
 */
export const setHeroImageUrl = internalMutation({
    args: {
        productGroupId: v.optional(v.string()),
        slug: v.optional(v.string()),
        graceSku: v.optional(v.string()),
        websiteSku: v.optional(v.string()),
        productId: v.optional(v.string()),
        heroImageUrl: v.string(),
    },
    handler: async (ctx, args) => {
        if (isSanityCdnUrl(args.heroImageUrl)) {
            return {
                success: false,
                requestedSlug: args.slug ?? null,
                error: "sanity_product_image_rejected" as const,
                matches: [],
            };
        }

        const resolved = await resolveProductGroup(ctx, args);
        if (!resolved.group) {
            return {
                success: false,
                requestedSlug: args.slug ?? null,
                error: resolved.error,
                matches: "matches" in resolved ? resolved.matches : [],
            };
        }
        const group = resolved.group;
        await ctx.db.patch(group._id, { heroImageUrl: args.heroImageUrl });
        return {
            success: true,
            requestedSlug: args.slug ?? null,
            canonicalSlug: group.slug,
            productGroupId: group._id,
            resolutionMethod: resolved.method,
            warning: "warning" in resolved ? resolved.warning : null,
        };
    },
});
