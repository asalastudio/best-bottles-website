import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { verifyWriteToken } from "./writeToken";

/**
 * Guarded catalogue corrections for descriptive fields the Team Hub editor does not expose.
 *
 * 2026-09-25: ten clear-glass 9 mL Cylinder rows carried the glass colour "Clear" as their cap
 * colour, and the 17-415 turquoise sprayer carried "Shiny" (see
 * scripts/catalog-corrections/2026-09-25-cyl9-cap-colours.mjs and data/register/report.md).
 *
 * Every write is conditional: a field changes only while it still holds `expect`. A row someone
 * has since edited is reported as `changedSince` and left alone, so a second run is a no-op.
 * Only the fields in `fieldsV` can be written. `dryRun` defaults to TRUE. Each field written
 * leaves one catalogChangeLog entry; to undo, run again with expect and patch swapped.
 */

const fieldsV = v.object({
    capColor: v.optional(v.union(v.string(), v.null())),
    // 2026-09-25: the four 1 ml plug vials carried cap lengths ("Tall", "Applicator") as their
    // cap style, so the catalog swatch read "Tall White"; their closure is a plug.
    capStyle: v.optional(v.union(v.string(), v.null())),
});
type Fields = { capColor?: string | null; capStyle?: string | null };

export const correctProductFields = mutation({
    args: {
        writeToken: v.string(),
        dryRun: v.optional(v.boolean()),
        reason: v.string(),
        entries: v.array(v.object({ websiteSku: v.string(), expect: fieldsV, patch: fieldsV })),
    },
    returns: v.object({
        dryRun: v.boolean(),
        written: v.array(v.object({ websiteSku: v.string(), field: v.string(), before: v.union(v.string(), v.null()), after: v.union(v.string(), v.null()) })),
        alreadyCorrect: v.array(v.string()),
        changedSince: v.array(v.object({ websiteSku: v.string(), field: v.string(), now: v.union(v.string(), v.null()) })),
        notFound: v.array(v.string()),
    }),
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        if (args.entries.length > 50) throw new Error("at most 50 entries per call");
        if (!args.reason.trim()) throw new Error("a reason is required");
        const dryRun = args.dryRun !== false;
        const at = Date.now();
        const out = {
            dryRun,
            written: [] as { websiteSku: string; field: string; before: string | null; after: string | null }[],
            alreadyCorrect: [] as string[],
            changedSince: [] as { websiteSku: string; field: string; now: string | null }[],
            notFound: [] as string[],
        };
        for (const entry of args.entries) {
            const rows = await ctx.db.query("products").withIndex("by_websiteSku", q => q.eq("websiteSku", entry.websiteSku)).take(2);
            if (rows.length !== 1) { out.notFound.push(entry.websiteSku); continue; }
            const row = rows[0];
            const write: Fields = {};
            for (const field of Object.keys(entry.patch) as (keyof Fields)[]) {
                const now = row[field] ?? null;
                const target = entry.patch[field] ?? null;
                if (now === target) { out.alreadyCorrect.push(`${entry.websiteSku}.${field}`); continue; }
                if (!(field in entry.expect) || now !== (entry.expect[field] ?? null)) { out.changedSince.push({ websiteSku: entry.websiteSku, field, now }); continue; }
                write[field] = target;
                out.written.push({ websiteSku: entry.websiteSku, field, before: now, after: target });
                if (!dryRun) {
                    await ctx.db.insert("catalogChangeLog", {
                        targetType: "product", targetId: String(row._id), label: entry.websiteSku, field,
                        before: JSON.stringify(now), after: JSON.stringify(target),
                        actorId: "catalog-correction", actorEmail: null, at, source: `catalog-correction: ${args.reason}`,
                    });
                }
            }
            if (!dryRun && Object.keys(write).length) await ctx.db.patch(row._id, write);
        }
        return out;
    },
});
