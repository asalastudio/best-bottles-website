import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { createResilientConvexHttpClient } from "@/lib/convexServerClient";
import { resolveSearchCatalogParameters } from "@/lib/graceToolParamUtils";
import { enrichSearchCatalogWithJev } from "@/lib/grace/enrichSearchCatalogWithJev";
import { applyRefineFacets, describeRefineFacets } from "@/lib/grace/refineFacetMatch";
import { annotateGraceSearchRows, buildGraceSearchTiles, type GraceTileImageSources } from "@/lib/grace/searchTiles";
import { getCatalogHero } from "@/lib/products/catalog-heroes";
import { hasCatalogSourceHold, isHiddenCatalogGroup } from "@/lib/products/catalog-listing-visibility";

type GraceTileRow = { slug?: string | null; websiteSku?: string | null; graceSku?: string | null };

/** The catalogue card's hero: the group's released Sunburst hero among the rows the search returned. */
function heroForSearchGroup(slug: string, rows: readonly GraceTileRow[]): { websiteSku: string; url: string } | null {
    const hero = getCatalogHero(slug, rows, rows[0]?.websiteSku ?? null);
    return hero ? { websiteSku: hero.websiteSku, url: hero.url } : null;
}

/**
 * Photo sources for Grace's tiles: Sunburst hero first, then the SKU's own
 * cap-on plate (one plate-index query for the rows without a hero). A plate
 * lookup failure costs the photos, never the search.
 */
async function graceTileImageSources<Row extends GraceTileRow>(
    convex: Pick<ConvexHttpClient, "query">,
    rows: readonly Row[],
): Promise<GraceTileImageSources<Row>> {
    const withHeroes = annotateGraceSearchRows(rows, { heroForGroup: heroForSearchGroup });
    const wanted = Array.from(new Set(
        withHeroes.filter((row) => !row.heroImageUrl && row.websiteSku?.trim()).map((row) => row.websiteSku!.trim()),
    )).slice(0, 25);
    let plates: Record<string, { thumb?: string | null; image?: string | null }> = {};
    if (wanted.length > 0) {
        try {
            const found = await convex.query(api.productPlates.forSkus, { skus: wanted });
            plates = found.plates;
        } catch (error) {
            console.warn("[Grace tools] plate lookup failed; tiles keep their heroes only:", error instanceof Error ? error.message : error);
        }
    }
    return {
        heroForGroup: heroForSearchGroup,
        plateForSku: (websiteSku) => {
            const plate = websiteSku ? plates[websiteSku.trim()] : undefined;
            return plate?.thumb || plate?.image || null;
        },
    };
}

/** "applicator: filter rollon; capFinish: Gold Cap" from Jev's recorded decisions, for the model and the logs. */
function describeJevDecisions(decisions: Record<string, string> | undefined): string {
    const parts = Object.entries(decisions ?? {})
        .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
        .map(([key, value]) => `${key}: ${value}`);
    return parts.length > 0 ? parts.join("; ") : "no recorded decisions";
}

/**
 * Sellable means Shopify says so. A variant ID alone is not enough: hundreds of
 * variants exist as drafts (schema.ts, shopifySellable). When Shopify's word is
 * missing, fall back to the older rule so nothing that used to be offered
 * disappears.
 */
function isCheckoutEligible(row: { shopifySellable?: boolean | null; checkoutEligible?: boolean | null; shopifyVariantId?: string | null }): boolean {
    if (row.shopifySellable === true) return true;
    if (row.shopifySellable === false) return false;
    return row.checkoutEligible ?? Boolean(row.shopifyVariantId);
}

/**
 * Groups the storefront hides (duplicates, discontinued, source holds), the
 * Internal category, retired SKUs and discontinued stock never reach a customer
 * through Grace. The first live turn after the search fix surfaced two
 * "__RETIRED__" 9 ml Cylinder rows marked Discontinued as the answer to a
 * 10 ml roll-on request.
 */
function isCustomerVisibleRow(row: {
    slug?: string | null;
    category?: string | null;
    websiteSku?: string | null;
    stockStatus?: string | null;
    retired?: boolean | null;
}): boolean {
    if (row.category === "Internal") return false;
    if (row.retired === true) return false;
    if (typeof row.websiteSku === "string" && row.websiteSku.includes("__RETIRED__")) return false;
    if (typeof row.stockStatus === "string" && /^discontinued$/i.test(row.stockStatus.trim())) return false;
    const slug = row.slug?.trim();
    if (slug && (isHiddenCatalogGroup(slug) || hasCatalogSourceHold(slug))) return false;
    return true;
}
import {
    VERIFIED_9ML_CYLINDER_ROLLON_COLORS,
    buildSearchCatalogToolResult,
    emptySearchCatalogHint,
} from "../../../convex/graceSearchUtils";
import { noMatchGraceToolResult, type GraceToolResult } from "@/lib/graceToolResults";
import { searchCatalogServer } from "@/lib/catalogServer";
import { buildPolicyToolResult } from "@/lib/grace/policyCorpus";
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
        _convex = createResilientConvexHttpClient(url);
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
    | "getProductMeasurements"
    | "getFamilyForCard"
    | "getCatalogStrip"
    | "getProductsForComparison";

export function normalizeGraceServerToolCall(
    toolName: GraceServerToolName,
    parameters: Record<string, unknown>,
): { toolName: GraceServerToolName; parameters: Record<string, unknown> } {
    switch (toolName) {
        case "compareProducts":
            return {
                toolName: "searchCatalog",
                parameters: {
                    searchTerm: parameters.query ?? "",
                    familyLimit: parameters.family ?? null,
                },
            };
        case "showProductPresentation":
            return {
                toolName: "searchCatalog",
                parameters: {
                    searchTerm: parameters.searchTerm ?? "",
                    familyLimit: parameters.familyLimit ?? null,
                },
            };
        case "displayProductCard":
        case "displayAnatomy":
            return { toolName: "getProductBySku", parameters: { graceSku: parameters.graceSku ?? "" } };
        case "displayFamilyCard":
            return {
                toolName: "getFamilyForCard",
                parameters: {
                    family: parameters.family ?? "",
                    capacityMl: parameters.capacityMl ?? null,
                },
            };
        case "displayCompatibility":
        case "displayBuildKit":
            return { toolName: "getBottleComponents", parameters: { bottleSku: parameters.bottleSku ?? "" } };
        case "displayComparison":
            return { toolName: "getProductsForComparison", parameters: { graceSkus: parameters.graceSkus ?? [] } };
        case "displayCatalogStrip":
            return { toolName: "getCatalogStrip", parameters: { category: parameters.category ?? null } };
        default:
            return { toolName, parameters };
    }
}

export async function executeGraceServerTool({
    toolName,
    parameters = {},
}: {
    toolName: GraceServerToolName;
    parameters?: Record<string, unknown>;
}): Promise<unknown> {
        if (!toolName) throw new Error("Missing tool_name");

        const normalized = normalizeGraceServerToolCall(toolName, parameters);
        const tool_name = normalized.toolName;
        parameters = normalized.parameters;
        const convex = getConvex();
        const t0 = Date.now();
        let result: unknown;

        switch (tool_name) {
            case "searchCatalog": {
                const resolved = resolveSearchCatalogParameters(parameters);
                const jevEnrichment = await enrichSearchCatalogWithJev({
                    searchTerm: resolved.searchTerm,
                    categoryLimit: resolved.categoryLimit,
                    familyLimit: resolved.familyLimit,
                    applicatorFilter: resolved.applicatorFilter,
                }, {
                    requestText: typeof parameters.customerRequest === "string"
                        ? parameters.customerRequest
                        : resolved.searchTerm,
                    // Jev answers in 110–330 ms on the live logs; 1.5 s bounds the tail
                    // without giving up the enrichment (it was 2.5 s on every search).
                    timeoutMs: 1500,
                    useCaseTable: true,
                });
                const searchParams = {
                    searchTerm: jevEnrichment.args.searchTerm,
                    categoryLimit: jevEnrichment.args.categoryLimit,
                    familyLimit: jevEnrichment.args.familyLimit,
                    applicatorFilter: jevEnrichment.args.applicatorFilter,
                };
                if (jevEnrichment.applied) {
                    console.info("[Grace/Jev] searchCatalog filters", jevEnrichment.decisions, `${jevEnrichment.ms ?? "?"}ms`);
                } else if (jevEnrichment.error && jevEnrichment.error !== "TYPESAFE_API_KEY not set") {
                    console.warn("[Grace/Jev] skipped:", jevEnrichment.error);
                }
                const returnRaw = wantsRawSearchCatalogResult(parameters);
                const refineState = parameters.refineState as GraceRefineState | undefined;
                if (returnRaw && refineState?.filters && refineState.sort && refineState.view) {
                    // setCatalogRefinements verifies a filter combination against
                    // the storefront's own search: the visible catalogue is the
                    // authority for what a Refine change will show.
                    result = await searchCatalogServer({
                        filters: refineState.filters,
                        sort: refineState.sort,
                        view: refineState.view,
                        limit: 24,
                        cursor: null,
                    });
                    break;
                }
                // Grace's own search reads the request the way the customer said
                // it; the active Refine facets (family, size, glass colour, neck,
                // applicator, roller) then constrain the rows. Until 2026-09-25 the
                // whole sentence went through the storefront's every-word search
                // instead, "10 ml roll-on bottle with gold cap" found nothing, and
                // Grace told the customer we do not carry it.
                const runSearch = async (params: typeof searchParams) => {
                    const data = await convex.query(api.grace.searchCatalog, params);
                    const visible = Array.isArray(data) ? data.filter(isCustomerVisibleRow) : data;
                    const facets = Array.isArray(visible) ? applyRefineFacets(visible, refineState?.filters ?? null) : null;
                    const rows = facets && facets.rows.length > 0 ? facets.rows : (Array.isArray(visible) ? visible : []);
                    return { data, visible, facets, rows };
                };
                let effectiveParams = searchParams;
                let search = await runSearch(searchParams);
                let broadenNote: string | null = null;
                // Jev safety net: when the filter Jev added empties the search,
                // run the request once more exactly as the customer wrote it.
                // Jev is right 97% of the time on the 117-case eval; on the rest
                // a wrong applicator or family must not turn into "we don't
                // carry it". The model is told which reading was dropped.
                if (Array.isArray(search.data) && search.rows.length === 0 && jevEnrichment.applied) {
                    const asWritten = {
                        searchTerm: resolved.searchTerm,
                        categoryLimit: resolved.categoryLimit,
                        familyLimit: resolved.familyLimit,
                        applicatorFilter: resolved.applicatorFilter,
                    };
                    const retry = await runSearch(asWritten);
                    if (Array.isArray(retry.data) && retry.rows.length > 0) {
                        console.info("[Grace/Jev] broadened: enriched search found nothing; the request as written found", retry.rows.length, describeJevDecisions(jevEnrichment.decisions));
                        search = retry;
                        effectiveParams = asWritten;
                        broadenNote = `Jev's reading of the request (${describeJevDecisions(jevEnrichment.decisions)}) matched nothing in the catalogue, so these rows answer the request exactly as the customer wrote it. Do not apply that reading again; describe what these rows show.`;
                    }
                }
                const { data, visible, facets, rows } = search;
                const refineNote = facets?.active && Array.isArray(visible) && visible.length > 0
                    ? (facets.rows.length === 0
                        ? `ACTIVE REFINE STATE (${describeRefineFacets(facets.active)}) matches none of these ${visible.length} verified rows; they sit outside the customer's current filters. Say that plainly, offer to broaden that dimension, and do not present them as filtered results.`
                        : facets.excluded > 0
                            ? `Active Refine state (${describeRefineFacets(facets.active)}) kept ${facets.rows.length} of ${visible.length} verified rows; the rest are outside the current filters.`
                            : null)
                    : null;
                if (!Array.isArray(data)) {
                    result = data;
                } else if (rows.length === 0) {
                    if (returnRaw) {
                        result = [];
                        break;
                    }
                    result = noMatchGraceToolResult({
                        message: `No verified exact match found for "${effectiveParams.searchTerm}". Do not name or recommend a specific product from memory. You may try ONE broader or reworded search. If a second search for this same request also returns no match, STOP searching — tell the customer plainly that we do not carry it, name the closest real alternatives you have already seen, and ask one narrowing question. Never issue a third reworded search for the same request.${emptySearchCatalogHint(effectiveParams.searchTerm)}`,
                        requested: {
                            searchTerm: effectiveParams.searchTerm,
                            familyLimit: effectiveParams.familyLimit,
                            applicatorFilter: effectiveParams.applicatorFilter,
                        },
                        suggestedQueries: [
                            effectiveParams.familyLimit ? `${effectiveParams.familyLimit} ${effectiveParams.searchTerm}` : effectiveParams.searchTerm.replace(/\b10\s*ml\b/i, "9ml"),
                            effectiveParams.searchTerm.replace(/\broll[- ]?on\b/i, "roller"),
                        ].filter((q, i, arr) => q.trim() && arr.indexOf(q) === i),
                        warnings: ["Never claim an exact size, SKU, price, stock status, or compatibility unless a tool result returned it."],
                    });
                } else {
                    const slim = rows.map((p) => ({
                        graceSku: p.graceSku,
                        websiteSku: p.websiteSku,
                        itemName: p.itemName,
                        shopifyVariantId: p.shopifyVariantId ?? null,
                        checkoutEligible: isCheckoutEligible(p),
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
                    if (returnRaw) {
                        // showProducts and the reference-image match read these
                        // rows; each carries its own product link and photo too.
                        result = annotateGraceSearchRows(slim, await graceTileImageSources(convex, slim));
                        break;
                    }
                    // The spoken/text model reads the whole tool result before it
                    // can answer; 25 fully described rows run to ~34 KB. Fifteen
                    // rows keep every closure and neck summary while roughly
                    // halving what the model must read per search.
                    const MODEL_ROW_LIMIT = 15;
                    const forModel = slim.length > MODEL_ROW_LIMIT ? slim.slice(0, MODEL_ROW_LIMIT) : slim;
                    const built = buildSearchCatalogToolResult(effectiveParams, forModel);
                    const countNote = slim.length > forModel.length
                        ? `${slim.length} verified rows match; the first ${forModel.length} follow. Ask for a narrower size, family or closure colour to see the rest.`
                        : null;
                    const notes = [broadenNote, refineNote, countNote].filter(Boolean).join("\n");
                    // The model reads `message`; the chat drawer reads `products`
                    // to drop tiles that link to the real product page and show
                    // the group's Sunburst hero or that SKU's own plate. Before
                    // 2026-09-26 the plain search returned bare text, so its
                    // tiles had neither.
                    // ProductCard spells its optional strings as undefined, not null.
                    const cards = slim.map((p) => ({
                        ...p,
                        family: p.family ?? undefined,
                        capacity: p.capacity ?? undefined,
                        color: p.color ?? undefined,
                        slug: p.slug ?? undefined,
                    }));
                    const structured: GraceToolResult = {
                        status: "ok",
                        message: notes ? `${notes}\n\n${built}` : built,
                        products: buildGraceSearchTiles(cards, await graceTileImageSources(convex, cards)),
                    };
                    result = structured;
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
                            checkoutEligible: isCheckoutEligible(d.bottle),
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

            case "getPolicy": {
                result = buildPolicyToolResult(
                    typeof parameters.question === "string" ? parameters.question : "",
                );
                break;
            }

            case "getPriceStats": {
                const family = typeof parameters.family === "string" && parameters.family.trim()
                    ? parameters.family.trim()
                    : undefined;
                result = await convex.query(api.grace.getPriceStats, { family });
                break;
            }

            case "getProductGroup": {
                result = await convex.query(api.products.getProductGroup, {
                    slug: (parameters.slug as string) ?? "",
                });
                break;
            }

            case "getProductBySku": {
                // Exact SKU lookup (audit P0-1) and the `displayProductCard`
                // clientTool source. Resolves by index — Grace SKU then website
                // SKU, case-normalized — because searchCatalog's full-text index
                // does not cover SKU strings.
                const sku = (parameters.graceSku as string)
                    ?? (parameters.websiteSku as string)
                    ?? (parameters.sku as string)
                    ?? "";
                if (!sku) {
                    result = null;
                    break;
                }
                const found = await convex.query(api.products.lookupSku, { sku });
                const data = found?.product ?? null;
                // Inline card renderers call with `graceSku` and expect null on
                // a miss; the agent calls with `sku` and needs guidance text so
                // it does not report a lookup miss as "we don't carry that".
                const isAgentLookup = typeof parameters.sku === "string" && !parameters.graceSku;
                if (!data) {
                    result = isAgentLookup
                        ? {
                            found: false,
                            requestedSku: sku,
                            guidance:
                                `No catalog record matches "${sku}". This is an exact-index lookup, so a miss means the SKU is not in the catalog as written — it may be mistyped, renamed, or a legacy code. Do NOT tell the customer we do not carry the product; offer to search by description or to have the team verify the code.`,
                        }
                        : null;
                } else {
                    result = {
                        found: true,
                        graceSku: data.graceSku,
                        websiteSku: data.websiteSku,
                        itemName: data.itemName,
                        shopifyVariantId: data.shopifyVariantId ?? null,
                        checkoutEligible: isCheckoutEligible(data),
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
                        // Full quantity-break ladder mirrored from bestbottles.com
                        // (minQty / unitPrice / totalPrice). This is the ONLY tool
                        // payload carrying tiers past the second break — quantity
                        // quotes above 12 pcs must come from here, never estimated.
                        priceTiers: data.priceTiers ?? null,
                        stockStatus: data.stockStatus,
                        // PDP slug so Grace can navigate straight to this product.
                        slug: found?.slug ?? null,
                        // Hero image from product group (catalog renders this);
                        // fall back to per-product imageUrl when group hero missing.
                        heroImageUrl: data.imageUrl ?? null,
                        heightWithCap: data.heightWithCap ?? null,
                        heightWithoutCap: data.heightWithoutCap ?? null,
                        diameter: data.diameter ?? null,
                        measurementSource: data.measurementSource ?? null,
                    };
                }
                break;
            }

            case "getProductMeasurements": {
                const sku = String(
                    (parameters.sku as string)
                    ?? (parameters.graceSku as string)
                    ?? (parameters.websiteSku as string)
                    ?? "",
                ).trim();
                if (!sku) {
                    result = { found: false, requestedSku: "", guidance: "A SKU is required for measurements." };
                    break;
                }
                const found = await convex.query(api.products.lookupSku, { sku });
                const data = found?.product ?? null;
                if (!data) {
                    result = {
                        found: false,
                        requestedSku: sku,
                        guidance:
                            `No catalog record matches "${sku}". Do not invent millimeters. Offer to search by description.`,
                    };
                    break;
                }
                result = {
                    found: true,
                    graceSku: data.graceSku,
                    websiteSku: data.websiteSku,
                    itemName: data.itemName,
                    slug: found?.slug ?? null,
                    neckThreadSize: data.neckThreadSize ?? null,
                    heightWithCap: data.heightWithCap ?? null,
                    heightWithoutCap: data.heightWithoutCap ?? null,
                    diameter: data.diameter ?? null,
                    widthMm: data.widthMm ?? null,
                    depthMm: data.depthMm ?? null,
                    bottleWeightG: data.bottleWeightG ?? null,
                    measurementSource: data.measurementSource ?? null,
                };
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
                            checkoutEligible: isCheckoutEligible(p),
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
                            checkoutEligible: isCheckoutEligible(p),
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
                            checkoutEligible: isCheckoutEligible(match),
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
                        checkoutEligible: isCheckoutEligible({
                            shopifySellable: (product as { shopifySellable?: boolean | null }).shopifySellable
                                ?? (variant as { shopifySellable?: boolean | null }).shopifySellable,
                            shopifyVariantId: product.shopifyVariantId ?? variant.shopifyVariantId,
                        }),
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
                        checkoutEligible: isCheckoutEligible(p),
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
