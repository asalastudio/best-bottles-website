import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { resolveSearchCatalogParameters } from "@/lib/graceToolParamUtils";
import {
    VERIFIED_9ML_CYLINDER_ROLLON_COLORS,
    buildSearchCatalogToolResult,
    emptySearchCatalogHint,
} from "../../../convex/graceSearchUtils";
import { noMatchGraceToolResult } from "@/lib/graceToolResults";
import { searchCatalogServer } from "@/lib/catalogServer";
import type { GraceRefineState } from "@/lib/grace/refineState";
import type { GraceOpenAIToolName } from "@/lib/knowledge/toolSchemas";

/**
 * Provider-neutral executor for every Convex-backed Grace tool.
 */

let _convex: ConvexHttpClient | null = null;

function getConvex(): ConvexHttpClient {
    if (!_convex) {
        const url = process.env.NEXT_PUBLIC_CONVEX_URL;
        if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
        _convex = new ConvexHttpClient(url);
    }
    return _convex;
}

function getResultCount(result: unknown): number | null {
    if (Array.isArray(result)) return result.length;
    if (result && typeof result === "object") {
        const record = result as Record<string, unknown>;
        for (const key of ["totalVariants", "totalGroups", "totalComponents"]) {
            const value = record[key];
            if (typeof value === "number") return value;
        }
    }
    return null;
}

function wantsRawSearchCatalogResult(parameters: Record<string, unknown>): boolean {
    const format = parameters.responseFormat;
    return parameters.returnRaw === true || parameters.returnRaw === "true" || format === "raw";
}

const FAMILY_CARD_CACHE_TTL_MS = 5 * 60 * 1000;
const familyCardCache = new Map<string, { cachedAt: number; result: unknown }>();

export type GraceServerToolName = GraceOpenAIToolName
    | "getProductGroup"
    | "getProductBySku"
    | "getFamilyForCard"
    | "getCatalogStrip"
    | "getProductsForComparison";

export async function executeGraceServerTool({
    toolName,
    parameters = {},
}: {
    toolName: GraceServerToolName;
    parameters?: Record<string, unknown>;
}): Promise<unknown> {
        if (!toolName) throw new Error("Missing tool_name");

        const tool_name = toolName;
        const convex = getConvex();
        const t0 = Date.now();
        let result: unknown;

        switch (tool_name) {
            case "searchCatalog": {
                const searchParams = resolveSearchCatalogParameters(parameters);
                const returnRaw = wantsRawSearchCatalogResult(parameters);
                const refineState = parameters.refineState as GraceRefineState | undefined;
                if (refineState?.filters && refineState.sort && refineState.view) {
                    const catalog = await searchCatalogServer({
                        filters: refineState.filters,
                        sort: refineState.sort,
                        view: refineState.view,
                        limit: 24,
                        cursor: null,
                    });
                    if (catalog.items.length === 0) {
                        result = noMatchGraceToolResult({
                            message: `No verified products match the active Refine state for "${searchParams.searchTerm}". Keep the active constraints unless the customer explicitly asks to broaden them.`,
                            requested: { searchTerm: searchParams.searchTerm },
                            suggestedQueries: [],
                            warnings: ["Never silently remove a family, capacity, color, applicator, or neck-thread constraint."],
                        });
                        break;
                    }
                    const primarySkuByGroup = new Map(catalog.primarySkus.map((row) => [String(row.groupId), row]));
                    const lines = [
                        `Verified Refine results: ${catalog.totalCount} product group${catalog.totalCount === 1 ? "" : "s"}. Showing ${catalog.items.length}.`,
                        ...catalog.items.map((group) => {
                            const primary = primarySkuByGroup.get(String(group._id));
                            return [
                                group.displayName,
                                group.capacity,
                                group.color,
                                group.neckThreadSize ? `thread ${group.neckThreadSize}` : null,
                                primary?.graceSku ? `Grace SKU ${primary.graceSku}` : null,
                                typeof group.priceRangeMin === "number" ? `from $${group.priceRangeMin.toFixed(2)}` : null,
                            ].filter(Boolean).join(" — ");
                        }),
                    ];
                    result = returnRaw ? catalog : lines.join("\n");
                    break;
                }
                const data = await convex.query(
                    api.grace.searchCatalog,
                    searchParams
                );
                if (!Array.isArray(data)) {
                    result = data;
                } else if (data.length === 0) {
                    if (returnRaw) {
                        result = [];
                        break;
                    }
                    result = noMatchGraceToolResult({
                        message: `No verified exact match found for "${searchParams.searchTerm}". Do not name or recommend a specific product from memory. Try a broader term or one of the suggested searches.${emptySearchCatalogHint(searchParams.searchTerm)}`,
                        requested: {
                            searchTerm: searchParams.searchTerm,
                            familyLimit: searchParams.familyLimit,
                            applicatorFilter: searchParams.applicatorFilter,
                        },
                        suggestedQueries: [
                            searchParams.familyLimit ? `${searchParams.familyLimit} ${searchParams.searchTerm}` : searchParams.searchTerm.replace(/\b10\s*ml\b/i, "9ml"),
                            searchParams.searchTerm.replace(/\broll[- ]?on\b/i, "roller"),
                        ].filter((q, i, arr) => q.trim() && arr.indexOf(q) === i),
                        warnings: ["Never claim an exact size, SKU, price, stock status, or compatibility unless a tool result returned it."],
                    });
                } else {
                    const slim = data.map((p) => ({
                        graceSku: p.graceSku,
                        websiteSku: p.websiteSku,
                        itemName: p.itemName,
                        shopifyVariantId: p.shopifyVariantId ?? null,
                        checkoutEligible: p.checkoutEligible ?? Boolean(p.shopifyVariantId),
                        family: p.family,
                        capacity: p.capacity,
                        capacityMl: p.capacityMl,
                        color: p.color,
                        rawColor: p.rawColor,
                        canonicalColor: p.canonicalColor,
                        applicator: p.applicator,
                        capColor: p.capColor,
                        neckThreadSize: p.neckThreadSize,
                        slug: p.slug,
                        webPrice1pc: p.webPrice1pc,
                        webPrice10pc: p.webPrice10pc,
                        webPrice12pc: p.webPrice12pc,
                        stockStatus: p.stockStatus,
                        dataQualityFlags: p.dataQualityFlags,
                        sourceTrace: p.sourceTrace,
                    }));
                    result = returnRaw ? slim : buildSearchCatalogToolResult(searchParams, slim);
                }
                break;
            }

            case "getFamilyOverview": {
                result = await convex.query(api.grace.getFamilyOverview, {
                    family: (parameters.family as string) ?? "",
                });
                break;
            }

            case "getBottleComponents": {
                const requestedBottle = String((parameters.bottleSku as string) ?? "").trim();
                let resolvedBottleSku = requestedBottle;
                let data = await convex.query(api.grace.getBottleComponents, {
                    bottleSku: resolvedBottleSku,
                });
                if (!data && requestedBottle.length >= 3) {
                    const fallbackMatches = await convex.query(api.grace.searchCatalog, {
                        searchTerm: requestedBottle,
                    });
                    const firstMatch = Array.isArray(fallbackMatches) ? fallbackMatches[0] : null;
                    if (firstMatch?.graceSku) {
                        resolvedBottleSku = firstMatch.graceSku;
                        data = await convex.query(api.grace.getBottleComponents, {
                            bottleSku: resolvedBottleSku,
                        });
                    }
                }
                if (data && typeof data === "object" && "bottle" in data) {
                    const d = data as {
                        bottle: Record<string, unknown>;
                        componentTypes: string[];
                        totalComponents: number;
                        components: Record<string, unknown>;
                    };
                    result = {
                        bottle: {
                            graceSku: d.bottle.graceSku,
                            websiteSku: d.bottle.websiteSku,
                            itemName: d.bottle.itemName,
                            shopifyVariantId: d.bottle.shopifyVariantId,
                            checkoutEligible: d.bottle.checkoutEligible ?? Boolean(d.bottle.shopifyVariantId),
                            family: d.bottle.family,
                            capacity: d.bottle.capacity,
                            color: d.bottle.color,
                            neckThreadSize: d.bottle.neckThreadSize,
                            applicator: d.bottle.applicator,
                            capColor: d.bottle.capColor,
                            capStyle: d.bottle.capStyle,
                            webPrice1pc: d.bottle.webPrice1pc,
                            webPrice10pc: d.bottle.webPrice10pc,
                            webPrice12pc: d.bottle.webPrice12pc,
                            stockStatus: d.bottle.stockStatus,
                        },
                        componentTypes: d.componentTypes,
                        totalComponents: d.totalComponents,
                        components: d.components,
                    };
                } else {
                    result = data;
                }
                break;
            }

            case "checkCompatibility": {
                result = await convex.query(api.grace.checkCompatibility, {
                    threadSize: (parameters.threadSize as string) ?? "",
                });
                break;
            }

            case "getCatalogStats": {
                result = await convex.query(api.grace.getCatalogStats, {});
                break;
            }

            case "getProductGroup": {
                result = await convex.query(api.products.getProductGroup, {
                    slug: (parameters.slug as string) ?? "",
                });
                break;
            }

            case "getProductBySku": {
                // Used by the new `displayProductCard` clientTool. Returns the
                // slim ProductCard shape the inline card components consume.
                const sku = (parameters.graceSku as string)
                    ?? (parameters.websiteSku as string)
                    ?? (parameters.sku as string)
                    ?? "";
                if (!sku) {
                    result = null;
                    break;
                }
                const data = await convex.query(api.products.getBySku, { graceSku: sku });
                if (!data) {
                    result = null;
                } else {
                    result = {
                        graceSku: data.graceSku,
                        websiteSku: data.websiteSku,
                        itemName: data.itemName,
                        shopifyVariantId: data.shopifyVariantId ?? null,
                        checkoutEligible: Boolean(data.shopifyVariantId),
                        family: data.family,
                        capacity: data.capacity,
                        capacityMl: data.capacityMl,
                        color: data.color,
                        applicator: data.applicator,
                        capColor: data.capColor,
                        neckThreadSize: data.neckThreadSize,
                        webPrice1pc: data.webPrice1pc,
                        webPrice10pc: data.webPrice10pc,
                        webPrice12pc: data.webPrice12pc,
                        stockStatus: data.stockStatus,
                        // Hero image from product group (catalog renders this);
                        // fall back to per-product imageUrl when group hero missing.
                        heroImageUrl: data.imageUrl ?? null,
                    };
                }
                break;
            }

            case "getFamilyForCard": {
                // Pattern B — full family payload: variants + thread sizes + tagline.
                // Primary path uses cached `primaryGraceSku` on each group; when
                // the backfill hasn't populated those, falls back to searchCatalog
                // (which returns real variants with graceSku + slug).
                const family = (parameters.family as string) ?? "";
                if (!family) { result = null; break; }
                const rawCapacityMl = parameters.capacityMl;
                const parsedCapacityMl = typeof rawCapacityMl === "number"
                    ? rawCapacityMl
                    : Number.parseFloat(String(rawCapacityMl ?? ""));
                const requestedCapacityMl = Number.isFinite(parsedCapacityMl) ? parsedCapacityMl : null;
                const familyCacheKey = `${family.toLowerCase()}:${requestedCapacityMl ?? "all"}`;
                const familyCached = familyCardCache.get(familyCacheKey);
                if (familyCached && Date.now() - familyCached.cachedAt < FAMILY_CARD_CACHE_TTL_MS) {
                    result = familyCached.result;
                    break;
                }
                const [groups, overview] = await Promise.all([
                    convex.query(api.products.getProductGroupsByFamily, { family }),
                    convex.query(api.grace.getFamilyOverview, { family }),
                ]);
                let variants = (groups ?? [])
                    .filter((g) => g.primaryGraceSku)
                    .map((g) => ({
                        graceSku: g.primaryGraceSku as string,
                        websiteSku: g.primaryWebsiteSku ?? null,
                        itemName: g.displayName,
                        shopifyVariantId: null as string | null,
                        checkoutEligible: false,
                        family: g.family,
                        capacity: g.capacity,
                        capacityMl: g.capacityMl,
                        color: g.color,
                        neckThreadSize: g.neckThreadSize,
                        applicator: (g.applicatorTypes ?? []).join(", ") || null,
                        webPrice1pc: g.priceRangeMin,
                        webPrice10pc: null as number | null,
                        webPrice12pc: null as number | null,
                        stockStatus: null as string | null,
                        slug: g.slug,
                        heroImageUrl: g.heroImageUrl ?? null,
                    }));

                // Fallback: groups missing primaryGraceSku — search the catalog
                // and keep requested-size color variants distinct.
                if (variants.length === 0) {
                    const search = await convex.query(api.grace.searchCatalog, {
                        searchTerm: family,
                        familyLimit: family,
                    });
                    const seen = new Set<string | number>();
                    variants = (Array.isArray(search) ? search : [])
                        .filter((p) => {
                            const key = requestedCapacityMl != null && p.capacityMl === requestedCapacityMl
                                ? `${p.capacityMl ?? p.capacity ?? ""}|${p.color ?? ""}|${p.applicator ?? ""}|${p.graceSku}`
                                : p.capacityMl ?? p.capacity ?? p.graceSku;
                            if (seen.has(key)) return false;
                            seen.add(key);
                            return true;
                        })
                        .slice(0, 8)
                        .map((p) => ({
                            graceSku: p.graceSku,
                            websiteSku: p.websiteSku ?? null,
                            itemName: p.itemName,
                            shopifyVariantId: p.shopifyVariantId ?? null,
                            checkoutEligible: p.checkoutEligible ?? Boolean(p.shopifyVariantId),
                            // Fallback path: searchCatalog returns family/slug as
                            // optional, but the primary `groups`-based path infers
                            // them as required strings. Coerce to satisfy the
                            // inferred shape — we know the queried `family` is
                            // valid because we just used it as the search key.
                            family: p.family ?? family,
                            capacity: p.capacity,
                            capacityMl: p.capacityMl,
                            color: p.color,
                            neckThreadSize: p.neckThreadSize,
                            applicator: p.applicator ?? null,
                            webPrice1pc: p.webPrice1pc,
                            webPrice10pc: p.webPrice10pc ?? null,
                            webPrice12pc: p.webPrice12pc ?? null,
                            stockStatus: p.stockStatus ?? null,
                            slug: p.slug ?? "",
                            heroImageUrl: null as string | null,
                        }));
                }

                // The groups path is intentionally representative, but Grace's
                // family card is more useful when it exposes every real size
                // the catalog search can verify. Merge in missing capacities
                // from searchCatalog, preserving one concise representative
                // per numeric size.
                const search = await convex.query(api.grace.searchCatalog, {
                    searchTerm: requestedCapacityMl != null ? `${family} ${requestedCapacityMl}ml` : family,
                    familyLimit: family,
                });
                if (Array.isArray(search) && search.length > 0) {
                    const seenCapacity = new Set(
                        variants.map((v) => requestedCapacityMl != null && v.capacityMl === requestedCapacityMl
                            ? `${v.capacityMl ?? v.capacity ?? ""}|${v.color ?? ""}|${v.applicator ?? ""}|${v.graceSku}`
                            : v.capacityMl ?? v.capacity ?? v.graceSku),
                    );
                    for (const p of search) {
                        const key = requestedCapacityMl != null && p.capacityMl === requestedCapacityMl
                            ? `${p.capacityMl ?? p.capacity ?? ""}|${p.color ?? ""}|${p.applicator ?? ""}|${p.graceSku}`
                            : p.capacityMl ?? p.capacity ?? p.graceSku;
                        if (seenCapacity.has(key)) continue;
                        seenCapacity.add(key);
                        variants.push({
                            graceSku: p.graceSku,
                            websiteSku: p.websiteSku ?? null,
                            itemName: p.itemName,
                            shopifyVariantId: p.shopifyVariantId ?? null,
                            checkoutEligible: p.checkoutEligible ?? Boolean(p.shopifyVariantId),
                            family: p.family ?? family,
                            capacity: p.capacity,
                            capacityMl: p.capacityMl,
                            color: p.color,
                            neckThreadSize: p.neckThreadSize,
                            applicator: p.applicator ?? null,
                            webPrice1pc: p.webPrice1pc,
                            webPrice10pc: p.webPrice10pc ?? null,
                            webPrice12pc: p.webPrice12pc ?? null,
                            stockStatus: p.stockStatus ?? null,
                            slug: p.slug ?? "",
                            heroImageUrl: null as string | null,
                        });
                    }
                }
                if (overview && typeof overview === "object" && "sizes" in overview) {
                    const sizes = ((overview as { sizes?: Array<{ label?: string; ml?: number | null }> }).sizes ?? [])
                        .filter((s) => s.label || s.ml != null);
                    const seenCapacity = new Set(variants.map((v) => v.capacityMl ?? v.capacity ?? v.graceSku));
                    for (const size of sizes) {
                        const key = size.ml ?? size.label;
                        if (key == null || seenCapacity.has(key)) continue;
                        const searchTerm = `${family} ${size.label ?? `${size.ml}ml`}`;
                        const sizeMatches = await convex.query(api.grace.searchCatalog, {
                            searchTerm,
                            familyLimit: family,
                        });
                        const match = Array.isArray(sizeMatches)
                            ? sizeMatches.find((p) => p.capacityMl === size.ml) ?? sizeMatches[0]
                            : null;
                        if (!match?.graceSku) continue;
                        seenCapacity.add(key);
                        variants.push({
                            graceSku: match.graceSku,
                            websiteSku: match.websiteSku ?? null,
                            itemName: match.itemName,
                            shopifyVariantId: match.shopifyVariantId ?? null,
                            checkoutEligible: match.checkoutEligible ?? Boolean(match.shopifyVariantId),
                            family: match.family ?? family,
                            capacity: match.capacity,
                            capacityMl: match.capacityMl,
                            color: match.color,
                            neckThreadSize: match.neckThreadSize,
                            applicator: match.applicator ?? null,
                            webPrice1pc: match.webPrice1pc,
                            webPrice10pc: match.webPrice10pc ?? null,
                            webPrice12pc: match.webPrice12pc ?? null,
                            stockStatus: match.stockStatus ?? null,
                            slug: match.slug ?? "",
                            heroImageUrl: null as string | null,
                        });
                    }
                }
                const variantKey = (variant: { graceSku?: string | null; slug?: string | null; capacityMl?: number | null; color?: string | null }) =>
                    variant.graceSku ?? `${variant.slug ?? ""}|${variant.capacityMl ?? ""}|${variant.color ?? ""}`;
                const seenVariantKeys = new Set<string>();
                variants = variants.filter((variant) => {
                    const key = variantKey(variant);
                    if (seenVariantKeys.has(key)) return false;
                    seenVariantKeys.add(key);
                    return true;
                });
                const byCapacity = (a: { capacityMl?: number | null }, b: { capacityMl?: number | null }) =>
                    (a.capacityMl ?? Number.MAX_SAFE_INTEGER) - (b.capacityMl ?? Number.MAX_SAFE_INTEGER);
                if (requestedCapacityMl != null) {
                    const requestedVariants = variants.filter((v) => v.capacityMl === requestedCapacityMl);
                    const otherVariants = variants.filter((v) => v.capacityMl !== requestedCapacityMl);
                    const reservedKeys = new Set<string>();
                    const requestedColorReps = family.toLowerCase() === "cylinder" && requestedCapacityMl === 9
                        ? VERIFIED_9ML_CYLINDER_ROLLON_COLORS
                            .map((color) => requestedVariants.find((v) => v.color === color))
                            .filter((v): v is (typeof variants)[number] => Boolean(v))
                        : [];
                    for (const variant of requestedColorReps) reservedKeys.add(variantKey(variant));
                    const requestedRest = requestedVariants.filter((variant) => !reservedKeys.has(variantKey(variant)));
                    variants = [
                        ...requestedColorReps,
                        ...requestedRest.sort((a, b) => String(a.color ?? "").localeCompare(String(b.color ?? ""))),
                        ...otherVariants.sort(byCapacity),
                    ].slice(0, 16);
                } else {
                    variants = variants.sort(byCapacity).slice(0, 16);
                }
                let enrichmentFailed = false;
                variants = await Promise.all(variants.map(async (variant) => {
                    if (variant.shopifyVariantId) return variant;
                    const product = await convex.query(api.products.getBySku, { graceSku: variant.graceSku }).catch(() => {
                        enrichmentFailed = true;
                        return null;
                    });
                    if (!product) return variant;
                    return {
                        ...variant,
                        websiteSku: product.websiteSku ?? variant.websiteSku ?? null,
                        shopifyVariantId: product.shopifyVariantId ?? null,
                        checkoutEligible: Boolean(product.shopifyVariantId ?? variant.shopifyVariantId),
                        webPrice1pc: product.webPrice1pc ?? variant.webPrice1pc,
                        webPrice10pc: product.webPrice10pc ?? variant.webPrice10pc ?? null,
                        webPrice12pc: product.webPrice12pc ?? variant.webPrice12pc ?? null,
                        stockStatus: product.stockStatus ?? variant.stockStatus ?? null,
                    };
                }));

                result = {
                    family,
                    tagline: overview && typeof overview === "object" && "graceHint" in overview
                        ? String((overview as { graceHint?: string }).graceHint ?? "")
                        : "",
                    variants,
                    defaultGraceSku: variants[0]?.graceSku,
                    threadSizes: overview && typeof overview === "object" && "threadSizes" in overview
                        ? ((overview as { threadSizes?: string[] }).threadSizes ?? [])
                        : [],
                    priceFromCents: variants.length
                        ? Math.round((Math.min(...variants.map((v) => v.webPrice1pc ?? Infinity).filter((n) => Number.isFinite(n))) || 0) * 100)
                        : null,
                };
                // Only cache healthy payloads: a transiently failed enrichment or an
                // empty read would otherwise poison the card for the full TTL.
                if (variants.length && !enrichmentFailed) {
                    familyCardCache.set(familyCacheKey, { cachedAt: Date.now(), result });
                }
                break;
            }

            case "getCatalogStrip": {
                // Pattern L — every family group with hero image, capped at 60.
                const groups = await convex.query(api.products.getAllCatalogGroups, {});
                const seenFamilies = new Set<string>();
                const families: Array<{ family: string; heroImageUrl: string | null; variantCount: number }> = [];
                for (const g of (groups ?? [])) {
                    if (!g.family || seenFamilies.has(g.family)) continue;
                    seenFamilies.add(g.family);
                    families.push({
                        family: g.family,
                        heroImageUrl: g.heroImageUrl ?? null,
                        variantCount: g.variantCount ?? 0,
                    });
                    if (families.length >= 60) break;
                }
                result = {
                    families,
                    activeCategory: parameters.category ?? null,
                    categories: ["Roller balls", "Atomizers", "Droppers", "Sprayers", "Apothecary", "Decorative"],
                };
                break;
            }

            case "getProductsForComparison": {
                // Pattern F — fetch N SKUs in parallel for the comparison table.
                const skus = (parameters.graceSkus as string[]) ?? [];
                const fetched = await Promise.all(
                    skus.map((sku) =>
                        convex.query(api.products.getBySku, { graceSku: sku }).catch(() => null),
                    ),
                );
                result = fetched
                    .filter((p): p is NonNullable<typeof p> => !!p)
                    .map((p) => ({
                        graceSku: p.graceSku,
                        websiteSku: p.websiteSku,
                        itemName: p.itemName,
                        shopifyVariantId: p.shopifyVariantId ?? null,
                        checkoutEligible: Boolean(p.shopifyVariantId),
                        family: p.family,
                        capacity: p.capacity,
                        capacityMl: p.capacityMl,
                        color: p.color,
                        applicator: p.applicator,
                        neckThreadSize: p.neckThreadSize,
                        webPrice1pc: p.webPrice1pc,
                        webPrice10pc: p.webPrice10pc,
                        webPrice12pc: p.webPrice12pc,
                        stockStatus: p.stockStatus,
                        heroImageUrl: p.imageUrl ?? null,
                        heightMm: null,
                    }));
                break;
            }

            default:
                throw new Error(`Unknown tool: ${tool_name}`);
        }

        console.info("[Grace server-tool] ok", {
            tool_name,
            durationMs: Date.now() - t0,
            resultCount: getResultCount(result),
            resultType: Array.isArray(result) ? "array" : typeof result,
        });

        return result;
}
