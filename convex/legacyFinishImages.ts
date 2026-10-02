import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { verifyWriteToken } from "./writeToken";
import patches from "../data/migrations/legacy-finish-images-2026-10-02/patches.json";

/** Exact cutover allowlist. No caller-supplied URLs; no Grace alias fallback.
 * Upload and verify every immutable Blob before applying this transaction.
 * A later image edit or identity change aborts the entire batch. Kit/register
 * layers, plates, product groups and commercial fields are never patched. */
export const migrate = mutation({
    args: {
        writeToken: v.string(),
        dryRun: v.optional(v.boolean()),
        rollback: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const pending = [];
        const unchanged: string[] = [];
        for (const entry of patches) {
            const product = await ctx.db.query("products")
                .withIndex("by_websiteSku", q => q.eq("websiteSku", entry.websiteSku)).unique();
            if (!product || product.graceSku !== entry.graceSku || product.category !== "Component") {
                throw new Error(`legacy_finish_identity_changed:${entry.websiteSku}`);
            }
            const before = args.rollback ? entry.imageUrl : entry.expectedUrl;
            const after = args.rollback ? entry.expectedUrl : entry.imageUrl;
            if (product.imageUrl === after) { unchanged.push(entry.websiteSku); continue; }
            if (product.imageUrl !== before) throw new Error(`legacy_finish_image_changed:${entry.websiteSku}`);
            pending.push({ id: product._id, sku: entry.websiteSku, before, after });
        }
        const dryRun = args.dryRun !== false;
        if (!dryRun) {
            const at = Date.now();
            for (const entry of pending) {
                await ctx.db.patch(entry.id, { imageUrl: entry.after });
                await ctx.db.insert("catalogChangeLog", {
                    targetType: "product", targetId: entry.id, label: entry.sku, field: "imageUrl",
                    before: JSON.stringify(entry.before), after: JSON.stringify(entry.after),
                    actorId: "legacy-finish-image-migration", actorEmail: null, at,
                    source: `legacy-finish-images-2026-10-02:${args.rollback ? "rollback" : "migration"}`,
                });
            }
        }
        return { dryRun, rollback: Boolean(args.rollback), changed: pending.map(p => p.sku), unchanged };
    },
});
