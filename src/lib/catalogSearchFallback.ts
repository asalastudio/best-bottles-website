import {
    APPLICATOR_BUCKETS,
    BOTTLE_CATEGORIES,
    COMPONENT_CATEGORIES,
    FAMILY_ORDER,
    type CatalogFilters,
    type RollerMaterial,
    type SortValue,
    type ViewMode,
    applicatorBucketMatchesProductValues,
    rollerMaterialMatchesProductValues,
    canonicalGlassColor,
    catalogSearchMatches,
    catalogSearchResultTieBreak,
    catalogSearchScore,
    classifyComponentType,
    parseCapacityLabelMl,
} from "@/lib/catalogFilters";
import { getLegacyProductRouteOverride } from "@/lib/products/legacy-product-route-overrides";

// This file mirrors convex/products.ts::searchCatalog for the no-backend
// fallback. Vocabulary and semantics come from catalogFilters so the two
// cannot drift; tests/catalog-vocabulary-alignment.test.ts guards it.

export interface CatalogSearchGroup {
    _id: string;
    slug: string;
    displayName: string;
    family: string | null;
    capacity: string | null;
    capacityMl: number | null;
    color: string | null;
    category: string;
    bottleCollection: string | null;
    neckThreadSize: string | null;
    variantCount: number;
    priceRangeMin: number | null;
    priceRangeMax: number | null;
    heroImageUrl?: string | null;
    paperDollFamilyKey?: string | null;
    applicatorTypes?: string[] | null;
}

export interface CatalogSearchPrimarySku {
    groupId: string;
    websiteSku: string | null;
    graceSku: string | null;
}

export interface CatalogSearchVariantPreviewRow {
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
        stockStatus: string | null;
        caseQuantity: number | null;
        webPrice1pc: number | null;
        shopifyVariantId: string | null;
        shopifySellable: boolean | null;
    }>;
}

export interface CatalogSearchResultShape {
    items: CatalogSearchGroup[];
    facets: {
        categories: Record<string, number>;
        collections: Record<string, number>;
        applicators: Record<string, number>;
        rollerMaterials: Record<RollerMaterial, number>;
        families: Record<string, number>;
        colors: Record<string, number>;
        capacities: Record<string, { label: string; ml: number | null; count: number }>;
        neckThreadSizes: Record<string, number>;
        componentTypes: Record<string, number>;
        priceRange: { min: number; max: number };
    };
    totalCount: number;
    nextCursor: string | null;
    primarySkus: CatalogSearchPrimarySku[];
    variantPreviewRows: CatalogSearchVariantPreviewRow[];
}

function countBy<T>(items: T[], keyFn: (item: T) => string | null | undefined): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const item of items) {
        const key = keyFn(item);
        if (key) counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
}


export function buildCatalogSearchResult(input: {
    groups: CatalogSearchGroup[];
    primarySkus: CatalogSearchPrimarySku[];
    variantPreviewRows: CatalogSearchVariantPreviewRow[];
    filters: CatalogFilters;
    sort: SortValue;
    view: ViewMode;
    limit: number;
    cursor?: string | null;
}): CatalogSearchResultShape {
    const groups = input.groups.filter((group) => !getLegacyProductRouteOverride(group.slug));
    const skuMap = new Map(input.primarySkus.map((row) => [row.groupId, row.websiteSku ?? row.graceSku ?? ""]));
    const filters = input.filters;
    const matchesApplicatorBucket = (group: CatalogSearchGroup, bucket: string) => {
        return applicatorBucketMatchesProductValues(bucket as never, group.applicatorTypes ?? []);
    };
    const runFilters = (skipKeys = new Set<keyof CatalogFilters>()) => {
        let rows = [...groups];
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
                skuMap.get(group._id),
            ]));
        }
        if (!skipKeys.has("category") && filters.category) rows = rows.filter((group) => group.category === filters.category);
        if (!skipKeys.has("collection") && filters.collection) rows = rows.filter((group) => group.bottleCollection === filters.collection);
        if (!skipKeys.has("applicators") && filters.applicators.length > 0) {
            rows = rows.filter((group) => filters.applicators.some((bucket) => matchesApplicatorBucket(group, bucket)));
        }
        if (!skipKeys.has("rollerMaterials") && filters.rollerMaterials.length > 0) {
            rows = rows.filter((group) => filters.rollerMaterials.some((material) => rollerMaterialMatchesProductValues(material, group.applicatorTypes ?? [])));
        }
        if (!skipKeys.has("families") && filters.families.length > 0) {
            const set = new Set(filters.families);
            rows = rows.filter((group) => group.family != null && set.has(group.family));
        }
        if (!skipKeys.has("colors") && filters.colors.length > 0) {
            const set = new Set(filters.colors.map((color) => canonicalGlassColor(color)));
            rows = rows.filter((group) => set.has(canonicalGlassColor(group.color)));
        }
        if (!skipKeys.has("capacities") && filters.capacities.length > 0) {
            const selectedMls = new Set(filters.capacities.map(parseCapacityLabelMl).filter((value): value is number => value != null));
            rows = rows.filter((group) => group.capacityMl != null && selectedMls.has(group.capacityMl));
        }
        if (!skipKeys.has("neckThreadSizes") && filters.neckThreadSizes.length > 0) {
            const set = new Set(filters.neckThreadSizes);
            rows = rows.filter((group) => group.neckThreadSize != null && set.has(group.neckThreadSize));
        }
        if (filters.componentType) rows = rows.filter((group) => classifyComponentType(group.displayName, group.family) === filters.componentType);
        if (filters.priceMin !== null) {
            rows = rows.filter((group) => {
                const top = group.priceRangeMax ?? group.priceRangeMin;
                return top !== null && top >= filters.priceMin!;
            });
        }
        if (filters.priceMax !== null) rows = rows.filter((group) => group.priceRangeMin !== null && group.priceRangeMin <= filters.priceMax!);
        return rows;
    };

    const result = runFilters();
    const applicatorFacetBase = runFilters(new Set(["applicators"]));
    const rollerMaterialFacetBase = runFilters(new Set(["rollerMaterials"]));
    const familyFacetBase = runFilters(new Set(["families"]));
    const colorFacetBase = runFilters(new Set(["colors"]));
    const capacityFacetBase = runFilters(new Set(["capacities"]));
    const threadFacetBase = runFilters(new Set(["neckThreadSizes"]));
    const applicators: Record<string, number> = {};
    for (const bucket of APPLICATOR_BUCKETS) {
        const count = applicatorFacetBase.filter((group) => matchesApplicatorBucket(group, bucket.value)).length;
        if (count > 0 || filters.applicators.includes(bucket.value)) applicators[bucket.value] = count;
    }
    const capacities: Record<string, { label: string; ml: number | null; count: number }> = {};
    for (const group of capacityFacetBase) {
        if (group.capacityMl != null && group.capacityMl > 0) {
            const label = `${group.capacityMl} ml`;
            capacities[label] ??= { label, ml: group.capacityMl, count: 0 };
            capacities[label].count++;
        }
    }
    const rollerMaterials = {
        metal: rollerMaterialFacetBase.filter((group) => rollerMaterialMatchesProductValues("metal", group.applicatorTypes ?? [])).length,
        plastic: rollerMaterialFacetBase.filter((group) => rollerMaterialMatchesProductValues("plastic", group.applicatorTypes ?? [])).length,
    } satisfies Record<RollerMaterial, number>;
    const categoryFacetBase = runFilters(new Set(["category", "collection"]));
    const priceFloors = result.map((group) => group.priceRangeMin).filter((value): value is number => value != null);
    const priceCeilings = result.map((group) => group.priceRangeMax ?? group.priceRangeMin).filter((value): value is number => value != null);
    const facets = {
        categories: countBy(categoryFacetBase, (group) => group.category),
        collections: countBy(categoryFacetBase, (group) => group.bottleCollection),
        applicators,
        rollerMaterials,
        families: countBy(familyFacetBase.filter((group) => !COMPONENT_CATEGORIES.has(group.category)), (group) => group.family),
        colors: countBy(colorFacetBase, (group) => canonicalGlassColor(group.color)),
        capacities,
        neckThreadSizes: countBy(threadFacetBase, (group) => group.neckThreadSize),
        componentTypes: countBy(result, (group) => classifyComponentType(group.displayName, group.family)),
        priceRange: priceFloors.length > 0
            ? { min: Math.min(...priceFloors), max: Math.max(...priceCeilings, ...priceFloors) }
            : { min: 0, max: 0 },
    };
    const sorted = [...result];
    if (input.sort === "best-match" && filters.search) {
        const score = (group: CatalogSearchGroup) => catalogSearchScore(filters.search, [
            { value: group.displayName, weight: 5 },
            { value: skuMap.get(group._id), weight: 5 },
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
        sorted.sort((a, b) => score(b) - score(a) || catalogSearchResultTieBreak(a, b));
    } else if (input.sort === "price-asc") sorted.sort((a, b) => (a.priceRangeMin ?? Infinity) - (b.priceRangeMin ?? Infinity));
    else if (input.sort === "price-desc") sorted.sort((a, b) => (b.priceRangeMin ?? -Infinity) - (a.priceRangeMin ?? -Infinity));
    else if (input.sort === "name-asc") sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
    else if (input.sort === "name-desc") sorted.sort((a, b) => b.displayName.localeCompare(a.displayName));
    else if (input.sort === "variants-desc") sorted.sort((a, b) => (b.variantCount ?? 0) - (a.variantCount ?? 0));
    else if (input.sort === "capacity-asc") sorted.sort((a, b) => (a.capacityMl ?? Infinity) - (b.capacityMl ?? Infinity));
    else if (input.sort === "capacity-desc") sorted.sort((a, b) => (b.capacityMl ?? -Infinity) - (a.capacityMl ?? -Infinity));
    else {
        const familyIdx = (family: string | null) => {
            if (!family) return FAMILY_ORDER.length;
            const index = FAMILY_ORDER.indexOf(family);
            return index >= 0 ? index : FAMILY_ORDER.length;
        };
        sorted.sort((a, b) => {
            const categoryDelta = (BOTTLE_CATEGORIES.has(a.category) ? 0 : 1) - (BOTTLE_CATEGORIES.has(b.category) ? 0 : 1);
            if (categoryDelta !== 0) return categoryDelta;
            const familyDelta = familyIdx(a.family) - familyIdx(b.family);
            if (familyDelta !== 0) return familyDelta;
            return (a.capacityMl ?? 99999) - (b.capacityMl ?? 99999);
        });
    }
    const offset = Math.max(0, Number(input.cursor ?? 0) || 0);
    const limit = Math.min(Math.max(input.limit, 1), 240);
    const items = sorted.slice(offset, offset + limit);
    const visibleIds = new Set(items.map((group) => group._id));
    return {
        items,
        facets,
        totalCount: sorted.length,
        nextCursor: offset + items.length < sorted.length ? String(offset + items.length) : null,
        primarySkus: input.primarySkus.filter((row) => visibleIds.has(row.groupId)),
        variantPreviewRows: input.variantPreviewRows.filter((row) => visibleIds.has(row.groupId)),
    };
}
