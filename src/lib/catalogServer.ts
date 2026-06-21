import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import {
    buildCatalogSearchResult,
    type CatalogSearchResultShape,
} from "@/lib/catalogSearchFallback";
import {
    APPLICATOR_BUCKETS,
    EMPTY_FILTERS,
    SORT_OPTIONS,
    VIEW_MODES,
    applicatorBucketMatchesProductValues,
    classifyComponentType,
    type CatalogFilters,
    type SortValue,
    type ViewMode,
} from "@/lib/catalogFilters";
import { getLegacyProductRouteOverride } from "@/lib/products/legacy-product-route-overrides";

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

function countBy<T>(items: T[], keyFn: (item: T) => string | null | undefined): Record<string, number> {
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

function recomputeVisibleFacets(items: CatalogSearchResultShape["items"]): CatalogSearchResultShape["facets"] {
    const capacities: CatalogSearchResultShape["facets"]["capacities"] = {};
    const applicators: Record<string, number> = {};
    for (const item of items) {
        if (!item.capacity) continue;
        const current = capacities[item.capacity] ?? {
            label: item.capacity,
            ml: item.capacityMl ?? parseCapacityMl(item.capacity),
            count: 0,
        };
        current.count += 1;
        capacities[item.capacity] = current;
    }

    for (const item of items) {
        for (const bucket of APPLICATOR_BUCKETS) {
            if (!applicatorBucketMatchesProductValues(bucket.value, item.applicatorTypes ?? [])) continue;
            applicators[bucket.value] = (applicators[bucket.value] ?? 0) + 1;
        }
    }

    const prices = items
        .flatMap((item) => [item.priceRangeMin, item.priceRangeMax])
        .filter((price): price is number => typeof price === "number" && Number.isFinite(price));

    return {
        categories: countBy(items, (item) => item.category),
        collections: countBy(items, (item) => item.bottleCollection),
        applicators,
        families: countBy(items, (item) => item.family),
        colors: countBy(items, (item) => item.color),
        capacities,
        neckThreadSizes: countBy(items, (item) => item.neckThreadSize),
        componentTypes: countBy(items, (item) => classifyComponentType(item.category, item.displayName)),
        priceRange: {
            min: prices.length ? Math.min(...prices) : 0,
            max: prices.length ? Math.max(...prices) : 0,
        },
    };
}

function sanitizeCatalogResult(result: CatalogSearchResultShape): CatalogSearchResultShape {
    const items = result.items.filter((group) => !getLegacyProductRouteOverride(group.slug));
    if (items.length === result.items.length) return result;

    const visibleIds = new Set(items.map((group) => group._id));
    return {
        ...result,
        items,
        facets: recomputeVisibleFacets(items),
        totalCount: Math.max(0, result.totalCount - (result.items.length - items.length)),
        primarySkus: result.primarySkus.filter((row) => visibleIds.has(row.groupId)),
        variantPreviewRows: result.variantPreviewRows.filter((row) => visibleIds.has(row.groupId)),
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
    try {
        const result = await convex.query(api.products.searchCatalog, normalizedArgs) as CatalogSearchResultShape;
        return sanitizeCatalogResult(await withCatalogMediaPreviewRows(convex, result));
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (!message.includes("products:searchCatalog")) throw error;
    }

    const [groups, primarySkus] = await Promise.all([
        convex.query(api.products.getAllCatalogGroups, {}),
        convex.query(api.products.getCatalogGroupPrimarySkus, {}),
    ]);
    const preliminary = buildCatalogSearchResult({
        groups: groups as never,
        primarySkus: primarySkus as never,
        variantPreviewRows: [],
        ...normalizedArgs,
    });
    const variantPreviewRows = await convex.query(api.products.getCatalogGroupVariantPreviewData, {
        groupIds: preliminary.items.map((group) => group._id),
    });
    return sanitizeCatalogResult(buildCatalogSearchResult({
        groups: groups as never,
        primarySkus: primarySkus as never,
        variantPreviewRows: variantPreviewRows as never,
        ...normalizedArgs,
    }));
}
