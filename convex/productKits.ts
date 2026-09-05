import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { verifyWriteToken } from "./writeToken";

/**
 * Component kits — per-part alpha layers with anchors, registered pixel-for-
 * pixel to the SKU's plate. Read only when a customer opens the enhanced or
 * exploded view, never in the product page payload; hence a table of its own
 * with the same one-row-per-SKU discipline as productPlates.
 */

const plateAsset = v.object({
    url: v.string(),
    key: v.string(),
    sha256: v.string(),
    bytes: v.number(),
    width: v.number(),
    height: v.number(),
});

const slotV = v.union(
    v.literal("body"), v.literal("fitment"), v.literal("roller"), v.literal("cap"), v.literal("overcap"),
    v.literal("sprayer"), v.literal("pump"), v.literal("diptube"), v.literal("collar"), v.literal("bulb"),
    v.literal("tassel"), v.literal("reducer"), v.literal("pipette"),
);

const partV = v.object({
    slot: slotV,
    variantKey: v.union(v.string(), v.null()),
    zOrder: v.number(),
    explodeIndex: v.number(),
    bounds: v.object({ left: v.number(), top: v.number(), right: v.number(), bottom: v.number() }),
    assembled: v.object({ x: v.number(), y: v.number() }),
    exploded: v.object({ dx: v.number(), dy: v.number() }),
    image: plateAsset,
    image2x: v.union(plateAsset, v.null()),
    mask: v.union(plateAsset, v.null()),
    derivation: v.union(v.literal("psd-layer"), v.literal("madison"), v.literal("pair-difference"), v.literal("background-matte")),
});

const threeV = v.union(v.null(), v.object({
    bodyId: v.string(),
    glass: v.string(),
    finish: v.union(v.literal("13-415"), v.literal("15-415"), v.literal("17-415"), v.literal("18-415")),
    closureAssemblyKind: v.union(v.string(), v.null()),
    capMaterialId: v.union(v.string(), v.null()),
    trimMaterialId: v.union(v.string(), v.null()),
    rollerVariant: v.union(v.literal("metal"), v.literal("plastic"), v.null()),
}));

const anchorsV = v.object({
    axisX: v.number(),
    neckAxisX: v.union(v.number(), v.null()),
    seatY: v.number(),
    baselineY: v.number(),
    pxPerMm: v.union(v.number(), v.null()),
});

const kitRowV = v.object({
    sku: v.string(),
    websiteSku: v.union(v.string(), v.null()),
    graceSku: v.union(v.string(), v.null()),
    familyId: v.string(),
    plateSha256: v.string(),
    canvas: v.object({ width: v.number(), height: v.number() }),
    anchors: anchorsV,
    completeness: v.union(v.literal("full"), v.literal("capSplit"), v.literal("bodyOnly")),
    parts: v.array(partV),
    three: threeV,
    source: v.object({ library: v.string(), path: v.string(), releaseVersion: v.union(v.string(), v.null()) }),
    builder: v.object({ name: v.string(), version: v.string(), builtAt: v.number() }),
    storageProvider: v.union(v.literal("vercel-blob"), v.literal("r2")),
});

const kitViewV = v.object({
    sku: v.string(),
    familyId: v.string(),
    plateSha256: v.string(),
    canvas: v.object({ width: v.number(), height: v.number() }),
    anchors: anchorsV,
    completeness: v.union(v.literal("full"), v.literal("capSplit"), v.literal("bodyOnly")),
    parts: v.array(partV),
    three: threeV,
    conflicts: v.array(v.string()),
});

/**
 * One kit for one SKU, fetched by the stage on interaction. Exact website SKU first,
 * Grace SKU second, newest row wins, duplicates reported never thrown.
 */
export const forSku = query({
    args: { graceSku: v.union(v.string(), v.null()), websiteSku: v.union(v.string(), v.null()) },
    returns: v.union(kitViewV, v.null()),
    handler: async (ctx, args) => {
        const rows = [];
        if (args.graceSku) rows.push(...await ctx.db.query("productKits").withIndex("by_graceSku", (q) => q.eq("graceSku", args.graceSku)).collect());
        if (args.websiteSku) rows.push(...await ctx.db.query("productKits").withIndex("by_websiteSku", (q) => q.eq("websiteSku", args.websiteSku)).collect());
        const seen = new Set<string>();
        const unique = rows.filter((row) => { if (seen.has(row._id)) return false; seen.add(row._id); return true; });
        if (unique.length === 0) return null;
        // An exact website SKU is stronger evidence than an old Grace alias.
        const exact = args.websiteSku ? unique.filter((row) => row.websiteSku === args.websiteSku) : [];
        const newest = (exact.length ? exact : unique).sort((a, b) => b.importedAt - a.importedAt)[0];
        const plates = await ctx.db.query("productPlates").withIndex("by_sku", (q) => q.eq("sku", newest.sku)).collect();
        const plate = plates.length === 1 ? plates[0] : null;
        // Publication can replace a plate before its kit. During that interval
        // return the photograph rather than layering stale, misregistered parts.
        if (!plate || plate.front.sha256 !== newest.plateSha256) return null;
        return {
            sku: newest.sku,
            familyId: newest.familyId,
            plateSha256: newest.plateSha256,
            canvas: newest.canvas,
            anchors: newest.anchors,
            completeness: newest.completeness,
            parts: newest.parts,
            three: newest.three,
            conflicts: unique.length > 1 ? [newest.sku] : [],
        };
    },
});

export const upsertMany = mutation({
    args: { writeToken: v.string(), rows: v.array(kitRowV) },
    returns: v.array(v.object({
        sku: v.string(),
        outcome: v.union(v.literal("inserted"), v.literal("updated"), v.literal("unchanged"), v.literal("error")),
        error: v.optional(v.string()),
    })),
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        if (args.rows.length > 50) throw new Error("upsertMany accepts at most 50 rows per call");
        const now = Date.now();
        const results: Array<{ sku: string; outcome: "inserted" | "updated" | "unchanged" | "error"; error?: string }> = [];
        for (const row of args.rows) {
            const existing = await ctx.db.query("productKits").withIndex("by_sku", (q) => q.eq("sku", row.sku)).collect();
            if (existing.length > 1) {
                results.push({ sku: row.sku, outcome: "error", error: "duplicate_index_rows" });
                continue;
            }
            if (existing.length === 0) {
                await ctx.db.insert("productKits", { ...row, revision: 1, importedAt: now });
                results.push({ sku: row.sku, outcome: "inserted" });
                continue;
            }
            const current = existing[0];
            const unchanged = ["plateSha256", "parts", "completeness", "anchors", "canvas", "three", "source", "websiteSku", "graceSku", "familyId"].every(key =>
                JSON.stringify(current[key as keyof typeof current]) === JSON.stringify(row[key as keyof typeof row]));
            if (unchanged) {
                results.push({ sku: row.sku, outcome: "unchanged" });
                continue;
            }
            await ctx.db.patch(current._id, { ...row, revision: current.revision + 1, importedAt: now });
            results.push({ sku: row.sku, outcome: "updated" });
        }
        return results;
    },
});

/**
 * Integrity: one row per SKU, a plate exists for it, and the kit is
 * registered to the plate that is actually published (plateSha256 matches
 * the plate row's front). A stale kit would mis-register the enhanced view
 * by exactly the pixels the plate moved.
 */
export const integrity = query({
    args: { cursor: v.union(v.string(), v.null()), pageSize: v.optional(v.number()) },
    returns: v.object({
        isDone: v.boolean(),
        continueCursor: v.string(),
        checked: v.number(),
        issues: v.array(v.object({ sku: v.string(), issue: v.string(), detail: v.string() })),
    }),
    handler: async (ctx, args) => {
        const page = await ctx.db.query("productKits").paginate({
            cursor: args.cursor,
            numItems: Math.min(Math.max(args.pageSize ?? 200, 1), 500),
        });
        const issues: Array<{ sku: string; issue: string; detail: string }> = [];
        for (const kit of page.page) {
            const sameSku = await ctx.db.query("productKits").withIndex("by_sku", (q) => q.eq("sku", kit.sku)).collect();
            if (sameSku.length > 1) issues.push({ sku: kit.sku, issue: "duplicate_index_rows", detail: `${sameSku.length} rows` });
            const plates = await ctx.db.query("productPlates").withIndex("by_sku", (q) => q.eq("sku", kit.sku)).collect();
            if (plates.length === 0) {
                issues.push({ sku: kit.sku, issue: "kit_without_plate", detail: "" });
            } else if (!plates.some((plate) => plate.front.sha256 === kit.plateSha256)) {
                issues.push({ sku: kit.sku, issue: "kit_stale_plate", detail: `kit ${kit.plateSha256.slice(0, 12)} vs plate ${plates[0].front.sha256.slice(0, 12)}` });
            }
            if (!kit.parts.some((part) => part.slot === "body")) issues.push({ sku: kit.sku, issue: "kit_without_body", detail: "" });
        }
        return { isDone: page.isDone, continueCursor: page.continueCursor, checked: page.page.length, issues };
    },
});
