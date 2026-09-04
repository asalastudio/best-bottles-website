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
import { query } from "./_generated/server";
import { v } from "convex/values";
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
 * The customer path verifies each candidate through the indexed product query.
 * That is at most one tiny indexed read per family, not a whole-catalog scan;
 * it prevents a customer from landing on an empty buying surface.
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
        if (args.includeEmpty) return families;

        // "Unknown" is a data defect wearing a family name. QA should see it;
        // a customer never should. Every remaining entry has a product behind
        // it, checked with the existing family index rather than a full scan.
        const availability = await Promise.all(families.map(async (family) => ({
            family,
            product: await ctx.db
                .query("products")
                .withIndex("by_family", (q) => q.eq("family", family.family))
                .first(),
        })));
        return availability
            .filter(({ family, product }) => family.family.toLowerCase() !== "unknown" && Boolean(product))
            .map(({ family }) => family);
    },
});

/**
 * The rows for one family, each with its server-resolved compatible
 * components. `diagnostics` turns the customer view into the QA view over the
 * SAME rows — never a second query with a second opinion.
 */
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

        // Components recur across a family. Fetch checkout metadata once per
        // component SKU rather than once per bottle/component occurrence.
        const componentSkus = new Set<string>();
        for (const bottle of bottles) {
            for (const components of Object.values(normalizeComponentsByType(bottle.components))) {
                for (const component of components) {
                    if (component.graceSku) componentSkus.add(component.graceSku);
                }
            }
        }
        const componentProducts = new Map(await Promise.all(
            [...componentSkus].map(async (graceSku) => [
                graceSku,
                await ctx.db
                    .query("products")
                    .withIndex("by_graceSku", (q) => q.eq("graceSku", graceSku))
                    .first(),
            ] as const),
        ));
        const productGroupIds = new Set([
            ...bottles.map((bottle) => bottle.productGroupId),
            ...[...componentProducts.values()].map((product) => product?.productGroupId),
        ].filter((groupId): groupId is NonNullable<typeof groupId> => Boolean(groupId)));
        const productGroups = new Map(await Promise.all(
            [...productGroupIds].map(async (groupId) => [
                String(groupId),
                await ctx.db.get(groupId),
            ] as const),
        ));
        const productGroupSlug = (product: { productGroupId?: unknown | null }) => {
            const groupId = product.productGroupId;
            return groupId ? productGroups.get(String(groupId))?.slug ?? null : null;
        };

        const rows = await Promise.all(bottles.map(async (b) => {
            const thread = (b.neckThreadSize ?? "").toString().trim();
            const grouped = normalizeComponentsByType(b.components);
            const rule = selectBestFitmentRule(rulesByThread.get(thread) ?? [], b);
            const resolved = filterGroupedComponentsByFitmentRule(grouped, rule);

            const listed = Object.values(grouped).reduce((n, xs) => n + xs.length, 0);
            const resolution: Resolution =
                listed === 0 ? "unknown" : rule ? "fitment_rule" : "bottle_listed";

            // The compatibility source carries component identity and price,
            // while the component product record is the source of checkout
            // eligibility. Enrich the already-resolved list without changing
            // its fitment decision.
            const resolvedForCart = Object.fromEntries(await Promise.all(
                Object.entries(resolved).map(async ([type, components]) => [
                    type,
                    components.map((component) => {
                        const product = componentProducts.get(component.graceSku) ?? null;
                        return {
                            ...component,
                            websiteSku: product?.websiteSku ?? null,
                            productGroupSlug: product ? productGroupSlug(product) : null,
                            shopifyVariantId: product?.shopifyVariantId ?? null,
                            shopifySellable: product?.shopifySellable ?? null,
                        };
                    }),
                ] as const),
            ));

            return {
                graceSku: b.graceSku,
                websiteSku: b.websiteSku,
                productGroupSlug: productGroupSlug(b),
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
                shopifyVariantId: b.shopifyVariantId ?? null,
                shopifySellable: b.shopifySellable ?? null,
                components: resolvedForCart,
                resolution,
                // Bottle Only is an EXPLICIT choice, never inferred from an
                // empty list. A row whose components are unknown offers it as
                // the only honest option; a row that resolved cleanly offers
                // it alongside the closures that actually fit.
                bottleOnly: true,
                ...(args.diagnostics ? {
                    diagnostics: {
                        listedComponentCount: listed,
                        resolvedComponentCount: Object.values(resolved)
                            .reduce((n, xs) => n + xs.length, 0),
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
        }));

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
