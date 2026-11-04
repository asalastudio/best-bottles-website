import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Guarded repair of catalogue rows a Shopify webhook overwrote.
 *
 * 2026-09-20: activating 37 draft Shopify products fired products/update, and the
 * handler of the day renamed 394 SKUs, marked them Out of Stock, overwrote a
 * price, replaced 36 groups' hero / description / primary SKU and inserted 98
 * shell rows (see convex/shopifySync.ts). These mutations undo exactly that.
 *
 * Every write is conditional. A field is restored only while it still holds the
 * value the webhook left (`expect`): a row someone has since corrected is
 * reported as `changedSince` and left alone, and a second run is a no-op. Only
 * the named fields can be written. `dryRun` defaults to TRUE.
 */

function verifyWriteToken(writeToken: string) {
    const expected = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!expected) throw new Error("convex_write_token_not_configured");
    if (writeToken !== expected) throw new Error("unauthorized_convex_write");
}

const productFields = v.object({
    itemName: v.optional(v.union(v.string(), v.null())),
    stockStatus: v.optional(v.union(v.string(), v.null())),
    webPrice1pc: v.optional(v.union(v.number(), v.null())),
});
const groupFields = v.object({
    displayName: v.optional(v.string()),
    heroImageUrl: v.optional(v.union(v.string(), v.null())),
    groupDescription: v.optional(v.union(v.string(), v.null())),
    primaryGraceSku: v.optional(v.union(v.string(), v.null())),
    primaryWebsiteSku: v.optional(v.union(v.string(), v.null())),
    variantCount: v.optional(v.number()),
    // 2026-11-04: moving the Pillar rollers into their own page leaves both pages' "From $" ranges stale.
    priceRangeMin: v.optional(v.union(v.number(), v.null())),
    priceRangeMax: v.optional(v.union(v.number(), v.null())),
});

type Fields = Record<string, string | number | null | undefined>;
/** Which of `patch` may be written: the field must still hold `expect`. */
function decide(current: Fields, expect: Fields, patch: Fields) {
    const write: Fields = {}; const changedSince: string[] = []; let already = 0;
    for (const [field, value] of Object.entries(patch)) {
        const now = current[field] ?? null;
        if (now === (value ?? null)) { already++; continue; }
        if (!(field in expect) || now !== (expect[field] ?? null)) { changedSince.push(field); continue; }
        write[field] = value ?? null;
    }
    return { write, changedSince, already };
}

export const restoreProductFields = mutation({
    args: {
        writeToken: v.string(),
        dryRun: v.optional(v.boolean()),
        entries: v.array(v.object({ graceSku: v.string(), expect: productFields, patch: productFields })),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        if (args.entries.length > 200) throw new Error("at most 200 entries per call");
        const dryRun = args.dryRun !== false;
        const out = { dryRun, restored: 0, fieldsWritten: 0, alreadyCorrect: 0, notFound: [] as string[], changedSince: [] as { graceSku: string; fields: string[] }[] };
        for (const entry of args.entries) {
            const matches = await ctx.db.query("products").withIndex("by_graceSku", (q) => q.eq("graceSku", entry.graceSku)).take(2);
            if (matches.length !== 1) { out.notFound.push(entry.graceSku); continue; }
            const { write, changedSince, already } = decide(matches[0] as unknown as Fields, entry.expect, entry.patch);
            if (changedSince.length) out.changedSince.push({ graceSku: entry.graceSku, fields: changedSince });
            if (Object.keys(write).length === 0) { if (already && !changedSince.length) out.alreadyCorrect++; continue; }
            if (!dryRun) await ctx.db.patch(matches[0]._id, write as never);
            out.restored++; out.fieldsWritten += Object.keys(write).length;
        }
        return out;
    },
});

export const restoreGroupFields = mutation({
    args: {
        writeToken: v.string(),
        dryRun: v.optional(v.boolean()),
        entries: v.array(v.object({ slug: v.string(), expect: groupFields, patch: groupFields })),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        if (args.entries.length > 100) throw new Error("at most 100 entries per call");
        const dryRun = args.dryRun !== false;
        const out = { dryRun, restored: 0, fieldsWritten: 0, alreadyCorrect: 0, notFound: [] as string[], changedSince: [] as { slug: string; fields: string[] }[] };
        for (const entry of args.entries) {
            const group = await ctx.db.query("productGroups").withIndex("by_slug", (q) => q.eq("slug", entry.slug)).first();
            if (!group) { out.notFound.push(entry.slug); continue; }
            const { write, changedSince, already } = decide(group as unknown as Fields, entry.expect, entry.patch);
            if (changedSince.length) out.changedSince.push({ slug: entry.slug, fields: changedSince });
            if (Object.keys(write).length === 0) { if (already && !changedSince.length) out.alreadyCorrect++; continue; }
            if (!dryRun) await ctx.db.patch(group._id, write as never);
            out.restored++; out.fieldsWritten += Object.keys(write).length;
        }
        return out;
    },
});

/**
 * Give a product its price ladder when it has none (2026-11-04: GBPillar9SpryBlkMatt was imported with only the 1-piece
 * price, so its page offered "Set of 1" alone). Refuses a product that already has tiers, or whose 1-piece price is not
 * the ladder's first rung, so it can only fill a gap, never reprice. Dry run unless dryRun is false.
 */
export const setMissingPriceLadder = mutation({
    args: {
        writeToken: v.string(),
        dryRun: v.optional(v.boolean()),
        websiteSku: v.string(),
        priceTiers: v.array(v.object({ minQty: v.number(), unitPrice: v.number(), totalPrice: v.number() })),
    },
    returns: v.object({ dryRun: v.boolean(), written: v.boolean(), detail: v.string() }),
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const dryRun = args.dryRun !== false;
        const rows = await ctx.db.query("products").withIndex("by_websiteSku", (q) => q.eq("websiteSku", args.websiteSku)).take(2);
        if (rows.length !== 1) return { dryRun, written: false, detail: `${rows.length} products carry this websiteSku` };
        const row = rows[0];
        if ((row.priceTiers ?? []).length > 0) return { dryRun, written: false, detail: "already has a price ladder" };
        const tiers = [...args.priceTiers].sort((a, b) => a.minQty - b.minQty);
        if (tiers.length < 2 || tiers[0].minQty !== 1) return { dryRun, written: false, detail: "a ladder starts at 1 piece and has at least two rungs" };
        if (row.webPrice1pc !== tiers[0].unitPrice) return { dryRun, written: false, detail: `the 1-piece price is ${row.webPrice1pc}, not ${tiers[0].unitPrice}` };
        const at12 = tiers.find((t) => t.minQty === 12)?.unitPrice ?? null;
        if (!dryRun) await ctx.db.patch(row._id, { priceTiers: tiers, webPrice12pc: at12 ?? row.webPrice12pc });
        return { dryRun, written: !dryRun, detail: `ladder ${tiers.map((t) => `${t.minQty}+ $${t.unitPrice}`).join(", ")}` };
    },
});

/**
 * Remove rows the webhook inserted for Shopify variants the catalogue never listed.
 * A row is deleted only if it is, structurally, nothing but such a shell: the id AND
 * the SKU both match, and it carries no family, no applicator, no neck, no capacity,
 * no components, is unverified, and its two SKUs are the same string (the webhook
 * wrote the Shopify SKU into both). Anything else is refused and reported.
 */
export const removeWebhookShellRows = mutation({
    args: {
        writeToken: v.string(),
        dryRun: v.optional(v.boolean()),
        rows: v.array(v.object({ id: v.id("products"), graceSku: v.string() })),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        if (args.rows.length > 200) throw new Error("at most 200 rows per call");
        const dryRun = args.dryRun !== false;
        const out = { dryRun, removed: 0, alreadyGone: 0, refused: [] as { graceSku: string; why: string }[] };
        for (const { id, graceSku } of args.rows) {
            const row = await ctx.db.get(id);
            if (!row) { out.alreadyGone++; continue; }
            const why =
                row.graceSku !== graceSku ? "id and SKU do not match"
                : row.websiteSku !== row.graceSku ? "has its own website SKU"
                : row.family || row.applicator || row.neckThreadSize || row.capacityMl ? "carries catalogue attributes"
                : row.verified ? "is a verified product"
                : (row.components ?? []).length > 0 ? "has components"
                : null;
            if (why) { out.refused.push({ graceSku, why }); continue; }
            if (!dryRun) await ctx.db.delete(id);
            out.removed++;
        }
        return out;
    },
});
