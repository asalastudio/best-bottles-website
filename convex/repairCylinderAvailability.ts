import { internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import proposal from "../docs/reviews/cylinder-component-coverage-2026-09-22/stock-reconciliation.json";

export function planCylinderAvailability(product: Doc<"products">, source: typeof proposal.rows[number]) {
    for (const field of ["websiteSku", "graceSku", "family", "capacityMl", "color", "neckThreadSize", "applicator"] as const)
        if (product[field] !== source[field]) throw Error(`Cylinder availability identity changed: ${source.websiteSku} (${field})`);
    if (product.stockStatus === source.proposedStockStatus) return null;
    if (product.stockStatus !== source.beforeStockStatus || product.shopifySellable !== true || !product.shopifyVariantId)
        throw Error(`Cylinder availability needs fresh review: ${source.websiteSku}`);
    return { stockStatus: source.proposedStockStatus };
}

/** Operator-only reconciliation. A deploy never applies it. Refresh the source
 * pages before applying; this records orderability, never an inventory count.
 * All rows must pass before the transaction writes. Receipts retain rollback values. */
export const run = internalMutation({
    args: { dryRun: v.optional(v.boolean()) },
    handler: async (ctx, { dryRun = true }) => {
        const changes = [];
        for (const source of proposal.rows) {
            const product = await ctx.db.query("products").withIndex("by_websiteSku", q => q.eq("websiteSku", source.websiteSku)).unique();
            if (!product) throw Error(`Missing Cylinder assembly: ${source.websiteSku}`);
            const after = planCylinderAvailability(product, source);
            if (after) changes.push({ id: product._id, sku: product.websiteSku,
                before: { stockStatus: product.stockStatus }, after, sourceUrl: source.sourceUrl,
                sourceSha256: source.sourceSha256, checkedAt: source.checkedAt });
        }
        if (!dryRun) for (const change of changes) await ctx.db.patch(change.id, change.after);
        return { dryRun, changes };
    },
});
