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
