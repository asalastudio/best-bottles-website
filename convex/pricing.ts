/**
 * Tiered-pricing loader (2026-07-20).
 *
 * Source: legacy bestbottles.com PDP quantity ladders, scraped by
 * scripts/scrape-legacy-tier-pricing.mjs into
 * data/audits/legacy-tier-pricing-2026-07-20/tiers.jsonl, then cross-referenced
 * against products.webPrice1pc (scripts run 2026-07-20: 2,297/2,313 exact
 * matches). Only cross-reference-PASSING rows may be loaded here — mismatches
 * stay in the review report for Jordan.
 */
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const tierValidator = v.object({
    minQty: v.number(),
    totalPrice: v.number(),
    unitPrice: v.number(),
});

export const setPriceTiersBatch = internalMutation({
    args: {
        items: v.array(v.object({
            graceSku: v.string(),
            tiers: v.array(tierValidator),
        })),
        syncedAt: v.number(),
    },
    handler: async (ctx, args) => {
        let patched = 0;
        const missing: string[] = [];
        for (const item of args.items) {
            const products = await ctx.db
                .query("products")
                .withIndex("by_graceSku", (q) => q.eq("graceSku", item.graceSku))
                .collect();
            if (products.length === 0) {
                missing.push(item.graceSku);
                continue;
            }
            for (const product of products) {
                await ctx.db.patch(product._id, {
                    priceTiers: item.tiers,
                    priceTiersSyncedAt: args.syncedAt,
                });
                patched += 1;
            }
        }
        return { patched, missing };
    },
});

/**
 * Site-truth pricing overwrite (2026-08-06).
 *
 * Direction is INVERTED from setPriceTiersBatch: the live bestbottles.com
 * page is the source of truth and Convex is overwritten to match — no
 * webPrice1pc cross-reference gate. Source: scripts/scrape_live_tier_pricing.mjs
 * → docs/reviews/audit-2026-08-06/live-site-full-scrape.json, applied by
 * scripts/apply_live_site_pricing.mjs. Rows the site prices at $0, pages with
 * no purchase ladder, and SKUs absent from the site are NOT sent here — they
 * stay on the Abbas/Magni reconciliation sheet.
 *
 * webPrice10pc/webPrice12pc are set from the site's actual qty-10/qty-12 tier
 * (null when the page has no such tier), so both fields mirror the page
 * exactly — packaging breaks at 10, most glass at 12.
 */
export const applySitePricingBatch = internalMutation({
    args: {
        items: v.array(v.object({
            websiteSku: v.string(),
            // When set, the row is resolved by graceSku instead of websiteSku —
            // used for products whose Convex websiteSku differs from the site's
            // Item Name but whose page identity was verified another way.
            graceSku: v.optional(v.string()),
            webPrice1pc: v.number(),
            webPrice10pc: v.union(v.number(), v.null()),
            webPrice12pc: v.union(v.number(), v.null()),
            tiers: v.array(tierValidator),
        })),
        syncedAt: v.number(),
        dryRun: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const dryRun = args.dryRun ?? false;
        let patched = 0;
        let unchanged = 0;
        const missing: string[] = [];
        const changes = { p1: 0, p10: 0, p12: 0, tiers: 0 };
        const samples: Array<Record<string, unknown>> = [];
        const near = (a: number | null | undefined, b: number | null | undefined) =>
            (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 0.005);
        for (const item of args.items) {
            const graceSku = item.graceSku;
            const products = graceSku
                ? await ctx.db
                    .query("products")
                    .withIndex("by_graceSku", (q) => q.eq("graceSku", graceSku))
                    .collect()
                : await ctx.db
                    .query("products")
                    .withIndex("by_websiteSku", (q) => q.eq("websiteSku", item.websiteSku))
                    .collect();
            if (products.length === 0) {
                missing.push(graceSku ?? item.websiteSku);
                continue;
            }
            for (const product of products) {
                const p1 = !near(product.webPrice1pc, item.webPrice1pc);
                const p10 = !near(product.webPrice10pc, item.webPrice10pc);
                const p12 = !near(product.webPrice12pc, item.webPrice12pc);
                const tiersDiffer = JSON.stringify(product.priceTiers ?? null) !== JSON.stringify(item.tiers);
                if (p1) changes.p1 += 1;
                if (p10) changes.p10 += 1;
                if (p12) changes.p12 += 1;
                if (tiersDiffer) changes.tiers += 1;
                if (!(p1 || p10 || p12 || tiersDiffer)) {
                    unchanged += 1;
                    continue;
                }
                if ((p1 || p10 || p12) && samples.length < 8) {
                    samples.push({
                        websiteSku: item.websiteSku,
                        webPrice1pc: [product.webPrice1pc, item.webPrice1pc],
                        webPrice10pc: [product.webPrice10pc, item.webPrice10pc],
                        webPrice12pc: [product.webPrice12pc, item.webPrice12pc],
                    });
                }
                if (!dryRun) {
                    await ctx.db.patch(product._id, {
                        webPrice1pc: item.webPrice1pc,
                        webPrice10pc: item.webPrice10pc,
                        webPrice12pc: item.webPrice12pc,
                        priceTiers: item.tiers,
                        priceTiersSyncedAt: args.syncedAt,
                    });
                }
                patched += 1;
            }
        }
        return { dryRun, patched, unchanged, missing, changes, samples };
    },
});

/**
 * Recompute productGroups.priceRangeMin/Max from members' webPrice1pc, the
 * same rule buildProductGroups uses (null/0 prices excluded). Run after any
 * bulk webPrice1pc patch. Batched like reconcileProductGroups: loop skip
 * 0, 50, 100, ... until groupsScanned < take.
 */
export const refreshGroupPriceRanges = internalMutation({
    args: {
        dryRun: v.optional(v.boolean()),
        skip: v.optional(v.number()),
        take: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const dryRun = args.dryRun ?? true;
        const skip = args.skip ?? 0;
        const take = args.take ?? 50;
        const groups = (await ctx.db.query("productGroups").collect()).slice(skip, skip + take);
        const patched: Array<{ slug: string; min: [number | null, number | null]; max: [number | null, number | null] }> = [];
        for (const g of groups) {
            const members: Doc<"products">[] = await ctx.db
                .query("products")
                .withIndex("by_productGroupId", (q) => q.eq("productGroupId", g._id))
                .collect();
            let min: number | null = null;
            let max: number | null = null;
            for (const m of members) {
                const price = m.webPrice1pc;
                if (price != null && price > 0) {
                    if (min == null || price < min) min = price;
                    if (max == null || price > max) max = price;
                }
            }
            if (g.priceRangeMin !== min || g.priceRangeMax !== max) {
                patched.push({ slug: g.slug, min: [g.priceRangeMin, min], max: [g.priceRangeMax, max] });
                if (!dryRun) await ctx.db.patch(g._id, { priceRangeMin: min, priceRangeMax: max });
            }
        }
        return { dryRun, groupsScanned: groups.length, patchedCount: patched.length, patched };
    },
});
