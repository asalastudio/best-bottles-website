/**
 * matrix — the rows behind the Wholesale Matrix and Catalog QA.
 *
 * ONE CANONICAL CATALOG. The customer matrix and the staff QA view are the
 * same families and the same rows; QA only asks for extra diagnostics. There
 * is no separate matrix dataset to drift out of sync with `products`, and this
 * module creates none.
 *
 * NOT A FIFTH COMPATIBILITY ENGINE. Component resolution already lives in
 * convex/componentUtils.ts and is shared by grace.ts and products.ts. This
 * composes the same three calls in the same order —
 *   normalizeComponentsByType -> selectBestFitmentRule ->
 *   filterGroupedComponentsByFitmentRule
 * — so a fitment fix lands everywhere at once. If the matrix ever disagrees
 * with the PDP about what fits, that is a bug in one shared function rather
 * than a difference of opinion between two implementations.
 *
 * PRICE IS RESOLVED IN THE UI, ON PURPOSE. Jordan: "This is just one price.
 * It's not wholesale. It's one price." The single price a customer is charged
 * comes from resolveChargedUnitPrice() in src/lib/volumePricing.ts, which is
 * gated on VOLUME_TIERS_HONORED_AT_CHECKOUT because Shopify currently charges
 * the flat variant price. Convex cannot import from src/, so this returns the
 * tier fields and lets that one function decide — rather than reimplementing
 * the rule here and having two answers to "what will they be charged".
 *
 * UNKNOWN IS NOT COMPATIBLE. Every row says HOW its component list was
 * resolved. An empty list because a bottle genuinely takes no closure and an
 * empty list because nothing is recorded are opposite facts, and a matrix that
 * renders them identically will happily sell a customer a bottle with a cap
 * that does not fit it.
 */
import { query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { toClosureType } from "../src/lib/products/closureTypes";
import {
    normalizeComponentsByType,
    selectBestFitmentRule,
    filterGroupedComponentsByFitmentRule,
} from "./componentUtils";

/** How a row's component list came to be — carried to the UI so it can show
 *  the difference instead of flattening it. */
type Resolution =
    /** the bottle lists components AND a fitment rule narrowed them */
    | "fitment_rule"
    /** the bottle lists components; no rule matched, so they stand unfiltered */
    | "bottle_listed"
    /** nothing recorded — NOT the same as "takes nothing" */
    | "unknown";

// Cylinder alone is 382 rows, so a 400 cap was one product launch away from
// silently serving a partial family. Raised with room, and `truncated` still
// says so out loud if a family ever passes it.
const MAX_ROWS = 1200;

const MAX_GROUPS = 1500;

/**
 * Families for the accordion, from productGroups — the canonical family field,
 * never a hand-kept list.
 *
 * EIGHT OF THESE HAVE NO PRODUCTS. Measured 2026-09-01 against dev:
 * productGroups carries 38 distinct families, `products` only 30, and the
 * eight with nothing behind them are Apothecary, Bell, Cream Jar, Lotion
 * Bottle, Pillar, Tall Cylinder, Teardrop and one literally named "Unknown".
 * Listing them to a customer would open eight empty drawers, so the caller
 * says which it wants: the customer matrix asks for families that sell,
 * Catalog QA asks for all of them BECAUSE the empty ones are a finding.
 *
 * Emptiness is not resolved here. Counting products per family means reading
 * all 2,330 of them, which is the read that already forced getAllForAudit onto
 * a cursor after hitting Convex's 16MB limit. The row query answers it per
 * family, and a cached aggregate is the right home for the catalog-wide number
 * when someone needs it — not a scan on every page load.
 */
export const listFamilies = query({
    args: { includeEmpty: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const groups = await ctx.db.query("productGroups").take(MAX_GROUPS);
        const byFamily = new Map<string, { family: string; groups: number }>();
        for (const g of groups) {
            const f = (g.family ?? "").trim();
            if (!f) continue;
            const seen = byFamily.get(f);
            if (seen) seen.groups += 1;
            else byFamily.set(f, { family: f, groups: 1 });
        }
        const families = [...byFamily.values()]
            .sort((a, b) => a.family.localeCompare(b.family));
        // "Unknown" is a data defect wearing a family name. QA should see it;
        // a customer never should.
        return args.includeEmpty
            ? families
            : families.filter((f) => f.family.toLowerCase() !== "unknown");
    },
});

/**
 * The rows for one family, each with its server-resolved compatible
 * components. `diagnostics` turns the customer view into the QA view over the
 * SAME rows — never a second query with a second opinion.
 */
/**
 * A component reference is not a component.
 *
 * MEASURED 2026-09-01, across the first 12 of 38 families: bottles reference
 * 371 distinct component SKUs and only 73 of them are products that exist.
 * 294 are ghosts. Four are not SKUs at all -- the strings "✓" (offered on 49
 * bottles), "—" (21), "?" (20) and "N/A" (10) sit in components lists and were
 * being rendered as things a customer could buy.
 *
 * So every SKU is confirmed against `products` before it is offered. The
 * catalogue's own `category` field cannot do this job: the ghosts are absent
 * under EVERY category, and reading enough categories to build a trustworthy
 * allow-list blows the 16MB limit. A point read per DISTINCT SKU is exact and
 * assumes nothing.
 *
 * The reads are deduplicated across the whole family, so a 382-row family
 * costs one read per distinct component rather than one per row per component.
 */
const JUNK_SKU = /^(\?|n\/?a|—|–|-|✓|✔|x|tbd|none|null|na)$/i;

/**
 * A COMPONENT IS NOT ANY PRODUCT — IT IS A CLOSURE.
 *
 * Existence alone is too weak a test. The 5 ml Cobalt Blue Cylinder lists 23
 * components, and two of them — CMP-SPR-CLR-30ML and CMP-SPR-SLV- — are whole
 * 30 ml PLASTIC BOTTLES. They carry CMP- SKUs and they exist, so an existence
 * check waves them through and the picker offers a bottle as a cap for a
 * bottle.
 *
 * `capacityMl` cannot decide this: real sprayers and caps in this catalogue
 * carry 5, 30 and even 40 ml. `family` can. These are the families that hold
 * containers rather than closures — including two sitting inside
 * category "Component" (a 250 ml aluminium bottle and a cream jar).
 */
const CONTAINER_FAMILIES = new Set([
    "plastic bottle", "glass bottle", "aluminum bottle", "aluminium bottle",
    "roll-on bottle", "metal atomizer", "glass jar", "cream jar", "packaging",
]);
const COMPONENT_CATEGORIES = new Set(["component", "accessory"]);

type ComponentFacts = { category: string; family: string };

/** Is this resolved product actually a closure we can put on a bottle? */
function isClosure(f: ComponentFacts): boolean {
    return COMPONENT_CATEGORIES.has(f.category.toLowerCase())
        && !CONTAINER_FAMILIES.has(f.family.toLowerCase());
}

/**
 * The heading a buyer reads. The component's OWN family is authoritative —
 * inferring a type from the SKU or name is how a roll-on cap ends up filed
 * under "Sprayer". Wording comes from the shared vocabulary so this picker and
 * the bottle configurator name the same closure the same way.
 */
function displayType(family: string): string {
    return toClosureType(family).label;
}

/** Resolve each referenced SKU to what it actually is. Junk never reaches a read. */
async function resolveComponentFacts(
    ctx: QueryCtx,
    skus: Iterable<string>,
): Promise<Map<string, ComponentFacts>> {
    const facts = new Map<string, ComponentFacts>();
    const candidates = [...new Set(skus)].filter(
        (s) => s && !JUNK_SKU.test(s.trim()) && s.trim().length >= 5,
    );
    for (const sku of candidates) {
        const hit = await ctx.db
            .query("products")
            .withIndex("by_graceSku", (q) => q.eq("graceSku", sku))
            .first();
        if (hit) {
            facts.set(sku, {
                category: (hit.category ?? "").toString(),
                family: (hit.family ?? "").toString(),
            });
        }
    }
    return facts;
}

/**
 * Keep only real closures, and file each under its OWN family.
 *
 * Two rejects are reported separately because they are different faults with
 * different fixes: a `ghost` is a reference to a SKU that does not exist (fix
 * the reference), a `notAClosure` is a reference to a product that exists but
 * is a bottle or jar (fix the catalogue relationship).
 */
function keepRealComponents<T extends { graceSku?: string | null }>(
    grouped: Record<string, T[]>,
    facts: Map<string, ComponentFacts>,
): {
    kept: Record<string, T[]>;
    dropped: number;
    ghosts: string[];
    notClosures: string[];
} {
    const kept: Record<string, T[]> = {};
    const ghosts: string[] = [];
    const notClosures: string[] = [];
    let dropped = 0;

    for (const xs of Object.values(grouped)) {
        for (const x of xs) {
            const sku = x.graceSku ?? "";
            const f = sku ? facts.get(sku) : undefined;
            if (!f) { dropped += 1; if (sku) ghosts.push(sku); continue; }
            if (!isClosure(f)) { dropped += 1; notClosures.push(sku); continue; }
            const type = displayType(f.family);
            (kept[type] ??= []).push(x);
        }
    }
    return { kept, dropped, ghosts, notClosures };
}

export const getFamilyRows = query({
    args: { family: v.string(), diagnostics: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const bottles = await ctx.db
            .query("products")
            .withIndex("by_family", (q) => q.eq("family", args.family))
            .take(MAX_ROWS);

        // Fitment rules are keyed by thread, so fetch each thread ONCE rather
        // than per row. A family is one or two threads; without this a 400-row
        // family would issue 400 identical index reads.
        const threads = [...new Set(
            bottles.map((b) => (b.neckThreadSize ?? "").toString().trim()).filter(Boolean),
        )];
        const rulesByThread = new Map<string, unknown[]>();
        for (const t of threads) {
            rulesByThread.set(t, await ctx.db
                .query("fitments")
                .withIndex("by_threadSize", (q) => q.eq("threadSize", t))
                .collect());
        }

        // Every component SKU this family mentions, resolved to reality ONCE.
        const mentioned = new Set<string>();
        for (const b of bottles) {
            for (const xs of Object.values(normalizeComponentsByType(b.components))) {
                for (const x of xs) if (x.graceSku) mentioned.add(x.graceSku);
            }
        }
        const facts = await resolveComponentFacts(ctx, mentioned);

        const rows = bottles.map((b) => {
            const thread = (b.neckThreadSize ?? "").toString().trim();
            const grouped = normalizeComponentsByType(b.components);
            const rule = selectBestFitmentRule(rulesByThread.get(thread) ?? [], b);
            const fitted = filterGroupedComponentsByFitmentRule(grouped, rule);
            const { kept: resolved, dropped, ghosts, notClosures } =
                keepRealComponents(fitted, facts);

            const listed = Object.values(grouped).reduce((n, xs) => n + xs.length, 0);
            const offered = Object.values(resolved).reduce((n, xs) => n + xs.length, 0);
            // A row whose every component turned out to be a ghost knows
            // NOTHING about what fits it. Saying "no components" would read as
            // "takes none"; unknown is the honest answer, and the UI already
            // renders it as "compatibility not mapped".
            const resolution: Resolution =
                offered === 0 ? "unknown" : rule ? "fitment_rule" : "bottle_listed";

            return {
                graceSku: b.graceSku,
                websiteSku: b.websiteSku,
                itemName: b.itemName,
                // the fields getCustomerFacingProductName() composes a name
                // from — capacity + colour + family, then product type. A row
                // must be named the way the PDP names the same product, or
                // the matrix invents a second vocabulary for one catalog.
                family: b.family,
                applicator: b.applicator,
                category: b.category,
                capColor: b.capColor,
                capStyle: b.capStyle,
                // the row's own photograph — the matrix is a buying surface,
                // and a wall of text rows is far harder to scan than a wall
                // of bottles
                imageUrl: b.imageUrl,
                capacity: b.capacity,
                capacityMl: b.capacityMl,
                neckThreadSize: b.neckThreadSize,
                color: b.color,
                shape: b.shape,
                stockStatus: b.stockStatus,
                caseQuantity: b.caseQuantity,
                // tier fields, NOT a price: resolveChargedUnitPrice decides
                webPrice1pc: b.webPrice1pc,
                webPrice10pc: b.webPrice10pc,
                webPrice12pc: b.webPrice12pc,
                components: resolved,
                resolution,
                // Bottle Only is an EXPLICIT choice, never inferred from an
                // empty list. A row whose components are unknown offers it as
                // the only honest option; a row that resolved cleanly offers
                // it alongside the closures that actually fit.
                bottleOnly: true,
                ...(args.diagnostics ? {
                    diagnostics: {
                        listedComponentCount: listed,
                        resolvedComponentCount: offered,
                        // components the bottle lists that are not products —
                        // the worklist for catalogue cleanup, not just a count
                        ghostComponentCount: dropped,
                        ghostSkus: ghosts,
                        // exists, but is a bottle/jar rather than a closure
                        notClosureSkus: notClosures,
                        matchedFitmentRule: rule
                            ? (rule as { bottleName?: string }).bottleName ?? "(unnamed rule)"
                            : null,
                        threadPresent: Boolean(thread),
                        // the fields a row needs before it can be sold
                        missing: [
                            !b.graceSku && "graceSku",
                            !thread && "neckThreadSize",
                            b.webPrice1pc == null && "webPrice1pc",
                            !b.capacity && "capacity",
                            listed === 0 && "components",
                        ].filter(Boolean) as string[],
                    },
                } : {}),
            };
        });

        return {
            family: args.family,
            rowCount: rows.length,
            // say so rather than silently serving a partial family
            truncated: bottles.length === MAX_ROWS,
            rows,
        };
    },
});

/**
 * The resolved components for ONE bottle, by graceSku.
 *
 * ALL FAMILIES CANNOT SHIP ITS COMPONENTS. Measured 2026-09-01: the 2,471
 * matrix rows serialize to 24.59 MB with their component lists attached and
 * 2.08 MB without — 8%. The component arrays are 92% of the payload and are
 * needed only for the one row whose picker is open, so the all-families view
 * ships counts and calls this when a picker opens. A single row's components
 * are roughly 10 KB.
 *
 * This is the same three-call resolution as getFamilyRows, on one bottle —
 * NOT a second opinion about what fits.
 */
export const getRowComponents = query({
    args: { graceSku: v.string() },
    handler: async (ctx, args) => {
        const bottle = await ctx.db
            .query("products")
            .withIndex("by_graceSku", (q) => q.eq("graceSku", args.graceSku))
            .first();
        if (!bottle) return { components: {}, resolution: "unknown" as Resolution };

        const thread = (bottle.neckThreadSize ?? "").toString().trim();
        const rules = thread
            ? await ctx.db.query("fitments")
                .withIndex("by_threadSize", (q) => q.eq("threadSize", thread))
                .collect()
            : [];
        const grouped = normalizeComponentsByType(bottle.components);
        const rule = selectBestFitmentRule(rules, bottle);
        const fitted = filterGroupedComponentsByFitmentRule(grouped, rule);

        // same guard as getFamilyRows — the picker must never offer a SKU that
        // is not a product, and this is the path the all-families view uses
        const mentioned = new Set<string>();
        for (const xs of Object.values(fitted)) for (const x of xs) if (x.graceSku) mentioned.add(x.graceSku);
        const { kept: resolved } = keepRealComponents(
            fitted, await resolveComponentFacts(ctx, mentioned));

        const offered = Object.values(resolved).reduce((n, xs) => n + xs.length, 0);

        return {
            components: resolved,
            resolution: (offered === 0 ? "unknown" : rule ? "fitment_rule" : "bottle_listed") as Resolution,
        };
    },
});

/**
 * Family health for the QA view: how many rows in each family are missing
 * something that would stop them being sold.
 *
 * Deliberately scoped to ONE family per call. getAllForAudit already had to be
 * cursor-paginated after hitting Convex's 16MB read limit, and a whole-catalog
 * health sweep is the same shape of mistake — it wants a cached aggregate, not
 * a query that reads 2,330 products every time a staff page loads.
 */
export const getFamilyHealth = query({
    args: { family: v.string() },
    handler: async (ctx, args) => {
        const bottles = await ctx.db
            .query("products")
            .withIndex("by_family", (q) => q.eq("family", args.family))
            .take(MAX_ROWS);

        let complete = 0;
        const reasons: Record<string, number> = {};
        for (const b of bottles) {
            const thread = (b.neckThreadSize ?? "").toString().trim();
            const listed = Object.values(normalizeComponentsByType(b.components))
                .reduce((n, xs) => n + xs.length, 0);
            const missing = [
                !b.graceSku && "graceSku",
                !thread && "neckThreadSize",
                b.webPrice1pc == null && "webPrice1pc",
                !b.capacity && "capacity",
                listed === 0 && "components",
            ].filter(Boolean) as string[];
            if (missing.length === 0) complete += 1;
            for (const m of missing) reasons[m] = (reasons[m] ?? 0) + 1;
        }

        return {
            family: args.family,
            total: bottles.length,
            complete,
            // an empty family is 0/0 — report null rather than a flattering 100%
            completePct: bottles.length ? Math.round((complete / bottles.length) * 100) : null,
            reasons,
        };
    },
});
