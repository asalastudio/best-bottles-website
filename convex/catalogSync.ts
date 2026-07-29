/**
 * Surgical catalog backfill (2026-07-20).
 *
 * The 2026-07-20 audit found 21 master-truth SKUs genuinely absent from the
 * live catalog (out of an apparent 172 — the other 151 were CSV alias rows
 * whose products already exist under canonical graceSkus). This module
 * inserts ONLY explicitly-listed products and groups from a reviewed
 * manifest. It is NOT the productGroups rebuild path — that remains frozen
 * pending buildGroupSlug reconciliation (194-dupe hazard).
 *
 * Idempotent: existing graceSkus and group slugs are skipped, never patched.
 */
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const groupArg = v.object({
    slug: v.string(),
    displayName: v.string(),
    family: v.string(),
    category: v.string(),
    capacity: v.union(v.string(), v.null()),
    capacityMl: v.union(v.number(), v.null()),
    color: v.union(v.string(), v.null()),
    bottleCollection: v.union(v.string(), v.null()),
    neckThreadSize: v.union(v.string(), v.null()),
    variantCount: v.number(),
    priceRangeMin: v.union(v.number(), v.null()),
    priceRangeMax: v.union(v.number(), v.null()),
    applicatorTypes: v.array(v.string()),
    primaryGraceSku: v.union(v.string(), v.null()),
    primaryWebsiteSku: v.union(v.string(), v.null()),
});

export const backfillMissingProducts = internalMutation({
    args: {
        groups: v.array(groupArg),
        products: v.array(v.any()),
        dryRun: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const dryRun = args.dryRun ?? true;
        const report = {
            dryRun,
            groupsCreated: [] as string[],
            groupsSkipped: [] as string[],
            productsInserted: [] as string[],
            productsSkipped: [] as string[],
            errors: [] as string[],
        };

        const groupIdBySlug = new Map<string, any>();
        for (const group of args.groups) {
            const existing = await ctx.db
                .query("productGroups")
                .withIndex("by_slug", (q) => q.eq("slug", group.slug))
                .first();
            if (existing) {
                groupIdBySlug.set(group.slug, existing._id);
                report.groupsSkipped.push(group.slug);
                continue;
            }
            if (!dryRun) {
                const id = await ctx.db.insert("productGroups", group);
                groupIdBySlug.set(group.slug, id);
            }
            report.groupsCreated.push(group.slug);
        }

        for (const raw of args.products) {
            const { _groupSlug, ...product } = raw;
            if (!product.graceSku || !product.websiteSku || !product.itemName) {
                report.errors.push(`missing identity fields: ${JSON.stringify(product.graceSku)}`);
                continue;
            }
            const existing = await ctx.db
                .query("products")
                .withIndex("by_graceSku", (q) => q.eq("graceSku", product.graceSku))
                .first();
            if (existing) {
                report.productsSkipped.push(product.graceSku);
                continue;
            }
            // Resolve group link: freshly created above, or already live.
            let groupId = _groupSlug ? groupIdBySlug.get(_groupSlug) : undefined;
            if (!groupId && _groupSlug) {
                const grp = await ctx.db
                    .query("productGroups")
                    .withIndex("by_slug", (q) => q.eq("slug", _groupSlug))
                    .first();
                if (grp) {
                    groupId = grp._id;
                    groupIdBySlug.set(_groupSlug, grp._id);
                } else if (!dryRun) {
                    report.errors.push(`${product.graceSku}: group slug "${_groupSlug}" not found — inserted without group link`);
                }
            }
            if (!dryRun) {
                await ctx.db.insert("products", {
                    ...product,
                    ...(groupId ? { productGroupId: groupId } : {}),
                });
            }
            report.productsInserted.push(product.graceSku);
        }

        // Bump variantCount on pre-existing groups that gained members.
        if (!dryRun) {
            for (const slug of report.groupsSkipped) {
                const gained = args.products.filter(
                    (p: any) => p._groupSlug === slug && report.productsInserted.includes(p.graceSku),
                ).length;
                if (gained === 0) continue;
                const grp = await ctx.db
                    .query("productGroups")
                    .withIndex("by_slug", (q) => q.eq("slug", slug))
                    .first();
                if (grp) {
                    await ctx.db.patch(grp._id, { variantCount: grp.variantCount + gained });
                }
            }
        }

        return report;
    },
});
