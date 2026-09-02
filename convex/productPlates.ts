import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { verifyWriteToken } from "./writeToken";

/**
 * Paper-doll plates — the index over the storefront's product imagery.
 *
 * The bytes live on object storage; a row here is the only thing the page
 * consults, and a row's existence is its readiness. The importer writes a
 * row only after the object is uploaded and its public URL HEAD-verified,
 * so the page never has to guard against a URL that does not resolve, and
 * there is no release, draft or ready flag to fail silently.
 *
 * Convex has no unique constraints. One row per SKU is enforced inside
 * upsertMany — a serializable read-then-write — and audited by integrity.
 */

const plateAsset = v.object({
    url: v.string(),
    key: v.string(),
    sha256: v.string(),
    bytes: v.number(),
    width: v.number(),
    height: v.number(),
});

const viewV = v.object({
    view: v.union(v.literal("side"), v.literal("aerial"), v.literal("depth"), v.literal("measured"), v.literal("exploded")),
    cap: v.union(v.literal("on"), v.literal("off")),
    source: v.union(v.literal("photo"), v.literal("composite")),
    kitSha256: v.union(v.string(), v.null()),
    plate: plateAsset,
    thumb: v.union(plateAsset, v.null()),
});

const plateRowV = v.object({
    sku: v.string(),
    websiteSku: v.union(v.string(), v.null()),
    graceSku: v.union(v.string(), v.null()),
    familyId: v.string(),
    front: plateAsset,
    frontCapOff: v.union(plateAsset, v.null()),
    thumb: plateAsset,
    thumbCapOff: v.union(plateAsset, v.null()),
    views: v.array(viewV),
    source: v.object({
        library: v.string(),
        path: v.string(),
        psdSha256: v.union(v.string(), v.null()),
        psdSha256CapOff: v.union(v.string(), v.null()),
    }),
    builder: v.object({ name: v.string(), version: v.string(), builtAt: v.number() }),
    storageProvider: v.union(v.literal("vercel-blob"), v.literal("r2")),
});

const plateRefV = v.object({
    image: v.string(),
    imageCapOff: v.union(v.string(), v.null()),
    thumb: v.string(),
    thumbCapOff: v.union(v.string(), v.null()),
});

/** What the product page needs per SKU — deliberately tiny. */
export type PlateRef = {
    image: string;
    imageCapOff: string | null;
    thumb: string;
    thumbCapOff: string | null;
};

function toRef(row: Doc<"productPlates">): PlateRef {
    return {
        image: row.front.url,
        imageCapOff: row.frontCapOff?.url ?? null,
        thumb: row.thumb.url,
        thumbCapOff: row.thumbCapOff?.url ?? null,
    };
}

const MAX_SKUS_PER_LOOKUP = 200;

/**
 * The product page's one query: the plates for a group's variants, keyed by
 * the strings the caller passed (grace SKU and website SKU both resolve), so
 * the client's `platesBySku[graceSku] ?? platesBySku[websiteSku]` works
 * unchanged. Never the whole table. A duplicated SKU never throws: the newest
 * row wins and the SKU is reported in `conflicts`.
 */
export const forSkus = query({
    args: { skus: v.array(v.string()) },
    returns: v.object({ plates: v.record(v.string(), plateRefV), conflicts: v.array(v.string()) }),
    handler: async (ctx, args) => {
        const plates: Record<string, PlateRef> = {};
        const conflicts: string[] = [];
        const wanted = Array.from(new Set(args.skus.map((s) => s.trim()).filter(Boolean))).slice(0, MAX_SKUS_PER_LOOKUP);
        for (const sku of wanted) {
            const byGrace = await ctx.db.query("productPlates").withIndex("by_graceSku", (q) => q.eq("graceSku", sku)).collect();
            const byWebsite = await ctx.db.query("productPlates").withIndex("by_websiteSku", (q) => q.eq("websiteSku", sku)).collect();
            const seen = new Set<string>();
            const rows = [...byGrace, ...byWebsite].filter((row) => {
                if (seen.has(row._id)) return false;
                seen.add(row._id);
                return true;
            });
            if (rows.length === 0) continue;
            if (rows.length > 1) conflicts.push(sku);
            const newest = rows.sort((a, b) => b.importedAt - a.importedAt)[0];
            plates[sku] = toRef(newest);
        }
        return { plates, conflicts };
    },
});

/** A family's rows, for the lab swapper and rails. Paginated; never used by the product page. */
export const byFamily = query({
    args: {
        familyId: v.string(),
        cursor: v.optional(v.union(v.string(), v.null())),
        limit: v.optional(v.number()),
    },
    returns: v.object({
        isDone: v.boolean(),
        continueCursor: v.string(),
        page: v.array(v.object({
            sku: v.string(),
            websiteSku: v.union(v.string(), v.null()),
            graceSku: v.union(v.string(), v.null()),
            familyId: v.string(),
            image: v.string(),
            imageCapOff: v.union(v.string(), v.null()),
            thumb: v.string(),
            thumbCapOff: v.union(v.string(), v.null()),
            views: v.array(v.object({ view: v.string(), cap: v.string(), url: v.string(), thumb: v.union(v.string(), v.null()) })),
            sourcePath: v.string(),
            revision: v.number(),
        })),
    }),
    handler: async (ctx, args) => {
        const result = await ctx.db
            .query("productPlates")
            .withIndex("by_familyId", (q) => q.eq("familyId", args.familyId))
            .paginate({ numItems: Math.min(args.limit ?? 200, 500), cursor: args.cursor ?? null });
        return {
            isDone: result.isDone,
            continueCursor: result.continueCursor,
            page: result.page.map((row) => ({
                sku: row.sku,
                websiteSku: row.websiteSku,
                graceSku: row.graceSku,
                familyId: row.familyId,
                ...toRef(row),
                views: row.views.map((view) => ({ view: view.view, cap: view.cap, url: view.plate.url, thumb: view.thumb?.url ?? null })),
                sourcePath: row.source.path,
                revision: row.revision,
            })),
        };
    },
});

const familySummaryV = v.object({
    familyId: v.string(),
    name: v.string(),
    neckFinish: v.string(),
    canvas: v.object({ width: v.number(), height: v.number() }),
    closures: v.array(v.object({ id: v.string(), label: v.string(), count: v.number() })),
    variantCount: v.number(),
    publishedAt: v.number(),
});

export const families = query({
    args: {},
    returns: v.array(familySummaryV),
    handler: async (ctx) => {
        // a few hundred families at most; bounded rather than collected
        const rows = await ctx.db.query("plateFamilies").withIndex("by_familyId").take(500);
        return rows
            .map((f) => ({
                familyId: f.familyId,
                name: f.name,
                neckFinish: f.neckFinish,
                canvas: f.canvas,
                closures: f.closures,
                variantCount: f.variantCount,
                publishedAt: f.publishedAt,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    },
});

/**
 * Importer write path. One row per SKU: 0 existing → insert; 1 → patch with
 * revision + 1 (or "unchanged" when every hash already matches); more than
 * one → that row is refused and nothing is touched, because a duplicated
 * index is exactly what this table must never carry. Serializable, so two
 * importers cannot race a duplicate into existence.
 */
export const upsertMany = mutation({
    args: {
        writeToken: v.string(),
        rows: v.array(plateRowV),
    },
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
            const existing = await ctx.db.query("productPlates").withIndex("by_sku", (q) => q.eq("sku", row.sku)).collect();
            if (existing.length > 1) {
                results.push({ sku: row.sku, outcome: "error", error: "duplicate_index_rows" });
                continue;
            }
            if (existing.length === 0) {
                await ctx.db.insert("productPlates", { ...row, revision: 1, importedAt: now });
                results.push({ sku: row.sku, outcome: "inserted" });
                continue;
            }
            const current = existing[0];
            const unchanged =
                current.front.sha256 === row.front.sha256 &&
                (current.frontCapOff?.sha256 ?? null) === (row.frontCapOff?.sha256 ?? null) &&
                current.thumb.sha256 === row.thumb.sha256 &&
                (current.thumbCapOff?.sha256 ?? null) === (row.thumbCapOff?.sha256 ?? null) &&
                current.views.length === row.views.length &&
                current.views.every((view, i) => view.plate.sha256 === row.views[i]?.plate.sha256) &&
                current.graceSku === row.graceSku &&
                current.familyId === row.familyId;
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

export const upsertFamilies = mutation({
    args: {
        writeToken: v.string(),
        families: v.array(v.object({
            familyId: v.string(),
            name: v.string(),
            neckFinish: v.string(),
            canvas: v.object({ width: v.number(), height: v.number() }),
            closures: v.array(v.object({ id: v.string(), label: v.string(), count: v.number() })),
            bodyMask: v.union(plateAsset, v.null()),
            variantCount: v.number(),
            buildId: v.string(),
        })),
    },
    returns: v.object({ count: v.number() }),
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const now = Date.now();
        for (const family of args.families) {
            const existing = await ctx.db.query("plateFamilies").withIndex("by_familyId", (q) => q.eq("familyId", family.familyId)).collect();
            if (existing.length === 0) {
                await ctx.db.insert("plateFamilies", { ...family, publishedAt: now });
            } else {
                await ctx.db.patch(existing[0]._id, { ...family, publishedAt: now });
                for (const extra of existing.slice(1)) await ctx.db.delete(extra._id);
            }
        }
        return { count: args.families.length };
    },
});

const ALLOWED_URL_HOSTS = [/\.public\.blob\.vercel-storage\.com$/, /\.r2\.dev$/, /^images\.bestbottles\.com$/];

function hostAllowed(url: string): boolean {
    try {
        const host = new URL(url).hostname;
        return ALLOWED_URL_HOSTS.some((re) => re.test(host));
    } catch {
        return false;
    }
}

/**
 * Integrity sweep, paginated like graceIntegrity.sweepPage. Every issue is a
 * reason the page could show the wrong thing or nothing: a SKU with two index
 * rows, a plate whose product is gone, a grace SKU that disagrees with the
 * catalogue, a URL on a host the page does not trust. `scripts/paperdoll/verify.mjs`
 * runs this after every publish and exits non-zero on any issue.
 */
export const integrity = query({
    args: {
        cursor: v.union(v.string(), v.null()),
        pageSize: v.optional(v.number()),
    },
    returns: v.object({
        isDone: v.boolean(),
        continueCursor: v.string(),
        checked: v.number(),
        orphanPlates: v.number(),
        duplicateProducts: v.number(),
        issues: v.array(v.object({ sku: v.string(), issue: v.string(), detail: v.string() })),
    }),
    handler: async (ctx, args) => {
        const page = await ctx.db.query("productPlates").paginate({
            cursor: args.cursor,
            numItems: Math.min(Math.max(args.pageSize ?? 200, 1), 500),
        });
        const issues: Array<{ sku: string; issue: string; detail: string }> = [];
        let orphanPlates = 0;
        let duplicateProducts = 0;
        for (const row of page.page) {
            const sameSku = await ctx.db.query("productPlates").withIndex("by_sku", (q) => q.eq("sku", row.sku)).collect();
            if (sameSku.length > 1) issues.push({ sku: row.sku, issue: "duplicate_index_rows", detail: `${sameSku.length} rows` });

            const products = await ctx.db.query("products").withIndex("by_websiteSku", (q) => q.eq("websiteSku", row.sku)).collect();
            if (products.length === 0) {
                orphanPlates += 1;
                issues.push({ sku: row.sku, issue: "orphan_plate", detail: "no product carries this websiteSku" });
            } else {
                if (products.length > 1) {
                    duplicateProducts += 1;
                    issues.push({ sku: row.sku, issue: "products_duplicate_websiteSku", detail: `${products.length} products` });
                }
                if (row.graceSku && !products.some((p) => p.graceSku === row.graceSku)) {
                    issues.push({ sku: row.sku, issue: "grace_sku_mismatch", detail: `${row.graceSku} vs ${products.map((p) => p.graceSku).join(",")}` });
                }
            }

            const urls = [row.front.url, row.thumb.url, row.frontCapOff?.url, row.thumbCapOff?.url, ...row.views.map((view) => view.plate.url)];
            for (const url of urls) {
                if (url && !hostAllowed(url)) issues.push({ sku: row.sku, issue: "url_host_not_allowed", detail: url });
            }
            if (!row.front.url) issues.push({ sku: row.sku, issue: "missing_front", detail: "" });
        }
        return {
            isDone: page.isDone,
            continueCursor: page.continueCursor,
            checked: page.page.length,
            orphanPlates,
            duplicateProducts,
            issues,
        };
    },
});
