/**
 * CSV-driven productGroups rebuild.
 *
 * Materializes the Convex `productGroups` table from the canonical CSV
 * (`data/grace_products_final.v2.csv`). The CSV is the human-readable
 * source of truth and lives in git; this mutation makes Convex a
 * derived projection.
 *
 * Convex functions run in Convex's cloud runtime, which has no access to
 * the repo filesystem — so the CSV CONTENT is passed as an argument by a
 * local runner script that reads the file:
 *   node scripts/rebuild_product_groups.mjs               # dry-run
 *   node scripts/rebuild_product_groups.mjs --apply       # write changes
 *
 * The `dryRun` flag returns the diff without making changes.
 *
 * What the rebuild does, per group:
 *   1. Reads the CSV, computes canonical productGroups as
 *      (family, capacityMl, color) tuples with row counts.
 *   2. Upserts each: creates new ones, updates variantCount +
 *      lastSyncedAt + csvRowCount on existing ones.
 *   3. Returns a diff report showing created/updated/skipped groups
 *      and any orphans (groups in Convex not in CSV).
 *
 * IMPORTANT: orphan groups are NOT auto-deleted. The diff reports
 * them so a human can decide what to do. To delete orphans, use
 * `deleteOrphanedGroups` separately after review.
 *
 * ⛔ DO NOT RUN WITH --apply (verified 2026-07-11): buildGroupSlug()
 * below emits `family-capacityMl-color` slugs, but the LIVE productGroups
 * table uses the richer grammar from convex/migrations.ts buildSlug()
 * (`family-capacity-color-neckThread-applicator`, hyphenated colors).
 * Measured overlap between the two slug sets is 0 of 194 — applying
 * today would insert ~194 duplicate groups alongside the ~369 live ones.
 * Before --apply is ever safe: (1) reconcile buildGroupSlug with the
 * live slug grammar (or add a crosswalk table), (2) re-run the dry-run
 * and require `created: 0` with orphans ≈ 0. See docs/CSV_REBUILD_RUNBOOK.md.
 */

import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ── CSV parsing (mirrors scripts/backfill_color.mjs) ─────────────
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) { out.push(cur); cur = ""; }
    else { cur += ch; }
  }
  out.push(cur);
  return out;
}

interface CsvRow {
  grace_sku: string;
  website_sku: string;
  family: string;
  color: string;
  capacity: string;
  capacityMl: number | null;
  neck_thread_size: string;
  category: string;
  bottleCollection: string;
  price_1: string;
  canonical_slug: string;
}

function parseCsv(content: string): CsvRow[] {
  const raw = content.replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ""; });
    return obj as unknown as CsvRow;
  });
}

function parseCapacityMl(s: string): number | null {
  if (!s) return null;
  const m = String(s).match(/(\d+)\s*ml/i);
  return m ? parseInt(m[1], 10) : null;
}

function buildGroupSlug(family: string, capacityMl: number | null, color: string): string {
  const parts = [family.toLowerCase().replace(/\s+/g, "-")];
  if (capacityMl) parts.push(`${capacityMl}ml`);
  if (color && color !== "clear") parts.push(color);
  return parts.join("-");
}

// ── Compute canonical groups from CSV ────────────────────────────
interface CanonicalGroup {
  slug: string;
  family: string;
  capacity: string;
  capacityMl: number | null;
  color: string;
  category: string;
  bottleCollection: string;
  neckThreadSize: string;
  variantCount: number;
  graceSkus: string[];
  websiteSkus: string[];
  priceMin: number | null;
  priceMax: number | null;
  priceRangeMin: number | null;
  priceRangeMax: number | null;
}

function computeCanonicalGroups(csv: CsvRow[]): CanonicalGroup[] {
  const groups = new Map<string, CanonicalGroup>();
  for (const row of csv) {
    if (!row.family || !row.color || row.color === "n/a") continue;
    const capacityMl = parseCapacityMl(row.capacity);
    const slug = buildGroupSlug(row.family, capacityMl, row.color);
    let g = groups.get(slug);
    if (!g) {
      g = {
        slug,
        family: row.family,
        capacity: row.capacity,
        capacityMl,
        color: row.color,
        category: row.category || "Glass Bottle",
        bottleCollection: row.bottleCollection || "",
        neckThreadSize: row.neck_thread_size || "",
        variantCount: 0,
        graceSkus: [],
        websiteSkus: [],
        priceMin: null,
        priceMax: null,
        priceRangeMin: null,
        priceRangeMax: null,
      };
      groups.set(slug, g);
    }
    g.variantCount++;
    if (row.grace_sku) g.graceSkus.push(row.grace_sku);
    if (row.website_sku) g.websiteSkus.push(row.website_sku);
    const price = parseFloat(row.price_1);
    if (!isNaN(price)) {
      if (g.priceMin === null || price < g.priceMin) g.priceMin = price;
      if (g.priceMax === null || price > g.priceMax) g.priceMax = price;
    }
  }
  for (const g of groups.values()) {
    g.priceRangeMin = g.priceMin;
    g.priceRangeMax = g.priceMax;
  }
  return [...groups.values()];
}

// ── Action: rebuild productGroups from CSV ───────────────────────
/**
 * Safety interlock: a healthy sync updates existing groups in place and
 * creates at most a handful of genuinely new ones. A large create count
 * means the CSV slugs don't match the live slug grammar (see the header
 * warning) — applying would DUPLICATE the catalog rather than sync it. An
 * --apply that would create more than this many groups is refused unless
 * `force: true` is passed explicitly. Raise deliberately only after
 * buildGroupSlug has been reconciled and a dry-run has been reviewed.
 */
const APPLY_CREATE_LIMIT = 20;

export const rebuildFromCsv = action({
  args: {
    /** Full text of the canonical CSV (read locally by the runner script). */
    csvContent: v.string(),
    /** Human-readable source label for the report, e.g. the local file path. */
    csvLabel: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
    /**
     * Override the APPLY_CREATE_LIMIT interlock. Only pass this once
     * buildGroupSlug has been reconciled with the live slug grammar and a
     * dry-run has been reviewed. Ignored in dry-run mode.
     */
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    dryRun: boolean;
    csvLabel: string;
    csvRowCount: number;
    canonicalGroupCount: number;
    created: number;
    updated: number;
    unchanged: number;
    orphansInConvex: Array<{ slug: string; family: string; variantCount: number; primaryGraceSku: string | null }>;
    csvOnlyGroups: string[];
    sampleCanonical: CanonicalGroup[];
  }> => {
    const dryRun = args.dryRun ?? true;
    const force = args.force ?? false;

    const csv = parseCsv(args.csvContent);
    const canonical = computeCanonicalGroups(csv);
    const canonicalBySlug = new Map(canonical.map((g) => [g.slug, g]));

    // Fetch existing Convex productGroups
    const existing = await ctx.runQuery(internal.productGroupsRebuild.listAllGroups, {});
    const existingBySlug = new Map(existing.map((g) => [g.slug, g]));

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    if (!dryRun) {
      // Interlock: refuse to apply a run that would create an implausible
      // number of new groups — the signature of a slug-grammar mismatch that
      // would duplicate the catalog. Computed before any write happens.
      const plannedCreates = canonical.filter((g) => !existingBySlug.has(g.slug)).length;
      if (plannedCreates > APPLY_CREATE_LIMIT && !force) {
        throw new Error(
          `Refusing to apply: this run would create ${plannedCreates} new productGroups ` +
          `(limit ${APPLY_CREATE_LIMIT}). That almost always means buildGroupSlug does not ` +
          `match the live slug grammar and applying would DUPLICATE the catalog. ` +
          `Run a dry-run and reconcile buildGroupSlug first. If this create count is ` +
          `genuinely intended, re-run with force: true. See docs/CSV_REBUILD_RUNBOOK.md.`,
        );
      }
      for (const g of canonical) {
        const ex = existingBySlug.get(g.slug);
        const primaryGraceSku = g.graceSkus[0] ?? null;
        const primaryWebsiteSku = g.websiteSkus[0] ?? null;
        const displayName = `${g.family} ${g.capacityMl ?? ""}ml ${g.color}`.trim().replace(/\s+/g, " ");

        if (!ex) {
          await ctx.runMutation(internal.productGroupsRebuild.insertGroup, {
            slug: g.slug,
            displayName,
            family: g.family,
            capacity: g.capacity,
            capacityMl: g.capacityMl,
            color: g.color,
            category: g.category,
            bottleCollection: g.bottleCollection || undefined,
            neckThreadSize: g.neckThreadSize || undefined,
            variantCount: g.variantCount,
            priceRangeMin: g.priceRangeMin ?? undefined,
            priceRangeMax: g.priceRangeMax ?? undefined,
            primaryGraceSku: primaryGraceSku ?? undefined,
            primaryWebsiteSku: primaryWebsiteSku ?? undefined,
            csvRowCount: g.variantCount,
            lastSyncedAt: Date.now(),
          });
          created++;
        } else if (
          ex.variantCount !== g.variantCount
          || (ex.csvRowCount ?? 0) !== g.variantCount
          || ex.family !== g.family
          || ex.color !== g.color
          || ex.capacityMl !== g.capacityMl
        ) {
          await ctx.runMutation(internal.productGroupsRebuild.updateGroupStats, {
            id: ex._id,
            variantCount: g.variantCount,
            csvRowCount: g.variantCount,
            family: g.family,
            capacity: g.capacity,
            capacityMl: g.capacityMl,
            color: g.color,
            category: g.category,
            neckThreadSize: g.neckThreadSize,
            priceRangeMin: g.priceRangeMin,
            priceRangeMax: g.priceRangeMax,
            primaryGraceSku,
            primaryWebsiteSku,
            lastSyncedAt: Date.now(),
          });
          updated++;
        } else {
          unchanged++;
        }
      }
    } else {
      // Dry-run counts
      for (const g of canonical) {
        const ex = existingBySlug.get(g.slug);
        if (!ex) created++;
        else if (ex.variantCount !== g.variantCount || (ex.csvRowCount ?? 0) !== g.variantCount) updated++;
        else unchanged++;
      }
    }

    // Orphans in Convex not in CSV
    const orphansInConvex = existing
      .filter((g) => !canonicalBySlug.has(g.slug))
      .map((g) => ({
        slug: g.slug,
        family: g.family,
        variantCount: g.variantCount,
        primaryGraceSku: g.primaryGraceSku ?? null,
      }));

    // CSV-only groups (these are the same as canonical minus existing)
    const csvOnlyGroups = canonical
      .filter((g) => !existingBySlug.has(g.slug))
      .map((g) => g.slug);

    return {
      dryRun,
      csvLabel: args.csvLabel ?? "(inline csvContent)",
      csvRowCount: csv.length,
      canonicalGroupCount: canonical.length,
      created,
      updated,
      unchanged,
      orphansInConvex: orphansInConvex.slice(0, 100),
      csvOnlyGroups: csvOnlyGroups.slice(0, 100),
      sampleCanonical: canonical.slice(0, 5),
    };
  },
});

// ── Internal queries/mutations used by the rebuild action ────────
export const listAllGroups = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("productGroups").collect();
  },
});

export const insertGroup = internalMutation({
  args: {
    slug: v.string(),
    displayName: v.string(),
    family: v.string(),
    capacity: v.string(),
    capacityMl: v.union(v.number(), v.null()),
    color: v.string(),
    category: v.string(),
    bottleCollection: v.optional(v.string()),
    neckThreadSize: v.optional(v.string()),
    variantCount: v.number(),
    priceRangeMin: v.optional(v.number()),
    priceRangeMax: v.optional(v.number()),
    primaryGraceSku: v.optional(v.string()),
    primaryWebsiteSku: v.optional(v.string()),
    csvRowCount: v.number(),
    lastSyncedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("productGroups", {
      slug: args.slug,
      displayName: args.displayName,
      family: args.family,
      capacity: args.capacity,
      capacityMl: args.capacityMl,
      color: args.color,
      category: args.category,
      bottleCollection: args.bottleCollection ?? null,
      neckThreadSize: args.neckThreadSize ?? null,
      variantCount: args.variantCount,
      priceRangeMin: args.priceRangeMin ?? null,
      priceRangeMax: args.priceRangeMax ?? null,
      primaryGraceSku: args.primaryGraceSku ?? null,
      primaryWebsiteSku: args.primaryWebsiteSku ?? null,
      csvRowCount: args.csvRowCount,
      lastSyncedAt: args.lastSyncedAt,
    });
  },
});

export const updateGroupStats = internalMutation({
  args: {
    id: v.id("productGroups"),
    variantCount: v.number(),
    csvRowCount: v.number(),
    family: v.string(),
    capacity: v.string(),
    capacityMl: v.union(v.number(), v.null()),
    color: v.string(),
    category: v.string(),
    neckThreadSize: v.string(),
    priceRangeMin: v.union(v.number(), v.null()),
    priceRangeMax: v.union(v.number(), v.null()),
    primaryGraceSku: v.union(v.string(), v.null()),
    primaryWebsiteSku: v.union(v.string(), v.null()),
    lastSyncedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      variantCount: args.variantCount,
      csvRowCount: args.csvRowCount,
      family: args.family,
      capacity: args.capacity,
      capacityMl: args.capacityMl,
      color: args.color,
      category: args.category,
      neckThreadSize: args.neckThreadSize || null,
      priceRangeMin: args.priceRangeMin,
      priceRangeMax: args.priceRangeMax,
      primaryGraceSku: args.primaryGraceSku,
      primaryWebsiteSku: args.primaryWebsiteSku,
      lastSyncedAt: args.lastSyncedAt,
    });
    return args.id;
  },
});

export const deleteOrphanedGroups = internalMutation({
  args: {
    slugs: v.array(v.string()),
    confirm: v.literal("DELETE"),
  },
  handler: async (ctx, args) => {
    if (args.confirm !== "DELETE") {
      throw new Error("Confirmation required: pass confirm=\"DELETE\" to proceed");
    }
    let deleted = 0;
    for (const slug of args.slugs) {
      const group = await ctx.db
        .query("productGroups")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (group) {
        await ctx.db.delete(group._id);
        deleted++;
      }
    }
    return { deleted };
  },
});