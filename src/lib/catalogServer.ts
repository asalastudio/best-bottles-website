import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import {
    buildCatalogSearchResult,
    type CatalogSearchResultShape,
    type CatalogSearchGroup,
} from "@/lib/catalogSearchFallback";
import {
    EMPTY_FILTERS,
    expandCapacityFilterValues,
    normalizeRollerMaterials,
    SORT_OPTIONS,
    VIEW_MODES,
    type CatalogFilters,
    type SortValue,
    type ViewMode,
} from "@/lib/catalogFilters";
import { getLegacyProductRouteOverride } from "@/lib/products/legacy-product-route-overrides";
import { isVisibleCatalogGroup, isMissingHeroSource } from "@/lib/products/catalog-listing-visibility";

export type CatalogSearchArgs = {
    filters: Partial<CatalogFilters>;
    sort: SortValue;
    view: ViewMode;
    limit: number;
    cursor?: string | null;
};

let convexClient: ConvexHttpClient | null = null;

export function getCatalogConvexClient() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is required to render catalog data.");
    convexClient ??= new ConvexHttpClient(url);
    return convexClient;
}

export function sanitizeCatalogResult(result: CatalogSearchResultShape): CatalogSearchResultShape {
    const items = result.items.filter((group) => !getLegacyProductRouteOverride(group.slug) && isVisibleCatalogGroup(group, result.variantPreviewRows.find(row => row.groupId === group._id)?.variants));


    const visibleIds = new Set(items.map((group) => group._id));
    return {
        ...result,
        items,
        // Facets describe the complete filtered catalog, not the current page.
        // Rebuilding them from `items` collapses Refine to the first 24 cards.
        facets: result.facets,
        totalCount: Math.max(0, result.totalCount - (result.items.length - items.length)),
        primarySkus: items.map(group => {
            const primary = result.primarySkus.find(row => row.groupId === group._id && !isMissingHeroSource(row));
            const variant = result.variantPreviewRows.find(row => row.groupId === group._id)?.variants.find(row => !isMissingHeroSource(row));
            return primary ?? { groupId: group._id, websiteSku: variant?.websiteSku ?? null, graceSku: variant?.graceSku ?? null };
        }),
        variantPreviewRows: result.variantPreviewRows.filter((row) => visibleIds.has(row.groupId)).map(row => ({ ...row, variants: row.variants.filter(variant => !isMissingHeroSource(variant)) })),
    };
}

async function withCatalogMediaPreviewRows(
    convex: ConvexHttpClient,
    result: CatalogSearchResultShape,
): Promise<CatalogSearchResultShape> {
    const groupIds = result.items.map((group) => group._id);
    if (groupIds.length === 0) return result;

    const hasPreviewRows = Array.isArray(result.variantPreviewRows) && result.variantPreviewRows.length >= groupIds.length;
    const hasPrimarySkus = Array.isArray(result.primarySkus) && result.primarySkus.length >= groupIds.length;

    if (hasPreviewRows && hasPrimarySkus) return result;

    const [primarySkus, variantPreviewRows] = await Promise.all([
        hasPrimarySkus
            ? Promise.resolve(result.primarySkus)
            : convex.query(api.products.getCatalogGroupPrimarySkus, {}),
        hasPreviewRows
            ? Promise.resolve(result.variantPreviewRows)
            : convex.query(api.products.getCatalogGroupVariantPreviewData, { groupIds }),
    ]);

    const visibleIds = new Set(groupIds);

    return {
        ...result,
        primarySkus: (primarySkus as CatalogSearchResultShape["primarySkus"]).filter((row) => visibleIds.has(row.groupId)),
        variantPreviewRows: (variantPreviewRows as CatalogSearchResultShape["variantPreviewRows"]).filter((row) => visibleIds.has(row.groupId)),
    };
}

type CatalogVisibilitySnapshot = {
    groups: CatalogSearchGroup[];
    primarySkus: CatalogSearchResultShape["primarySkus"];
    variantPreviewRows: CatalogSearchResultShape["variantPreviewRows"];
};
let visibilitySnapshot: { expiresAt: number; promise: Promise<CatalogVisibilitySnapshot> } | null = null;

// The backend paginates before the storefront's source holds. Read lightweight
// global metadata so counts and facets include holds outside the current page.
async function getCatalogVisibilitySnapshot(convex: ConvexHttpClient): Promise<CatalogVisibilitySnapshot> {
    if (visibilitySnapshot && visibilitySnapshot.expiresAt > Date.now()) return visibilitySnapshot.promise;
    const promise = (async () => {
        const [groups, primarySkus] = await Promise.all([
            convex.query(api.products.getAllCatalogGroups, {}),
            convex.query(api.products.getCatalogGroupPrimarySkus, {}),
        ]);
        const affectedIds = groups.filter(group => group.slug === "lotion-bottle-30ml-clear"
            || primarySkus.some(row => row.groupId === group._id && isMissingHeroSource(row))).map(group => group._id);
        const variantPreviewRows = affectedIds.length ? await convex.query(api.products.getCatalogGroupVariantPreviewData, { groupIds: affectedIds }) : [];
        return { groups, primarySkus, variantPreviewRows } as CatalogVisibilitySnapshot;
    })();
    visibilitySnapshot = { expiresAt: Date.now() + 30_000, promise };
    try { return await promise; } catch (error) {
        if (visibilitySnapshot?.promise === promise) visibilitySnapshot = null;
        throw error;
    }
}

export function applyVisibleCatalogSummary(
    result: CatalogSearchResultShape,
    snapshot: CatalogVisibilitySnapshot,
    args: CatalogSearchArgs & { filters: CatalogFilters },
): CatalogSearchResultShape {
    const summary = buildCatalogSearchResult({ ...snapshot, ...args, limit: 1, cursor: null });
    return { ...result, totalCount: summary.totalCount, facets: summary.facets };
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function normalizeCatalogSearchArgs(args: CatalogSearchArgs): CatalogSearchArgs & { filters: CatalogFilters } {
    const filters = args.filters ?? {};
    const validSort = SORT_OPTIONS.some((option) => option.value === args.sort) ? args.sort : "featured";
    const validView = VIEW_MODES.includes(args.view) ? args.view : "visual";
    return {
        filters: {
            ...EMPTY_FILTERS,
            ...filters,
            search: typeof filters.search === "string" ? filters.search : EMPTY_FILTERS.search,
            category: typeof filters.category === "string" ? filters.category : null,
            collection: typeof filters.collection === "string" ? filters.collection : null,
            applicators: asStringArray(filters.applicators) as CatalogFilters["applicators"],
            rollerMaterials: normalizeRollerMaterials(asStringArray(filters.rollerMaterials)),
            families: asStringArray(filters.families),
            colors: asStringArray(filters.colors),
            capacities: asStringArray(filters.capacities),
            neckThreadSizes: asStringArray(filters.neckThreadSizes),
            componentType: typeof filters.componentType === "string" ? filters.componentType : null,
            priceMin: typeof filters.priceMin === "number" && Number.isFinite(filters.priceMin) ? filters.priceMin : null,
            priceMax: typeof filters.priceMax === "number" && Number.isFinite(filters.priceMax) ? filters.priceMax : null,
        },
        sort: validSort,
        view: validView,
        limit: Number.isFinite(args.limit) ? args.limit : 48,
        cursor: typeof args.cursor === "string" ? args.cursor : null,
    };
}

export async function searchCatalogServer(args: CatalogSearchArgs): Promise<CatalogSearchResultShape> {
    const normalizedArgs = normalizeCatalogSearchArgs(args);
    const convex = getCatalogConvexClient();
    const convexArgs = {
        ...normalizedArgs,
        filters: {
            ...normalizedArgs.filters,
            capacities: expandCapacityFilterValues(normalizedArgs.filters.capacities),
        },
    };
    try {
        const result = await convex.query(api.products.searchCatalog, convexArgs) as CatalogSearchResultShape;
        const [enriched, snapshot] = await Promise.all([withCatalogMediaPreviewRows(convex, result), getCatalogVisibilitySnapshot(convex)]);
        return applyVisibleCatalogSummary(sanitizeCatalogResult(enriched), snapshot, normalizedArgs);
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (!message.includes("products:searchCatalog")) throw error;
    }

    const snapshot = await getCatalogVisibilitySnapshot(convex);
    const preliminary = buildCatalogSearchResult({ ...snapshot, ...normalizedArgs });
    const rows = await convex.query(api.products.getCatalogGroupVariantPreviewData, {
        groupIds: preliminary.items.map(group => group._id),
    });
    return buildCatalogSearchResult({ ...snapshot, ...normalizedArgs,
        variantPreviewRows: [...snapshot.variantPreviewRows.filter(row => !rows.some(next => next.groupId === row.groupId)), ...rows],
    });
}
