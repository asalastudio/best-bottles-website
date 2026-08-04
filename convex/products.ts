import { query, mutation, internalMutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { isLegacyProductRouteAlias } from "../src/lib/products/legacy-product-route-overrides";
import type { Doc, Id } from "./_generated/dataModel";
import {
    filterGroupedComponentsByFitmentRule,
    normalizeComponentsByType,
    selectBestFitmentRule,
} from "./componentUtils";
import { buildFamilyPageData } from "../src/lib/products/family-page-data";

function isSanityCdnUrl(value: string) {
    try {
        return new URL(value).hostname === "cdn.sanity.io";
    } catch {
        return value.includes("cdn.sanity.io/");
    }
}

function isShopifyCdnUrl(value: string | null | undefined) {
    if (!value) return false;
    try {
        return new URL(value).hostname === "cdn.shopify.com";
    } catch {
        return value.includes("cdn.shopify.com/");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT QUERIES — Powers the Homepage + Catalog + PDP
// ─────────────────────────────────────────────────────────────────────────────

// Retrieve all products (limited to 100 for basic demonstration/catalog landing)
export const listAll = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("products").take(100);
    },
});

// ── Price Audit Query ────────────────────────────────────────────────────────
// Paginated pricing export for convex_price_audit.py.
// Script pages through all products in batches (default 500 per page).
export const getAllForAudit = query({
    args: {
        limit: v.optional(v.number()),
        skip: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 500;
        const skip = args.skip ?? 0;
        const all = await ctx.db.query("products").collect();
        const page = all.slice(skip, skip + limit);
        return {
            total: all.length,
            page: page.map((p) => ({
                graceSku: p.graceSku,
                websiteSku: p.websiteSku,
                family: p.family,
                category: p.category,
                itemName: p.itemName,
                productUrl: p.productUrl ?? null,
                webPrice1pc: p.webPrice1pc ?? null,
                webPrice10pc: p.webPrice10pc ?? null,
                webPrice12pc: p.webPrice12pc ?? null,
                stockStatus: p.stockStatus ?? null,
            })),
        };
    },
});
// Get a specific product by its exact Grace Sku
export const getBySku = query({
    args: { graceSku: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("products")
            .withIndex("by_graceSku", (q) => q.eq("graceSku", args.graceSku))
            .first();
    },
});

// Find products by their family (e.g. "Boston Round")
export const getByFamily = query({
    args: { family: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("products")
            .withIndex("by_family", (q) => q.eq("family", args.family))
            .take(100); // Using take to prevent massive waterfall queries
    },
});

// Find products by their exact category (e.g. "Bottle" or "Component")
export const getByCategory = query({
    args: { category: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("products")
            .withIndex("by_category", (q) => q.eq("category", args.category))
            .take(100);
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// HOMEPAGE QUERIES — Live stats for Design Families + Trust Bar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns aggregate stats for the homepage:
 * - Total product count
 * - Per-collection (bottleCollection) counts
 * - Per-family counts
 * - Per-category counts
 * - In-stock count
 */
export const getHomepageStats = query({
    args: {},
    handler: async (ctx) => {
        // Use productGroups (~146 small docs) instead of products (~2285 large docs
        // with huge components arrays) to avoid the 16MB per-execution read limit.
        const groups = await ctx.db.query("productGroups").collect();

        // Total individual SKU variants = sum of each group's variantCount
        let totalProducts = 0;
        const collectionCounts: Record<string, number> = {};
        const familyCounts: Record<string, number> = {};
        const categoryCounts: Record<string, number> = {};

        for (const g of groups) {
            const n = g.variantCount ?? 1;
            totalProducts += n;

            if (g.bottleCollection) {
                collectionCounts[g.bottleCollection] = (collectionCounts[g.bottleCollection] || 0) + n;
            }
            if (g.family) {
                familyCounts[g.family] = (familyCounts[g.family] || 0) + n;
            }
            categoryCounts[g.category] = (categoryCounts[g.category] || 0) + n;
        }

        return {
            totalProducts,
            inStockCount: totalProducts, // all seeded products are in stock; update when live stock sync lands
            collectionCounts,
            familyCounts,
            categoryCounts,
        };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// FITMENT MATCHMAKING ALGORITHM — Powers the 'Engineered Compatibility' UI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a bottle SKU, this algorithm instantly finds all mathematically compatible
 * closures, sprayers, and droppers.
 *
 * Returns components as a type-grouped map for FitmentDrawer / FitmentCarousel:
 *   { "Sprayer": [...], "Dropper": [...], "Roll-On Cap": [...], "Lotion Pump": [...], "Cap": [...] }
 */
export const getCompatibleFitments = query({
    args: { bottleSku: v.string() },
    handler: async (ctx, args) => {
        // 1. Get the target bottle
        const bottle = await ctx.db
            .query("products")
            .withIndex("by_graceSku", (q) => q.eq("graceSku", args.bottleSku))
            .first() || await ctx.db
                .query("products")
                .withIndex("by_websiteSku", (q) => q.eq("websiteSku", args.bottleSku))
                .first();

        if (!bottle) return { bottle: null, components: null };

        const bottleThread = (bottle.neckThreadSize ?? "").toString().trim();
        const grouped = normalizeComponentsByType(bottle.components);
        const fitmentRules = bottleThread
            ? await ctx.db
                .query("fitments")
                .withIndex("by_threadSize", (q) => q.eq("threadSize", bottleThread))
                .collect()
            : [];
        const matchedFitmentRule = selectBestFitmentRule(fitmentRules, bottle);
        const reconciled = filterGroupedComponentsByFitmentRule(grouped, matchedFitmentRule);
        const isPlasticBottlePdp = (bottle.category ?? "") === "Plastic Bottle";

        // 2. Filter components by thread — 18-400 caps don't fit 17-415 bottles, etc.
        // Extract thread from SKU (e.g. CMP-CAP-BLK-18-400 → "18-400") and exclude mismatches
        const threadFromSku = (sku: string): string | null => {
            const m = sku.match(/(\d{2}-\d{3})/);
            return m ? m[1] : null;
        };
        const isPlasticBottleComponent = (itemName: string): boolean =>
            /plastic bottle with/i.test(itemName);
        const filteredEntries = Object.entries(reconciled).map(([type, items]) => {
            const matching = items.filter((item) => {
                // Guard: suppress cross-category plastic bottle products from glass-bottle fitment UI
                // (e.g. "Plastic Bottle with Silver Spray Top ...") unless we're on a plastic bottle PDP.
                if (!isPlasticBottlePdp && isPlasticBottleComponent(item.itemName)) return false;
                const compThread = threadFromSku(item.graceSku);
                return !compThread || compThread === bottleThread;
            });
            return [type, matching] as const;
        });

        const componentEntries = await Promise.all(
            filteredEntries.map(async ([type, items]) => [
                type,
                await Promise.all(
                    items.map(async (item) => {
                        const product = await ctx.db
                            .query("products")
                            .withIndex("by_graceSku", (q) => q.eq("graceSku", item.graceSku))
                            .first();
                        return {
                            graceSku: item.graceSku,
                            websiteSku: product?.websiteSku ?? null,
                            itemName: item.itemName,
                            shopifyVariantId: product?.shopifyVariantId ?? null,
                            checkoutEligible: Boolean(product?.shopifyVariantId),
                            imageUrl: item.imageUrl,
                            price1: item.webPrice1pc,
                            price12: item.webPrice12pc,
                            stockStatus: product?.stockStatus ?? item.stockStatus,
                        };
                    }),
                ),
            ] as const),
        );

        return {
            bottle,
            components: Object.fromEntries(componentEntries),
        };
    },
});


/**
 * Featured products for the homepage — pulls 1 representative product
 * from each of the primary design families (Glass Bottles only).
 */
export const getFeaturedByFamily = query({
    args: {},
    handler: async (ctx) => {
        const targetFamilies = [
            "Cylinder", "Elegant", "Circle", "Diva",
            "Empire", "Slim", "Boston Round", "Sleek",
            "Diamond", "Royal", "Round", "Square",
        ];

        const featured: Record<string, unknown> = {};
        for (const family of targetFamilies) {
            const product = await ctx.db
                .query("products")
                .withIndex("by_family", (q) => q.eq("family", family))
                .first();
            if (product) {
                featured[family] = product;
            }
        }

        return featured;
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG QUERIES — Powers the Master Catalog page
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get products grouped by bottleCollection — returns up to `limit` per
 * collection, sorted for the catalog page.
 */
export const getByCollection = query({
    args: { collection: v.string(), limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        // Use productGroups index to avoid reading all products
        return await ctx.db
            .query("productGroups")
            .withIndex("by_collection", (q) => q.eq("bottleCollection", args.collection))
            .take(args.limit ?? 50);
    },
});

/**
 * Returns the full catalog taxonomy for the sidebar:
 * Collections grouped by category, with counts.
 */
export const getCatalogTaxonomy = query({
    args: {},
    handler: async (ctx) => {
        // Use productGroups instead of products to stay under the 16MB read limit.
        // variantCount is used so sidebar totals reflect individual SKU counts.
        const groups = await ctx.db.query("productGroups").collect();

        const taxonomy: Record<string, Record<string, number>> = {};
        for (const g of groups) {
            const cat = g.category;
            const col = g.bottleCollection || "Uncategorized";
            const n = g.variantCount ?? 1;
            if (!taxonomy[cat]) taxonomy[cat] = {};
            taxonomy[cat][col] = (taxonomy[cat][col] || 0) + n;
        }

        return taxonomy;
    },
});

/**
 * Paginated product listing for catalog infinite scroll.
 * Returns products for a given collection, with cursor-based pagination.
 */
export const getCatalogProducts = query({
    args: {
        collection: v.optional(v.string()),
        category: v.optional(v.string()),
        family: v.optional(v.string()),
        searchTerm: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 50;

        // If search term, use search index
        if (args.searchTerm) {
            const q = ctx.db.query("products").withSearchIndex("search_itemName", (q) =>
                q.search("itemName", args.searchTerm!)
            );
            return await q.take(limit);
        }

        // Filter-based queries
        if (args.family) {
            return await ctx.db
                .query("products")
                .withIndex("by_family", (q) => q.eq("family", args.family!))
                .take(limit);
        }

        if (args.category) {
            return await ctx.db
                .query("products")
                .withIndex("by_category", (q) => q.eq("category", args.category!))
                .take(limit);
        }

        // Collection-based — use the by_collection index on productGroups,
        // then look up products for those groups (avoids full products table scan).
        if (args.collection) {
            return await ctx.db
                .query("products")
                .withIndex("by_category")
                .filter((q) => q.eq(q.field("bottleCollection"), args.collection))
                .take(limit);
        }

        // Default: return first batch
        return await ctx.db.query("products").take(limit);
    },
});

const toCatalogProductIndexRow = (product: Doc<"products">) => ({
    _id: product._id,
    _creationTime: product._creationTime,
    websiteSku: product.websiteSku,
    graceSku: product.graceSku,
    productId: product.productId,
    category: product.category,
    family: product.family,
    color: product.color,
    capacity: product.capacity,
    capacityMl: product.capacityMl,
    capacityOz: product.capacityOz,
    heightWithCap: product.heightWithCap,
    heightWithoutCap: product.heightWithoutCap,
    diameter: product.diameter,
    neckThreadSize: product.neckThreadSize,
    applicator: product.applicator,
    capStyle: product.capStyle,
    capColor: product.capColor,
    trimColor: product.trimColor,
    bottleCollection: product.bottleCollection,
    itemName: product.itemName,
    itemDescription: product.itemDescription,
    useCaseDescription: product.useCaseDescription,
    imageUrl: product.imageUrl,
    imageUrlCapOff: product.imageUrlCapOff,
    stockStatus: product.stockStatus,
    verified: product.verified,
    productGroupId: product.productGroupId,
});

/**
 * Lightweight, paginated product index for Madison Studio SKU matching.
 *
 * Do not use `getCatalogProducts` for all-product reads from Madison: full
 * product rows can include large component payloads and exceed Convex's
 * per-execution read byte limit. This query pages through the table and
 * returns only the fields Madison needs for crosswalk/finish validation.
 */
export const getCatalogProductIndexPage = query({
    args: {
        cursor: v.union(v.string(), v.null()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const result = await ctx.db.query("products").paginate({
            cursor: args.cursor,
            numItems: Math.min(Math.max(args.limit ?? 150, 1), 200),
        });

        return {
            ...result,
            page: result.page.map(toCatalogProductIndexRow),
        };
    },
});

/**
 * Full-text search for the catalog search bar.
 */
export const searchProducts = query({
    args: {
        searchTerm: v.string(),
        category: v.optional(v.string()),
        family: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 30;
        const q = ctx.db.query("products").withSearchIndex("search_itemName", (q) => {
            let search = q.search("itemName", args.searchTerm);
            if (args.category) search = search.eq("category", args.category);
            if (args.family) search = search.eq("family", args.family);
            return search;
        });
        return await q.take(limit);
    },
});

export const checkCount = query({
    args: {},
    handler: async (ctx) => {
        // Sum variantCounts from productGroups (safe, no component blowup)
        const groups = await ctx.db.query("productGroups").collect();
        return groups.reduce((sum, g) => sum + (g.variantCount ?? 1), 0);
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT GROUP QUERIES — Phase 1: Powers grouped catalog + PDP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns every productGroup (~230 lightweight docs, <1KB each).
 * The catalog page filters, sorts, and paginates client-side.
 */
export const getAllCatalogGroups = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("productGroups").collect();
    },
});

const SEARCH_STOP_WORDS = new Set(["a", "an", "and", "for", "of", "the", "with"]);
const APPLICATOR_BUCKETS = [
    { value: "rollon", productValues: ["Metal Roller Ball", "Plastic Roller Ball", "Metal Roller", "Plastic Roller"] },
    { value: "finemist", productValues: ["Fine Mist Sprayer", "Atomizer"] },
    { value: "perfumespray", productValues: ["Perfume Spray Pump"] },
    { value: "reducer", productValues: ["Reducer"] },
    { value: "dropper", productValues: ["Dropper"] },
    { value: "lotionpump", productValues: ["Lotion Pump"] },
    { value: "antiquespray", productValues: ["Vintage Bulb Sprayer", "Antique Bulb Sprayer"] },
    { value: "antiquespray-tassel", productValues: ["Vintage Bulb Sprayer with Tassel", "Antique Bulb Sprayer with Tassel"] },
] as const;
const COMPONENT_CATEGORIES = new Set([
    "Component", "Cap/Closure", "Roll-On Cap", "Accessory",
    "Packaging", "Packaging Supply", "Tool", "Gift Box", "Gift Bag",
]);
const BOTTLE_CATEGORIES = new Set(["Glass Bottle", "Cream Jar", "Lotion Bottle"]);
const FAMILY_ORDER = [
    "Cylinder", "Elegant", "Circle", "Sleek", "Diva", "Empire", "Boston Round",
    "Slim", "Diamond", "Royal", "Round", "Square", "Rectangle", "Flair",
    "Tulip", "Queen", "Bell", "Swirl", "Grace",
];

function normalizeCatalogSearchText(value: string | null | undefined): string {
    if (!value) return "";
    return value
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[–—]/g, "-")
        .replace(/(\d{1,4})\s*ml\b/g, "$1ml $1 ml")
        .replace(/\b(\d{1,3})\s*[-/]\s*(\d{3,4})\b/g, "$1-$2 $1/$2")
        .replace(/\broll[\s-]?on\b/g, "rollon roll-on roller rollerball roller ball")
        .replace(/\bfine[\s-]?mist\b/g, "finemist fine mist spray sprayer")
        .replace(/\bperfume\s*spray\b/g, "perfumespray perfume spray sprayer")
        .replace(/\bbulb\b/g, "bulb vintage antique")
        .replace(/\bsprayers?\b/g, "sprayer spray")
        .replace(/\bauto?mizers?\b/g, "atomizer automizer automizers")
        .replace(/\batomizers?\b/g, "atomizer automizer automizers")
        .replace(/\bdroppers?\b/g, "dropper pipette")
        .replace(/\breducers?\b/g, "reducer orifice plug")
        .replace(/\blotion\s*pumps?\b/g, "lotionpump lotion pump")
        .replace(/\bvials?\b/g, "vial vials sample")
        .replace(/\bbottles?\b/g, "bottle bottles")
        .replace(/\bcaps?\b/g, "cap closure lid")
        .replace(/\bclosures?\b/g, "closure cap lid")
        .replace(/\bamber\b/g, "amber brown")
        .replace(/\bbrown\b/g, "brown amber")
        .replace(/\bcobalt\b/g, "cobalt blue")
        .replace(/\bfrost(ed)?\b/g, "frosted frost")
        .replace(/[^\w\s/-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b(\d{1,4})\s+ml\b/g, "$1ml $1 ml");
}

function catalogSearchTokens(queryText: string): string[] {
    const normalized = normalizeCatalogSearchText(queryText);
    if (!normalized) return [];
    return Array.from(new Set(normalized.split(/\s+/).filter((token) => token && !SEARCH_STOP_WORDS.has(token))));
}

function catalogSearchMatches(queryText: string, fields: Array<string | number | null | undefined>): boolean {
    const tokens = catalogSearchTokens(queryText);
    if (tokens.length === 0) return true;
    const haystack = normalizeCatalogSearchText(fields.filter((value) => value != null).join(" "));
    return tokens.every((token) => haystack.includes(token));
}

function catalogSearchScore(queryText: string, weightedFields: Array<{ value: string | number | null | undefined; weight: number }>): number {
    const tokens = catalogSearchTokens(queryText);
    if (tokens.length === 0) return 0;
    return weightedFields.reduce((score, field) => {
        const text = normalizeCatalogSearchText(field.value == null ? null : String(field.value));
        if (!text) return score;
        const matchedTokens = tokens.filter((token) => text.includes(token)).length;
        const exactPhraseBoost = text.includes(normalizeCatalogSearchText(queryText)) ? field.weight : 0;
        return score + matchedTokens * field.weight + exactPhraseBoost;
    }, 0);
}

function classifyCatalogComponentType(displayName: string, family: string | null): string | null {
    const name = displayName.toLowerCase();
    const fam = (family ?? "").toLowerCase();
    if (name.includes("sprayer") || name.includes("atomizer") || name.includes("bulb") || fam.includes("sprayer")) return "Sprayer";
    if (name.includes("dropper") || fam.includes("dropper")) return "Dropper";
    if ((name.includes("lotion") && name.includes("pump")) || fam.includes("lotion pump")) return "Lotion Pump";
    if (name.includes("roll-on") || name.includes("roll on") || fam.includes("roll-on")) return "Roll-On";
    if (name.includes("roller") || fam.includes("roller")) return "Roller";
    if (name.includes("reducer") || fam.includes("reducer")) return "Reducer";
    if (name.includes("cap") || name.includes("closure") || fam.includes("cap")) return "Cap";
    return null;
}

function countByCatalogGroup<T extends { [key: string]: unknown }>(items: T[], keyFn: (item: T) => string | null | undefined): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const item of items) {
        const key = keyFn(item);
        if (key) counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
}

function parseCapacityMl(label: string): number | null {
    const match = label.match(/^(\d+(?:\.\d+)?)\s*ml/i);
    return match ? Number(match[1]) : null;
}

/**
 * Server/client catalog search endpoint used by the Next catalog page.
 * Keeps the browser from loading all catalog groups and recomputing facets.
 */
export const searchCatalog = query({
    args: {
        filters: v.object({
            search: v.optional(v.string()),
            category: v.optional(v.union(v.string(), v.null())),
            collection: v.optional(v.union(v.string(), v.null())),
            applicators: v.optional(v.array(v.string())),
            families: v.optional(v.array(v.string())),
            colors: v.optional(v.array(v.string())),
            capacities: v.optional(v.array(v.string())),
            neckThreadSizes: v.optional(v.array(v.string())),
            componentType: v.optional(v.union(v.string(), v.null())),
            priceMin: v.optional(v.union(v.number(), v.null())),
            priceMax: v.optional(v.union(v.number(), v.null())),
        }),
        sort: v.string(),
        view: v.string(),
        limit: v.number(),
        cursor: v.optional(v.union(v.string(), v.null())),
    },
    handler: async (ctx, args) => {
        const filters = {
            search: args.filters.search ?? "",
            category: args.filters.category ?? null,
            collection: args.filters.collection ?? null,
            applicators: args.filters.applicators ?? [],
            families: args.filters.families ?? [],
            colors: args.filters.colors ?? [],
            capacities: args.filters.capacities ?? [],
            neckThreadSizes: args.filters.neckThreadSizes ?? [],
            componentType: args.filters.componentType ?? null,
            priceMin: args.filters.priceMin ?? null,
            priceMax: args.filters.priceMax ?? null,
        };
        const allGroups = (await ctx.db.query("productGroups").collect())
            .filter((group) => !isLegacyProductRouteAlias(group.slug));
        const skuPairs = allGroups.map((group) => ({
            groupId: String(group._id),
            websiteSku: group.primaryWebsiteSku ?? null,
            graceSku: group.primaryGraceSku ?? null,
        }));
        const skuMap = new Map(skuPairs.map((row) => [row.groupId, row.websiteSku ?? row.graceSku ?? ""]));

        const matchesApplicatorBucket = (group: typeof allGroups[number], bucket: string) => {
            const bucketDef = APPLICATOR_BUCKETS.find((candidate) => candidate.value === bucket);
            if (!bucketDef) return false;
            return (group.applicatorTypes ?? []).some((value) =>
                (bucketDef.productValues as readonly string[]).includes(value)
            );
        };

        const runFilters = (skipKeys = new Set<string>()) => {
            let rows = [...allGroups];
            if (filters.search) {
                rows = rows.filter((group) => catalogSearchMatches(filters.search, [
                    group.displayName,
                    group.family,
                    group.color,
                    group.capacity,
                    group.capacityMl == null ? null : `${group.capacityMl} ml`,
                    group.category,
                    group.neckThreadSize,
                    group.bottleCollection,
                    group.slug,
                    (group.applicatorTypes ?? []).join(" "),
                    skuMap.get(String(group._id)),
                ]));
            }
            if (filters.category) rows = rows.filter((group) => group.category === filters.category);
            if (filters.collection) rows = rows.filter((group) => group.bottleCollection === filters.collection);
            if (!skipKeys.has("applicators") && filters.applicators.length > 0) {
                rows = rows.filter((group) => filters.applicators.some((bucket) => matchesApplicatorBucket(group, bucket)));
            }
            if (!skipKeys.has("families") && filters.families.length > 0) {
                const familySet = new Set(filters.families);
                rows = rows.filter((group) => group.family != null && familySet.has(group.family));
            }
            if (!skipKeys.has("colors") && filters.colors.length > 0) {
                const colorSet = new Set(filters.colors);
                rows = rows.filter((group) => group.color != null && colorSet.has(group.color));
            }
            if (!skipKeys.has("capacities") && filters.capacities.length > 0) {
                const selectedMls = new Set(filters.capacities.map(parseCapacityMl).filter((value): value is number => value != null));
                rows = rows.filter((group) => group.capacityMl != null && selectedMls.has(group.capacityMl));
            }
            if (!skipKeys.has("neckThreadSizes") && filters.neckThreadSizes.length > 0) {
                const threadSet = new Set(filters.neckThreadSizes);
                rows = rows.filter((group) => group.neckThreadSize != null && threadSet.has(group.neckThreadSize));
            }
            if (filters.componentType) rows = rows.filter((group) => classifyCatalogComponentType(group.displayName, group.family) === filters.componentType);
            if (filters.priceMin !== null) rows = rows.filter((group) => group.priceRangeMin !== null && group.priceRangeMin >= filters.priceMin!);
            if (filters.priceMax !== null) rows = rows.filter((group) => group.priceRangeMin !== null && group.priceRangeMin <= filters.priceMax!);
            return rows;
        };

        const result = runFilters();
        const applicatorFacetBase = runFilters(new Set(["applicators"]));
        const familyFacetBase = runFilters(new Set(["families"]));
        const colorFacetBase = runFilters(new Set(["colors"]));
        const capacityFacetBase = runFilters(new Set(["capacities"]));
        const threadFacetBase = runFilters(new Set(["neckThreadSizes"]));

        const applicatorCounts: Record<string, number> = {};
        for (const bucket of APPLICATOR_BUCKETS) {
            const count = applicatorFacetBase.filter((group) => matchesApplicatorBucket(group, bucket.value)).length;
            if (count > 0 || filters.applicators.includes(bucket.value)) applicatorCounts[bucket.value] = count;
        }

        const capacities: Record<string, { label: string; ml: number | null; count: number }> = {};
        for (const group of capacityFacetBase) {
            const ml = group.capacityMl;
            if (ml != null && ml > 0) {
                const label = `${ml} ml`;
                capacities[label] ??= { label, ml, count: 0 };
                capacities[label].count++;
            }
        }

        const priceValues = result.map((group) => group.priceRangeMin).filter((value): value is number => value != null);
        const facets = {
            categories: countByCatalogGroup(result, (group) => group.category),
            collections: countByCatalogGroup(result, (group) => group.bottleCollection),
            applicators: applicatorCounts,
            families: countByCatalogGroup(familyFacetBase.filter((group) => !COMPONENT_CATEGORIES.has(group.category)), (group) => group.family),
            colors: countByCatalogGroup(colorFacetBase, (group) => group.color),
            capacities,
            neckThreadSizes: countByCatalogGroup(threadFacetBase, (group) => group.neckThreadSize),
            componentTypes: countByCatalogGroup(result, (group) => classifyCatalogComponentType(group.displayName, group.family)),
            priceRange: priceValues.length > 0 ? { min: Math.min(...priceValues), max: Math.max(...priceValues) } : { min: 0, max: 0 },
        };

        const sorted = [...result];
        const sort = args.sort;
        if (sort === "best-match" && filters.search) {
            sorted.sort((a, b) => {
                const score = (group: typeof sorted[number]) => catalogSearchScore(filters.search, [
                    { value: group.displayName, weight: 5 },
                    { value: skuMap.get(String(group._id)), weight: 5 },
                    { value: (group.applicatorTypes ?? []).join(" "), weight: 4 },
                    { value: group.family, weight: 3 },
                    { value: group.capacity, weight: 3 },
                    { value: group.capacityMl == null ? null : `${group.capacityMl} ml`, weight: 3 },
                    { value: group.color, weight: 2 },
                    { value: group.neckThreadSize, weight: 2 },
                    { value: group.category, weight: 1 },
                    { value: group.bottleCollection, weight: 1 },
                    { value: group.slug, weight: 1 },
                ]);
                return score(b) - score(a) || (a.capacityMl ?? Infinity) - (b.capacityMl ?? Infinity) || a.displayName.localeCompare(b.displayName);
            });
        } else if (sort === "price-asc") {
            sorted.sort((a, b) => (a.priceRangeMin ?? Infinity) - (b.priceRangeMin ?? Infinity));
        } else if (sort === "price-desc") {
            sorted.sort((a, b) => (b.priceRangeMin ?? -Infinity) - (a.priceRangeMin ?? -Infinity));
        } else if (sort === "name-asc") {
            sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
        } else if (sort === "name-desc") {
            sorted.sort((a, b) => b.displayName.localeCompare(a.displayName));
        } else if (sort === "variants-desc") {
            sorted.sort((a, b) => (b.variantCount ?? 0) - (a.variantCount ?? 0));
        } else if (sort === "capacity-asc") {
            sorted.sort((a, b) => (a.capacityMl ?? Infinity) - (b.capacityMl ?? Infinity));
        } else if (sort === "capacity-desc") {
            sorted.sort((a, b) => (b.capacityMl ?? -Infinity) - (a.capacityMl ?? -Infinity));
        } else {
            const familyIdx = (family: string | null) => {
                if (!family) return FAMILY_ORDER.length;
                const index = FAMILY_ORDER.indexOf(family);
                return index >= 0 ? index : FAMILY_ORDER.length;
            };
            sorted.sort((a, b) => {
                const categoryA = BOTTLE_CATEGORIES.has(a.category) ? 0 : 1;
                const categoryB = BOTTLE_CATEGORIES.has(b.category) ? 0 : 1;
                if (categoryA !== categoryB) return categoryA - categoryB;
                const familyA = familyIdx(a.family);
                const familyB = familyIdx(b.family);
                if (familyA !== familyB) return familyA - familyB;
                return (a.capacityMl ?? 99999) - (b.capacityMl ?? 99999);
            });
        }

        const offset = Math.max(0, Number(args.cursor ?? 0) || 0);
        const limit = Math.min(Math.max(args.limit, 1), 240);
        const items = sorted.slice(offset, offset + limit);
        const nextOffset = offset + items.length;
        const nextCursor = nextOffset < sorted.length ? String(nextOffset) : null;
        const visibleIds = new Set(items.map((group) => String(group._id)));

        const variantPreviewRows = await Promise.all(items.map(async (group) => {
            const variants = await ctx.db
                .query("products")
                .withIndex("by_productGroupId", (q) => q.eq("productGroupId", group._id))
                .collect();
            return {
                groupId: String(group._id),
                variants: variants.map((variant) => ({
                    id: String(variant._id),
                    itemName: variant.itemName ?? null,
                    websiteSku: variant.websiteSku ?? null,
                    graceSku: variant.graceSku ?? null,
                    imageUrl: variant.imageUrl ?? null,
                    imageUrlCapOff: variant.imageUrlCapOff ?? null,
                    color: variant.color ?? null,
                    applicator: variant.applicator ?? null,
                    capColor: variant.capColor ?? null,
                    trimColor: variant.trimColor ?? null,
                    capStyle: variant.capStyle ?? null,
                    capHeight: variant.capHeight ?? null,
                    ballMaterial: variant.ballMaterial ?? null,
                })),
            };
        }));

        return {
            items,
            facets,
            totalCount: sorted.length,
            nextCursor,
            primarySkus: skuPairs.filter((row) => visibleIds.has(row.groupId)),
            variantPreviewRows,
        };
    },
});

/**
 * Top families ranked by total variant count, with one representative hero
 * image each. Used by the workspace's "Popular families" left-rail strip
 * (renders when an authenticated user has no recent projects yet).
 *
 * Without sales data, variant count is the proxy for "popular" — families
 * with the most SKUs are the ones the catalog has invested in.
 */
export const getPopularFamilies = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const groups = await ctx.db.query("productGroups").collect();
        const byFamily = new Map<string, {
            variantCount: number;
            heroImageUrl: string | null;
            firstSlug: string | null;
        }>();
        for (const g of groups) {
            if (!g.family) continue;
            const existing = byFamily.get(g.family);
            if (existing) {
                existing.variantCount += g.variantCount ?? 0;
                if (!existing.heroImageUrl && g.heroImageUrl) {
                    existing.heroImageUrl = g.heroImageUrl;
                }
                if (!existing.firstSlug && g.slug) existing.firstSlug = g.slug;
            } else {
                byFamily.set(g.family, {
                    variantCount: g.variantCount ?? 0,
                    heroImageUrl: g.heroImageUrl ?? null,
                    firstSlug: g.slug ?? null,
                });
            }
        }
        return [...byFamily.entries()]
            .map(([family, data]) => ({ family, ...data }))
            .sort((a, b) => b.variantCount - a.variantCount)
            .slice(0, args.limit ?? 6);
    },
});

/**
 * Returns one representative SKU per product group for line-item catalog view.
 *
 * PERFORMANCE FIX: The old version did 230 individual queries (N+1 problem).
 * Now we:
 * 1. Read all productGroups (1 query, ~230 lightweight docs).
 * 2. Check if primaryGraceSku is already stored on the group doc (zero extra queries).
 * 3. For groups missing it, batch-fetch via by_productGroupId using Promise.all
 *    with a concurrency cap of 20 to stay within Convex limits.
 */
export const getCatalogGroupPrimarySkus = query({
    args: {},
    handler: async (ctx) => {
        const groups = await ctx.db.query("productGroups").collect();

        // Groups that already have the SKU embedded (fast path — no extra queries)
        const results: { groupId: string; websiteSku: string | null; graceSku: string | null }[] = [];
        const missing: typeof groups = [];

        for (const g of groups) {
            if (g.primaryGraceSku !== undefined) {
                results.push({
                    groupId: String(g._id),
                    websiteSku: g.primaryWebsiteSku ?? null,
                    graceSku: g.primaryGraceSku ?? null,
                });
            } else {
                missing.push(g);
            }
        }

        // Batch lookup for groups that don't have embedded SKUs yet.
        // Cap concurrency at 20 to avoid overwhelming Convex.
        const BATCH = 20;
        for (let i = 0; i < missing.length; i += BATCH) {
            const chunk = missing.slice(i, i + BATCH);
            const variants = await Promise.all(
                chunk.map((g) =>
                    ctx.db
                        .query("products")
                        .withIndex("by_productGroupId", (q) => q.eq("productGroupId", g._id))
                        .first()
                )
            );
            chunk.forEach((g, j) => {
                results.push({
                    groupId: String(g._id),
                    websiteSku: variants[j]?.websiteSku ?? null,
                    graceSku: variants[j]?.graceSku ?? null,
                });
            });
        }

        return results;
    },
});

/**
 * Returns only the slim SKU fields needed for collection-card variant previews.
 * The catalog calls this for currently visible groups instead of loading full PDP
 * variant documents for every product group in the grid.
 */
export const getCatalogGroupVariantPreviewData = query({
    args: {
        groupIds: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        const groupIds = Array.from(new Set(args.groupIds)).slice(0, 240);
        const results: {
            groupId: string;
            variants: Array<{
                id: string;
                itemName: string | null;
                websiteSku: string | null;
                graceSku: string | null;
                imageUrl: string | null;
                imageUrlCapOff: string | null;
                color: string | null;
                applicator: string | null;
                capColor: string | null;
                trimColor: string | null;
                capStyle: string | null;
                capHeight: string | null;
                ballMaterial: string | null;
            }>;
        }[] = [];

        const BATCH_SIZE = 16;
        for (let i = 0; i < groupIds.length; i += BATCH_SIZE) {
            const chunk = groupIds.slice(i, i + BATCH_SIZE);
            const rows = await Promise.all(
                chunk.map(async (groupId) => {
                    const normalizedId = ctx.db.normalizeId("productGroups", groupId);
                    if (!normalizedId) return { groupId, variants: [] };

                    const variants = await ctx.db
                        .query("products")
                        .withIndex("by_productGroupId", (q) => q.eq("productGroupId", normalizedId))
                        .collect();

                    return {
                        groupId,
                        variants: variants.map((variant) => ({
                            id: String(variant._id),
                            itemName: variant.itemName ?? null,
                            websiteSku: variant.websiteSku ?? null,
                            graceSku: variant.graceSku ?? null,
                            imageUrl: variant.imageUrl ?? null,
                            imageUrlCapOff: variant.imageUrlCapOff ?? null,
                            color: variant.color ?? null,
                            applicator: variant.applicator ?? null,
                            capColor: variant.capColor ?? null,
                            trimColor: variant.trimColor ?? null,
                            capStyle: variant.capStyle ?? null,
                            capHeight: variant.capHeight ?? null,
                            ballMaterial: variant.ballMaterial ?? null,
                        })),
                    };
                }),
            );
            results.push(...rows);
        }

        return results;
    },
});

/**
 * Paginated product group listing for the catalog page.
 * Mirrors getCatalogProducts but returns productGroups instead of flat SKUs.
 */
export const getCatalogGroups = query({
    args: {
        collection: v.optional(v.string()),
        category: v.optional(v.string()),
        family: v.optional(v.string()),
        searchTerm: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 100;

        // Group-level full-text search
        if (args.searchTerm) {
            return await ctx.db
                .query("productGroups")
                .withSearchIndex("search_displayName", (q) =>
                    q.search("displayName", args.searchTerm!)
                )
                .take(limit);
        }

        if (args.family) {
            return await ctx.db
                .query("productGroups")
                .withIndex("by_family", (q) => q.eq("family", args.family!))
                .take(limit);
        }

        if (args.category) {
            return await ctx.db
                .query("productGroups")
                .withIndex("by_category", (q) => q.eq("category", args.category!))
                .take(limit);
        }

        if (args.collection) {
            return await ctx.db
                .query("productGroups")
                .withIndex("by_collection", (q) => q.eq("bottleCollection", args.collection!))
                .take(limit);
        }

        return await ctx.db.query("productGroups").take(limit);
    },
});

/**
 * Fetch a single product group by its slug, plus all variant products.
 * Used by the PDP route: /products/[slug]
 */
export const getProductGroup = query({
    args: { slug: v.string() },
    handler: async (ctx, args) => {
        const group = await ctx.db
            .query("productGroups")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .first();

        if (!group) return null;

        // Use the by_productGroupId index — avoids a full 2,285-product table scan
        const variants = await ctx.db
            .query("products")
            .withIndex("by_productGroupId", (q) => q.eq("productGroupId", group._id))
            .collect();

        return { group, variants };
    },
});

/**
 * Read-only Madison/image-pipeline preflight.
 *
 * Slugs are route labels, not durable product identity. This resolver lets
 * Madison validate a requested group hero target before attempting a publish:
 * prefer productGroupId, then exact slug, then SKU/productId, then a
 * case-insensitive slug alias. It returns the canonical Convex slug so the UI
 * can display "did you mean..." instead of failing after image upload.
 */
export const preflightProductGroupImageTarget = query({
    args: {
        productGroupId: v.optional(v.id("productGroups")),
        productGroupSlug: v.optional(v.string()),
        graceSku: v.optional(v.string()),
        websiteSku: v.optional(v.string()),
        productId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const requestedSlug = args.productGroupSlug?.trim();
        const text = (value: string | null | undefined) => (value ?? "").toLowerCase();
        const hasAmberSignal = (product: {
            websiteSku?: string | null;
            productUrl?: string | null;
            itemName?: string | null;
            itemDescription?: string | null;
        }) => {
            const sku = text(product.websiteSku);
            const url = text(product.productUrl);
            const name = text(`${product.itemName ?? ""} ${product.itemDescription ?? ""}`);
            return /\bamb\b|amb\d|amb[0-9a-z]*|amber/.test(sku) ||
                url.includes("amber-glass") ||
                /\bamber\s+glass\b/.test(name);
        };
        const hasClearBottleSignal = (product: {
            websiteSku?: string | null;
            productUrl?: string | null;
            itemName?: string | null;
            itemDescription?: string | null;
        }) => {
            const sku = text(product.websiteSku);
            const url = text(product.productUrl);
            const name = text(`${product.itemName ?? ""} ${product.itemDescription ?? ""}`);
            return /\bclr\b|clr\d|clr[0-9a-z]*|clear/.test(sku) ||
                url.includes("clear-glass") ||
                /\bclear\s+glass\b/.test(name);
        };
        const productContradictsGroup = (
            group: Doc<"productGroups">,
            product: {
                websiteSku?: string | null;
                productUrl?: string | null;
                itemName?: string | null;
                itemDescription?: string | null;
            },
        ) => {
            const groupColor = text(group.color);
            if (groupColor === "clear") return hasAmberSignal(product);
            if (groupColor === "amber") return hasClearBottleSignal(product);
            return false;
        };

        const toPayload = (
            group: Doc<"productGroups">,
            method: "productGroupId" | "exact_slug" | "sku_or_product_id" | "case_insensitive_slug",
            matchedProduct?: {
                _id: unknown;
                    productId?: string | null;
                    graceSku?: string | null;
                    websiteSku?: string | null;
                    productUrl?: string | null;
                    itemName?: string | null;
                    itemDescription?: string | null;
                } | null,
        ) => ({
            success: true as const,
            status: method === "case_insensitive_slug" ? "alias_resolved" as const : "exact_match" as const,
            method,
            requestedSlug: requestedSlug ?? null,
            canonical: {
                productGroupId: group._id,
                productGroupSlug: group.slug,
                displayName: group.displayName,
                family: group.family,
                capacityMl: group.capacityMl ?? null,
                color: group.color ?? null,
                primaryGraceSku: group.primaryGraceSku ?? null,
                primaryWebsiteSku: group.primaryWebsiteSku ?? null,
                heroImageUrl: group.heroImageUrl ?? null,
            },
            matchedProduct: matchedProduct
                ? {
                    productId: matchedProduct.productId ?? null,
                    graceSku: matchedProduct.graceSku ?? null,
                    websiteSku: matchedProduct.websiteSku ?? null,
                }
                : null,
            warnings: method === "case_insensitive_slug"
                ? [`Slug differs by case. Use canonical slug "${group.slug}".`]
                : [],
        });

        if (args.productGroupId) {
            const group = await ctx.db.get(args.productGroupId);
            if (group) return toPayload(group, "productGroupId");
        }

        const productLookups = [
            args.graceSku
                ? ctx.db.query("products").withIndex("by_graceSku", (q) => q.eq("graceSku", args.graceSku!)).first()
                : null,
            args.websiteSku
                ? ctx.db.query("products").withIndex("by_websiteSku", (q) => q.eq("websiteSku", args.websiteSku!)).first()
                : null,
            args.productId
                ? ctx.db.query("products").withIndex("by_productId", (q) => q.eq("productId", args.productId!)).first()
                : null,
        ].filter(Boolean) as Array<Promise<{
            _id: unknown;
            productGroupId?: Id<"productGroups"> | null;
            productId?: string | null;
            graceSku?: string | null;
            websiteSku?: string | null;
            productUrl?: string | null;
            itemName?: string | null;
            itemDescription?: string | null;
        } | null>>;

        let matchedProduct: Awaited<(typeof productLookups)[number]> | null = null;
        for (const lookup of productLookups) {
            matchedProduct = await lookup;
            if (matchedProduct) break;
        }

        if (requestedSlug) {
            const exact = await ctx.db
                .query("productGroups")
                .withIndex("by_slug", (q) => q.eq("slug", requestedSlug))
                .first();
            if (exact) {
                if (matchedProduct?.productGroupId && matchedProduct.productGroupId !== exact._id) {
                    return {
                        success: false as const,
                        status: "sku_group_mismatch" as const,
                        requestedSlug,
                        productGroupSlug: exact.slug,
                        websiteSku: matchedProduct.websiteSku ?? null,
                        graceSku: matchedProduct.graceSku ?? null,
                        message: "The requested SKU belongs to a different product group than the requested slug.",
                    };
                }
                if (matchedProduct && productContradictsGroup(exact, matchedProduct)) {
                    return {
                        success: false as const,
                        status: "sku_color_mismatch" as const,
                        requestedSlug,
                        productGroupSlug: exact.slug,
                        groupColor: exact.color ?? null,
                        websiteSku: matchedProduct.websiteSku ?? null,
                        graceSku: matchedProduct.graceSku ?? null,
                        message: "The requested SKU naming/product URL conflicts with the target product group's bottle color.",
                    };
                }
                return toPayload(exact, "exact_slug", matchedProduct);
            }
        }

        if (matchedProduct?.productGroupId) {
            const group = await ctx.db.get(matchedProduct.productGroupId);
            if (group) return toPayload(group, "sku_or_product_id", matchedProduct);
        }

        if (requestedSlug) {
            const normalized = requestedSlug.toLowerCase();
            const matches = (await ctx.db.query("productGroups").collect())
                .filter((group) => group.slug.toLowerCase() === normalized);
            if (matches.length === 1) return toPayload(matches[0], "case_insensitive_slug");
            if (matches.length > 1) {
                return {
                    success: false as const,
                    status: "ambiguous_alias" as const,
                    requestedSlug,
                    matches: matches.map((group) => ({
                        productGroupId: group._id,
                        productGroupSlug: group.slug,
                        displayName: group.displayName,
                    })),
                    warnings: ["More than one product group matches this slug after normalization. Manual review required."],
                };
            }
        }

        return {
            success: false as const,
            status: "not_found" as const,
            requestedSlug: requestedSlug ?? null,
            matches: [],
            warnings: ["No Convex product group matched the supplied ID, slug, SKU, or productId."],
        };
    },
});

/**
 * Fetch just the variant products for a known group ID.
 * Used by the PDP variant selector to load options.
 */
export const getVariantsForGroup = query({
    args: { groupId: v.id("productGroups") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("products")
            .withIndex("by_productGroupId", (q) => q.eq("productGroupId", args.groupId))
            .collect();
    },
});

/**
 * Returns groups by family — for family-level browsing pages.
 */
export const getGroupsByFamily = query({
    args: { family: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("productGroups")
            .withIndex("by_family", (q) => q.eq("family", args.family))
            .collect();
    },
});

/**
 * Dedicated family-page read model.
 *
 * Counts and applicator breadth are derived from product rows rather than
 * cached product-group summaries, which are known to omit the plastic roller
 * path for some 9 ml Cylinder groups.
 */
export const getFamilyPageData = query({
    args: { family: v.string() },
    handler: async (ctx, args) => {
        const groups = await ctx.db
            .query("productGroups")
            .withIndex("by_family", (q) => q.eq("family", args.family))
            .collect();
        const eligibleGroups = groups.filter((group) => group.variantCount > 0);
        const variantsByGroup = await Promise.all(
            eligibleGroups.map((group) =>
                ctx.db
                    .query("products")
                    .withIndex("by_productGroupId", (q) => q.eq("productGroupId", group._id))
                    .collect(),
            ),
        );

        return buildFamilyPageData(
            args.family,
            eligibleGroups.map((group) => ({
                id: group._id,
                slug: group.slug,
                family: group.family,
                capacity: group.capacity,
                capacityMl: group.capacityMl,
                neckThreadSize: group.neckThreadSize,
                color: group.color,
                variantCount: group.variantCount,
                priceRangeMin: group.priceRangeMin,
                paperDollFamilyKey: group.paperDollFamilyKey ?? null,
                applicatorTypes: group.applicatorTypes ?? [],
            })),
            variantsByGroup.flatMap((variants, index) =>
                variants.map((variant) => ({
                    groupId: eligibleGroups[index]._id,
                    applicator: variant.applicator,
                })),
            ),
        );
    },
});

/**
 * Exact product cohort used by the unified PDP. Capacity is never sufficient:
 * family, capacity, neck finish, and Sanity family key must all match.
 */
export const getProductCohort = query({
    args: {
        family: v.string(),
        capacityMl: v.number(),
        neckThreadSize: v.string(),
        paperDollFamilyKey: v.string(),
    },
    handler: async (ctx, args) => {
        const familyGroups = await ctx.db
            .query("productGroups")
            .withIndex("by_family", (q) => q.eq("family", args.family))
            .collect();
        const groups = familyGroups.filter((group) =>
            group.variantCount > 0
            && group.capacityMl === args.capacityMl
            && group.neckThreadSize === args.neckThreadSize
            && group.paperDollFamilyKey === args.paperDollFamilyKey,
        );
        const variants = (
            await Promise.all(
                groups.map((group) =>
                    ctx.db
                        .query("products")
                        .withIndex("by_productGroupId", (q) => q.eq("productGroupId", group._id))
                        .collect(),
                ),
            )
        ).flat();

        return {
            groups,
            variants,
            declaredVariantCount: groups.reduce((sum, group) => sum + group.variantCount, 0),
            actualVariantCount: variants.length,
        };
    },
});

/**
 * Alias used by image upload scripts — same as getGroupsByFamily.
 */
export const getProductGroupsByFamily = query({
    args: { family: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("productGroups")
            .withIndex("by_family", (q) => q.eq("family", args.family))
            .collect();
    },
});

/**
 * Batch-patch itemDescription for a list of products, looked up by websiteSku.
 * Called by scripts/push_descriptions.mjs in batches of 50.
 * Returns { updated, notFound } so the runner can report skipped SKUs.
 */
export const patchDescriptions = internalMutation({
    args: {
        patches: v.array(v.object({
            websiteSku: v.string(),
            itemDescription: v.string(),
        })),
    },
    handler: async (ctx, args) => {
        const notFound: string[] = [];
        let updated = 0;
        for (const patch of args.patches) {
            const product = await ctx.db
                .query("products")
                .withIndex("by_websiteSku", (q) => q.eq("websiteSku", patch.websiteSku))
                .first();
            if (!product) {
                notFound.push(patch.websiteSku);
                continue;
            }
            await ctx.db.patch(product._id, { itemDescription: patch.itemDescription });
            updated++;
        }
        return { updated, notFound };
    },
});

/**
 * Update heroImageUrl on a productGroup — called by the Sanity image upload script
 * after uploading a grid image and receiving the CDN URL.
 */
export const updateProductGroupHeroImage = internalMutation({
    args: {
        id: v.id("productGroups"),
        heroImageUrl: v.string(),
    },
    handler: async (ctx, args) => {
        if (isSanityCdnUrl(args.heroImageUrl)) {
            return { success: false, error: "sanity_product_image_rejected" as const };
        }

        await ctx.db.patch(args.id, { heroImageUrl: args.heroImageUrl });
        return { success: true };
    },
});

function verifyProductImageWriteToken(writeToken: string) {
    const expected = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!expected) {
        throw new Error("product_image_write_token_not_configured");
    }
    if (writeToken !== expected) {
        throw new Error("unauthorized_product_image_write");
    }
}

/**
 * Designates the customer-facing representative SKU for a product group.
 *
 * This controls:
 *   - the PDP's default selected variant,
 *   - the catalog/card representative SKU,
 *   - and the group hero thumbnail when that SKU has Shopify-backed media.
 *
 * It does not rename SKUs, slugs, products, Shopify records, or Madison files.
 * If the selected SKU does not yet have a Shopify CDN image, the group hero is
 * cleared instead of keeping a stale legacy/Sanity image.
 */
export const setProductGroupPrimarySku = mutation({
    args: {
        writeToken: v.string(),
        productGroupSlug: v.optional(v.string()),
        productGroupId: v.optional(v.id("productGroups")),
        websiteSku: v.optional(v.string()),
        graceSku: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        verifyProductImageWriteToken(args.writeToken);

        const websiteSku = args.websiteSku?.trim();
        const graceSku = args.graceSku?.trim();
        if (!websiteSku && !graceSku) {
            return { success: false, error: "missing_sku" as const };
        }

        const product = websiteSku
            ? await ctx.db
                .query("products")
                .withIndex("by_websiteSku", (q) => q.eq("websiteSku", websiteSku))
                .first()
            : await ctx.db
                .query("products")
                .withIndex("by_graceSku", (q) => q.eq("graceSku", graceSku!))
                .first();

        if (!product) {
            return {
                success: false,
                error: "product_not_found" as const,
                websiteSku: websiteSku ?? null,
                graceSku: graceSku ?? null,
            };
        }

        let group: Doc<"productGroups"> | null = null;
        if (args.productGroupId) {
            group = await ctx.db.get(args.productGroupId);
        } else if (args.productGroupSlug?.trim()) {
            group = await ctx.db
                .query("productGroups")
                .withIndex("by_slug", (q) => q.eq("slug", args.productGroupSlug!.trim()))
                .first();
        } else if (product.productGroupId) {
            group = await ctx.db.get(product.productGroupId);
        }

        if (!group) {
            return { success: false, error: "group_not_found" as const };
        }

        if (product.productGroupId && product.productGroupId !== group._id) {
            return {
                success: false,
                error: "sku_not_in_group" as const,
                productGroupSlug: group.slug,
                websiteSku: product.websiteSku ?? null,
                graceSku: product.graceSku ?? null,
            };
        }

        const heroImageUrl = isShopifyCdnUrl(product.imageUrl) ? product.imageUrl : null;
        await ctx.db.patch(group._id, {
            primaryGraceSku: product.graceSku ?? null,
            primaryWebsiteSku: product.websiteSku ?? null,
            heroImageUrl,
        });

        return {
            success: true,
            productGroupSlug: group.slug,
            primaryGraceSku: product.graceSku ?? null,
            primaryWebsiteSku: product.websiteSku ?? null,
            heroImageUrl,
            hasShopifyHeroImage: Boolean(heroImageUrl),
            warning: heroImageUrl ? null : "selected_primary_sku_has_no_shopify_image",
        };
    },
});

/**
 * Mutation called by Madison Studio's publish edge function after uploading a
 * per-SKU product image to Shopify. Patches products.imageUrl for the matching
 * websiteSku.
 *
 * Single-field convenience wrapper. For multi-view writes (cap-on + cap-off)
 * use `setVariantImages` below — it supports both fields in a single call
 * and propagates the primary view to the productGroup's heroImageUrl when
 * the SKU is the group's primaryWebsiteSku.
 */
export const setImageUrl = mutation({
    args: {
        websiteSku: v.string(),
        imageUrl: v.string(),
        writeToken: v.string(),
    },
    handler: async (ctx, args) => {
        verifyProductImageWriteToken(args.writeToken);

        if (isSanityCdnUrl(args.imageUrl)) {
            return {
                success: false,
                websiteSku: args.websiteSku,
                error: "sanity_product_image_rejected" as const,
            };
        }

        const product = await ctx.db
            .query("products")
            .withIndex("by_websiteSku", (q) => q.eq("websiteSku", args.websiteSku))
            .first() ?? await ctx.db
                .query("products")
                .withIndex("by_graceSku", (q) => q.eq("graceSku", args.websiteSku))
                .first();
        if (!product) {
            return { success: false, websiteSku: args.websiteSku, error: "not_found" as const };
        }
        await ctx.db.patch(product._id, { imageUrl: args.imageUrl });
        return {
            success: true,
            inputSku: args.websiteSku,
            websiteSku: product.websiteSku ?? args.websiteSku,
            graceSku: product.graceSku ?? null,
        };
    },
});

/**
 * Variant-aware image patcher — patches either or both views in one call.
 *
 * Used by:
 *   - Madison's push-bestbottles-grid-hero edge function (variant-mode call)
 *   - The bulk PSD push pipeline (`scripts/04-push-heroes.ts`), which iterates
 *     a `renders/heroes/{cap-on,cap-off}/{websiteSku}.png` folder pair.
 *
 * Behavior:
 *   - imageUrl       → patches products.imageUrl (the primary/cover view).
 *                      If this SKU is its productGroup's primaryWebsiteSku,
 *                      the group's heroImageUrl is ALSO patched so the
 *                      catalog grid card mirrors the new primary.
 *   - imageUrlCapOff → patches products.imageUrlCapOff (gallery secondary).
 *                      Never propagates to the group — catalog cards always
 *                      show the primary view, never the cap-off detail.
 *
 * At least one of the two image fields must be provided; passing neither
 * returns `{ success: false, error: "no_image_provided" }` without writes.
 *
 * Sparse patch semantics — a cap-off-only call does NOT clobber a previously
 * set imageUrl, and vice versa. Idempotent across re-runs. Safe to bulk-call
 * across thousands of SKUs from the push pipeline.
 */
export const setVariantImages = mutation({
    args: {
        websiteSku: v.string(),
        imageUrl: v.optional(v.string()),
        imageUrlCapOff: v.optional(v.string()),
        writeToken: v.string(),
    },
    handler: async (ctx, args) => {
        verifyProductImageWriteToken(args.writeToken);

        if (
            (args.imageUrl && isSanityCdnUrl(args.imageUrl)) ||
            (args.imageUrlCapOff && isSanityCdnUrl(args.imageUrlCapOff))
        ) {
            return {
                success: false,
                websiteSku: args.websiteSku,
                error: "sanity_product_image_rejected" as const,
            };
        }

        if (!args.imageUrl && !args.imageUrlCapOff) {
            return {
                success: false,
                websiteSku: args.websiteSku,
                error: "no_image_provided" as const,
            };
        }

        let products = await ctx.db
            .query("products")
            .withIndex("by_websiteSku", (q) => q.eq("websiteSku", args.websiteSku))
            .collect();
        if (products.length === 0) {
            products = await ctx.db
                .query("products")
                .withIndex("by_graceSku", (q) => q.eq("graceSku", args.websiteSku))
                .collect();
        }

        if (products.length === 0) {
            return {
                success: false,
                websiteSku: args.websiteSku,
                error: "not_found" as const,
            };
        }

        // Build a sparse patch — only fields the caller actually passed.
        // Convex patch semantics: omitted keys are left untouched.
        const variantPatch: { imageUrl?: string; imageUrlCapOff?: string } = {};
        if (args.imageUrl) variantPatch.imageUrl = args.imageUrl;
        if (args.imageUrlCapOff) variantPatch.imageUrlCapOff = args.imageUrlCapOff;
        await Promise.all(products.map((product) => ctx.db.patch(product._id, variantPatch)));

        // Propagate the primary view to the group's heroImageUrl when this
        // SKU is the group's designated primary. Skipped for cap-off-only
        // writes — the catalog grid card never renders the cap-off view.
        let groupAlsoUpdated = false;
        if (args.imageUrl) {
            const groupIds = new Set(
                products
                    .map((product) => product.productGroupId)
                    .filter((groupId): groupId is Id<"productGroups"> => Boolean(groupId)),
            );
            for (const groupId of groupIds) {
                const group = await ctx.db.get(groupId);
                const isPrimary = products.some((product) =>
                    group &&
                    (
                        (group.primaryWebsiteSku && product.websiteSku === group.primaryWebsiteSku) ||
                        (group.primaryGraceSku && product.graceSku === group.primaryGraceSku)
                    )
                );
                if (group && isPrimary) {
                    await ctx.db.patch(group._id, { heroImageUrl: args.imageUrl });
                    groupAlsoUpdated = true;
                }
            }
        }

        return {
            success: true,
            inputSku: args.websiteSku,
            websiteSku: products[0]?.websiteSku ?? args.websiteSku,
            graceSku: products[0]?.graceSku ?? null,
            patchedCount: products.length,
            patched: {
                imageUrl: !!args.imageUrl,
                imageUrlCapOff: !!args.imageUrlCapOff,
            },
            groupAlsoUpdated,
        };
    },
});

// Applicator bucket suffixes in slugs (e.g. cylinder-5ml-clear-13-415-spray ends with -spray)
const APPLICATOR_BUCKET_SUFFIXES = ["-spray", "-finemist", "-perfumespray", "-antiquespray", "-antiquespray-tassel", "-rollon", "-dropper", "-lotionpump", "-reducer", "-glasswand", "-glassapplicator", "-capclosure"] as const;

// Cylinder 5ml roll-on: only Clear and cobalt-blue glass (no Amber — 5ml Amber is Tulip-shaped only)
const CYLINDER_5ML_ROLLON_ALLOWED = new Set(["Clear", "Blue", "Cobalt", "Cobalt Blue"]);
const BLUE_ALIASES = new Set(["Blue", "Cobalt", "Cobalt Blue"]);

/**
 * Returns sibling product groups — same family + capacityMl + neckThreadSize + applicator bucket, different glass color.
 * Used by the PDP to show glass color swatches and navigate between color variants.
 * Filters by applicator bucket so spray/roll-on pages don't show each other's color options.
 * For Cylinder 5ml roll-on: only Clear and Blue (no Amber — 5ml Amber is Tulip-shaped only).
 * neckThreadSize is optional for backward compatibility; when provided only same-thread siblings are returned.
 */
export const getSiblingGroups = query({
    args: {
        family: v.string(),
        capacityMl: v.number(),
        excludeSlug: v.string(),
        neckThreadSize: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const all = await ctx.db
            .query("productGroups")
            .withIndex("by_family", (q) => q.eq("family", args.family))
            .collect();
        const bucketSuffix = APPLICATOR_BUCKET_SUFFIXES.find((s) => args.excludeSlug.endsWith(s));
        const hasKnownSuffix = (slug: string) => APPLICATOR_BUCKET_SUFFIXES.some((s) => slug.endsWith(s));
        let filtered = all.filter(
            (g) =>
                g.capacityMl === args.capacityMl &&
                g.slug !== args.excludeSlug &&
                (args.neckThreadSize == null || g.neckThreadSize === args.neckThreadSize) &&
                (
                    bucketSuffix
                        ? g.slug.endsWith(bucketSuffix)
                        : !hasKnownSuffix(g.slug)
                )
        );

        // Cylinder 5ml roll-on: only Clear and cobalt-blue glass; deduplicate by canonical color
        const isCylinder5mlRollon =
            args.family === "Cylinder" &&
            args.capacityMl === 5 &&
            bucketSuffix === "-rollon";
        if (isCylinder5mlRollon) {
            filtered = filtered.filter((g) => CYLINDER_5ML_ROLLON_ALLOWED.has(g.color ?? ""));
            // Deduplicate: one per canonical color during the migration window.
            const seen = new Set<string>();
            filtered = filtered.filter((g) => {
                const c = g.color ?? "";
                const canonical = BLUE_ALIASES.has(c) ? "Cobalt Blue" : c;
                if (seen.has(canonical)) return false;
                seen.add(canonical);
                return true;
            });
        }

        // Global color dedupe for sibling swatches:
        // if multiple groups have same color (e.g. data artifacts), show only one swatch per color.
        const seenColor = new Set<string>();
        filtered = filtered.filter((g) => {
            const c = g.color ?? "";
            const canonical = BLUE_ALIASES.has(c) ? "Cobalt Blue" : c;
            if (seenColor.has(canonical)) return false;
            seenColor.add(canonical);
            return true;
        });

        return filtered;
    },
});

/**
 * Returns sibling groups with DIFFERENT applicator types — same family + capacityMl + color, different applicator suffix.
 * Used by the PDP "This Bottle Also Takes" strip to surface cross-compatible fitments.
 * Returns groups grouped by applicator bucket label for display.
 */
export const getApplicatorSiblings = query({
    args: {
        family: v.string(),
        capacityMl: v.number(),
        color: v.string(),
        excludeSlug: v.string(),
        neckThreadSize: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const all = await ctx.db
            .query("productGroups")
            .withIndex("by_family", (q) => q.eq("family", args.family))
            .collect();

        const currentSuffix = APPLICATOR_BUCKET_SUFFIXES.find((s) => args.excludeSlug.endsWith(s));
        const hasKnownSuffix = (slug: string) => APPLICATOR_BUCKET_SUFFIXES.some((s) => slug.endsWith(s));

        const siblings = all.filter(
            (g) =>
                g.capacityMl === args.capacityMl &&
                g.color === args.color &&
                g.slug !== args.excludeSlug &&
                (args.neckThreadSize == null || g.neckThreadSize === args.neckThreadSize) &&
                // Must be a DIFFERENT applicator bucket than current page
                (currentSuffix
                    ? !g.slug.endsWith(currentSuffix) // exclude groups with same suffix
                    : hasKnownSuffix(g.slug)           // current has no suffix (cap only) → show all suffixed groups
                )
        );

        return await Promise.all(siblings.map(async (g) => {
            if (g.heroImageUrl) return g;

            const variants = await ctx.db
                .query("products")
                .withIndex("by_productGroupId", (q) => q.eq("productGroupId", g._id))
                .collect();
            const representative = variants.find((variant) => variant.imageUrl) ?? variants.find((variant) => variant.imageUrlCapOff);

            return {
                ...g,
                heroImageUrl: representative?.imageUrl ?? representative?.imageUrlCapOff ?? null,
            };
        }));
    },
});

/**
 * Data quality audit — scans for duplicates and misclassified component SKUs.
 * Uses paginated internal reads so the audit still completes as the catalog grows.
 */
export const auditDataQuality = action({
    args: {},
    handler: async (ctx) => {
        type AuditProduct = {
            graceSku: string;
            websiteSku: string;
            itemName: string;
            category: string;
            webPrice1pc: number | null;
        };

        type AuditIssue = {
            type: "duplicate_sku" | "duplicate_name" | "sku_mismatch" | "missing_price" | "missing_category";
            severity: "high" | "medium" | "low";
            graceSku: string;
            itemName: string;
            detail: string;
        };

        const allProducts: AuditProduct[] = [];
        let cursor: string | null = null;

        while (true) {
            const result: {
                page: Array<{
                    graceSku: string;
                    websiteSku: string;
                    itemName: string;
                    category: string;
                    webPrice1pc: number | null;
                }>;
                isDone: boolean;
                continueCursor: string;
            } = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: 200,
            });

            allProducts.push(
                ...result.page.map((p) => ({
                    graceSku: p.graceSku,
                    websiteSku: p.websiteSku,
                    itemName: p.itemName,
                    category: p.category,
                    webPrice1pc: p.webPrice1pc ?? null,
                })),
            );

            if (result.isDone) break;
            cursor = result.continueCursor;
        }

        const issues: AuditIssue[] = [];

        const skuMap = new Map<string, AuditProduct[]>();
        for (const p of allProducts) {
            const key = p.graceSku;
            if (!skuMap.has(key)) skuMap.set(key, []);
            skuMap.get(key)!.push(p);
        }
        for (const [sku, products] of skuMap) {
            if (products.length > 1) {
                issues.push({
                    type: "duplicate_sku",
                    severity: "high",
                    graceSku: sku,
                    itemName: products[0].itemName,
                    detail: `${products.length} products share graceSku "${sku}": ${products.map((p) => p.websiteSku).join(", ")}`,
                });
            }
        }

        const nameMap = new Map<string, AuditProduct[]>();
        for (const p of allProducts) {
            const normalizedName = p.itemName.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (!nameMap.has(normalizedName)) nameMap.set(normalizedName, []);
            nameMap.get(normalizedName)!.push(p);
        }
        for (const [, products] of nameMap) {
            if (products.length > 1) {
                const skus = products.map((p) => p.graceSku);
                if (new Set(skus).size === skus.length) {
                    issues.push({
                        type: "duplicate_name",
                        severity: "medium",
                        graceSku: products[0].graceSku,
                        itemName: products[0].itemName,
                        detail: `${products.length} products with identical normalized name: ${skus.join(", ")}`,
                    });
                }
            }
        }

        const skuCategoryChecks: Array<{ prefix: string; expectedKeywords: string[]; wrongLabel: string }> = [
            { prefix: "SPR", expectedKeywords: ["sprayer"], wrongLabel: "not labeled as Sprayer" },
            { prefix: "AST", expectedKeywords: ["sprayer", "atomizer"], wrongLabel: "not labeled as Sprayer/Atomizer" },
            { prefix: "ASP", expectedKeywords: ["sprayer", "atomizer"], wrongLabel: "not labeled as Sprayer/Atomizer" },
            { prefix: "ATM", expectedKeywords: ["sprayer", "atomizer"], wrongLabel: "not labeled as Sprayer/Atomizer" },
            { prefix: "DRP", expectedKeywords: ["dropper"], wrongLabel: "not labeled as Dropper" },
            { prefix: "LPM", expectedKeywords: ["lotion", "pump"], wrongLabel: "not labeled as Lotion Pump" },
            { prefix: "RDC", expectedKeywords: ["reducer"], wrongLabel: "not labeled as Reducer" },
            { prefix: "ROL", expectedKeywords: ["roller", "roll"], wrongLabel: "not labeled as Roller" },
        ];

        for (const p of allProducts) {
            if (p.category !== "Component") continue;
            const sku = p.graceSku.toUpperCase();
            for (const check of skuCategoryChecks) {
                if (sku.includes(`-${check.prefix}-`) || sku.includes(`-${check.prefix}`)) {
                    const name = p.itemName.toLowerCase();
                    const hasKeyword = check.expectedKeywords.some((kw) => name.includes(kw));
                    if (!hasKeyword) {
                        issues.push({
                            type: "sku_mismatch",
                            severity: "medium",
                            graceSku: p.graceSku,
                            itemName: p.itemName,
                            detail: `SKU contains "${check.prefix}" but item name is ${check.wrongLabel}: "${p.itemName}"`,
                        });
                    }
                }
            }

            if (sku.includes("-CAP-")) {
                const name = p.itemName.toLowerCase();
                if (name.includes("sprayer") || name.includes("bulb") || name.includes("atomizer")) {
                    issues.push({
                        type: "sku_mismatch",
                        severity: "high",
                        graceSku: p.graceSku,
                        itemName: p.itemName,
                        detail: `SKU has "CAP" prefix but item is a sprayer/bulb: "${p.itemName}"`,
                    });
                }
            }

            if (p.webPrice1pc == null || p.webPrice1pc === 0) {
                issues.push({
                    type: "missing_price",
                    severity: "low",
                    graceSku: p.graceSku,
                    itemName: p.itemName,
                    detail: "Missing webPrice1pc",
                });
            }
        }

        const severityOrder = { high: 0, medium: 1, low: 2 };
        issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        return {
            totalProducts: allProducts.length,
            issueCount: issues.length,
            highSeverity: issues.filter((i) => i.severity === "high").length,
            mediumSeverity: issues.filter((i) => i.severity === "medium").length,
            lowSeverity: issues.filter((i) => i.severity === "low").length,
            issues: issues.slice(0, 100),
        };
    },
});

/**
 * Audit applicator values for schema v1.2 — find values not in the constrained union.
 * Run BEFORE deploying the constrained applicator field.
 * Uses pagination to avoid 16MB read limit.
 * Usage: npx convex run products:auditApplicatorValues
 */
export const auditApplicatorValues = action({
    args: {},
    handler: async (ctx) => {
        const allowed = new Set([
            "Metal Roller Ball", "Plastic Roller Ball",
            "Metal Roller", "Plastic Roller",
            "Fine Mist Sprayer", "Perfume Spray Pump",
            "Atomizer", "Antique Bulb Sprayer", "Antique Bulb Sprayer with Tassel",
            "Lotion Pump", "Dropper", "Reducer",
            "Glass Stopper", "Glass Rod",
            "Cap/Closure", "Applicator Cap", "Metal Atomizer", "N/A",
        ]);
        const values = new Set<string>();
        let cursor: string | null = null;
        let total = 0;

        while (true) {
            const result: {
                page: Array<{ applicator?: string | null }>;
                isDone: boolean;
                continueCursor: string;
            } = await ctx.runQuery(internal.migrations.getProductPage, {
                cursor,
                numItems: 200,
            });
            for (const p of result.page) {
                total++;
                if (p.applicator) values.add(p.applicator);
            }
            if (result.isDone) break;
            cursor = result.continueCursor;
        }

        const violations = [...values].filter((val) => !allowed.has(val));
        return { allValues: [...values].sort(), violations, total };
    },
});

/**
 * Export a page of products for CSV/JSON dump. Used by scripts/export_products_csv.mjs
 */
export const getProductExportPage = action({
    args: {
        cursor: v.union(v.string(), v.null()),
        numItems: v.number(),
    },
    handler: async (ctx, args): Promise<{
        page: Array<Record<string, unknown>>;
        isDone: boolean;
        continueCursor: string;
    }> => {
        return await ctx.runQuery(internal.migrations.getProductPage, {
            cursor: args.cursor,
            numItems: args.numItems,
        }) as {
            page: Array<Record<string, unknown>>;
            isDone: boolean;
            continueCursor: string;
        };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE BACKFILL — Run once to cache primary SKUs on productGroups
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Backfills primaryGraceSku + primaryWebsiteSku on every productGroup.
 *
 * Run once:  npx convex run products:backfillPrimarySkus
 *
 * After this runs, getCatalogGroupPrimarySkus becomes a single read of
 * productGroups (~230 lightweight docs) with zero extra product queries.
 * Catalog page load time: ~2-4s → <500ms.
 */
export const backfillPrimarySkus = internalMutation({
    args: {},
    handler: async (ctx) => {
        const groups = await ctx.db.query("productGroups").collect();
        let updated = 0;
        let skipped = 0;

        // Process in serial to be gentle on the DB. Each group needs one index lookup.
        for (const g of groups) {
            // Skip if already populated
            if (g.primaryGraceSku !== undefined && g.primaryGraceSku !== null) {
                skipped++;
                continue;
            }

            const firstVariant = await ctx.db
                .query("products")
                .withIndex("by_productGroupId", (q) => q.eq("productGroupId", g._id))
                .first();

            if (firstVariant) {
                await ctx.db.patch(g._id, {
                    primaryGraceSku: firstVariant.graceSku ?? null,
                    primaryWebsiteSku: firstVariant.websiteSku ?? null,
                });
                updated++;
            }
        }

        return {
            updated,
            skipped,
            total: groups.length,
            message: `Backfill complete. ${updated} groups populated, ${skipped} already had SKUs.`,
        };
    },
});

/**
 * Valid productGroup ids (~230) — for integrity scripts that paginate products client-side.
 */
export const getProductGroupIdList = query({
    args: {},
    handler: async (ctx) => {
        const groups = await ctx.db.query("productGroups").collect();
        return groups.map((g) => g._id);
    },
});

/**
 * One page of catalog integrity stats. Convex allows only one `.paginate()` per function;
 * `scripts/catalog-integrity.mjs` loops and merges batches. Pass `validGroupIds` from
 * `getProductGroupIdList` once per run (avoids N db.get calls per row).
 */
export const getCatalogIntegrityBatch = query({
    args: {
        cursor: v.union(v.string(), v.null()),
        validGroupIds: v.array(v.id("productGroups")),
    },
    handler: async (ctx, args) => {
        const valid = new Set(args.validGroupIds);
        const result = await ctx.db.query("products").paginate({
            numItems: 150,
            cursor: args.cursor as string | null,
        });

        const skuCounts: Record<string, number> = {};
        let missingGraceSku = 0;
        let emptyItemName = 0;
        let orphanRowCount = 0;
        const orphanSamples: string[] = [];

        for (const p of result.page) {
            if (!p.graceSku?.trim()) missingGraceSku++;
            else {
                const s = p.graceSku.trim();
                skuCounts[s] = (skuCounts[s] ?? 0) + 1;
            }
            if (!p.itemName?.trim()) emptyItemName++;
            if (p.productGroupId && !valid.has(p.productGroupId)) {
                orphanRowCount++;
                if (orphanSamples.length < 20 && p.graceSku) orphanSamples.push(p.graceSku);
            }
        }

        return {
            pageRowCount: result.page.length,
            missingGraceSku,
            emptyItemName,
            orphanRowCount,
            skuCounts,
            orphanSamples,
            continueCursor: result.continueCursor,
            isDone: result.isDone,
        };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// SHOPIFY SELLABILITY SYNC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Records whether Shopify will actually complete a sale for each variant.
 *
 * A `shopifyVariantId` alone is not enough: if the parent Shopify product is
 * DRAFT or unpublished, `/cart/<variantId>:<qty>` returns HTTP 410 and the
 * customer hits a dead checkout. The 2026-07-29 launch audit found 377 of
 * 2,313 variants in exactly that state.
 *
 * Driven by `scripts/sync_shopify_sellability.mjs`. Write-token guarded so it
 * can never be called from the public client.
 */
export const setShopifySellabilityBatch = mutation({
    args: {
        writeToken: v.string(),
        entries: v.array(
            v.object({
                graceSku: v.string(),
                sellable: v.boolean(),
                reason: v.union(v.string(), v.null()),
            }),
        ),
    },
    handler: async (ctx, args) => {
        verifyProductImageWriteToken(args.writeToken);

        const checkedAt = Date.now();
        let updated = 0;
        let unchanged = 0;
        const notFound: string[] = [];

        for (const entry of args.entries) {
            const product = await ctx.db
                .query("products")
                .withIndex("by_graceSku", (q) => q.eq("graceSku", entry.graceSku))
                .first();

            if (!product) {
                notFound.push(entry.graceSku);
                continue;
            }

            if (
                product.shopifySellable === entry.sellable &&
                (product.shopifySellableReason ?? null) === entry.reason
            ) {
                // Still stamp the check time so staleness is visible.
                await ctx.db.patch(product._id, { shopifySellableCheckedAt: checkedAt });
                unchanged++;
                continue;
            }

            await ctx.db.patch(product._id, {
                shopifySellable: entry.sellable,
                shopifySellableReason: entry.reason,
                shopifySellableCheckedAt: checkedAt,
            });
            updated++;
        }

        return { updated, unchanged, notFound, checkedAt };
    },
});

/**
 * Launch gate: how many SKUs the storefront advertises as checkout-ready but
 * Shopify would refuse. Should be 0 before go-live.
 */
export const getCheckoutBlockedCount = query({
    args: {},
    handler: async (ctx) => {
        // Indexed reads only — a full `products` collect() blows Convex's
        // 16 MB per-function byte limit at 2,330 documents.
        const blocked = await ctx.db
            .query("products")
            .withIndex("by_shopifySellable", (q) => q.eq("shopifySellable", false))
            .collect();

        const byReason: Record<string, number> = {};
        for (const p of blocked) {
            const key = p.shopifySellableReason ?? "unknown";
            byReason[key] = (byReason[key] ?? 0) + 1;
        }

        return {
            blocked: blocked.length,
            byReason,
            sampleBlockedSkus: blocked.slice(0, 10).map((p) => p.graceSku),
        };
    },
});
