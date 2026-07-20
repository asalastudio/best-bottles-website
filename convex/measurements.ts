/**
 * Measurement-field repair (2026-07-20).
 *
 * Three plastic-cylinder rows carried a mangled import: heightWithoutCap held
 * BOTH measurements concatenated ("156 ±2 mm Item Diameter: 51 ±1") and
 * diameter was null — which made Madison's measurement gate omit them from
 * every Cylinder batch ("3 family SKUs omitted from batch until measured").
 * Clean values restored from best-bottles-master-truth.csv.
 */
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const fixMeasurementFields = internalMutation({
    args: {
        items: v.array(v.object({
            graceSku: v.string(),
            heightWithoutCap: v.string(),
            diameter: v.string(),
        })),
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
                    heightWithoutCap: item.heightWithoutCap,
                    diameter: item.diameter,
                });
                patched += 1;
            }
        }
        return { patched, missing };
    },
});
