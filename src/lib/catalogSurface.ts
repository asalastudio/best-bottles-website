import {
    APPLICATOR_NAV,
    type ApplicatorNavValue,
    EMPTY_FILTERS,
    type CatalogFacetKey,
    type CatalogFilters,
    type SortValue,
} from "@/lib/catalogFilters";

export type CatalogSurfaceManifest = {
    id: "master" | "cylinder" | "application";
    fixedFilters: Partial<CatalogFilters>;
    /**
     * Sidebar order. This IS the render order on the master catalogue — the
     * sidebar maps over it, so reordering here reorders the UI and tests.
     */
    visibleFacets: CatalogFacetKey[];
    /** Facets expanded on first paint (desktop). A facet with an active value is always expanded. */
    defaultOpenFacets: CatalogFacetKey[];
    /** Facets expanded on first paint inside the mobile drawer — fewer, so the sheet stays scannable. */
    mobileDefaultOpenFacets: CatalogFacetKey[];
    /** Facet values shown before "Show more" (Baymard: truncate long lists, never hide them in a scroll box). */
    truncateAfter: number;
    defaultSort: SortValue;
    resultLabel: string;
};

/**
 * Master catalogue hierarchy, ordered the way a packaging buyer narrows a
 * list (Baymard product-list research, 2025): scope first (what kind of
 * product), then the category-specific attributes that decide fit (dispensing
 * type, capacity, neck finish), then look (glass colour), then price and the
 * aesthetic line. Component Type only appears once a component category is
 * chosen, so it sits last.
 */
export const MASTER_CATALOG_SURFACE: CatalogSurfaceManifest = {
    id: "master",
    fixedFilters: {},
    visibleFacets: [
        "category",
        "collection",
        "applicators",
        "capacities",
        "neckThreadSizes",
        "colors",
        "price",
        "families",
        "componentType",
    ],
    defaultOpenFacets: ["category", "applicators", "capacities", "neckThreadSizes", "colors"],
    mobileDefaultOpenFacets: ["applicators", "capacities"],
    truncateAfter: 8,
    defaultSort: "featured",
    resultLabel: "products",
};

export const CYLINDER_CATALOG_SURFACE: CatalogSurfaceManifest = {
    id: "cylinder",
    fixedFilters: { families: ["Cylinder"] },
    visibleFacets: ["capacities", "colors", "applicators", "neckThreadSizes"],
    defaultOpenFacets: ["capacities"],
    mobileDefaultOpenFacets: ["capacities"],
    truncateAfter: 8,
    defaultSort: "capacity-asc",
    resultLabel: "Cylinder groups",
};

export function applicationCatalogSurface(application: ApplicatorNavValue): CatalogSurfaceManifest {
    const nav = APPLICATOR_NAV.find((candidate) => candidate.value === application);
    if (!nav) throw new Error(`Unknown application surface: ${application}`);
    const isRollOn = application === "rollon";
    return {
        id: "application",
        fixedFilters: { applicators: [...nav.buckets] },
        visibleFacets: [
            "capacities",
            ...(isRollOn ? ["rollerMaterials" as const] : []),
            "colors",
            "neckThreadSizes",
            "families",
        ],
        defaultOpenFacets: ["capacities"],
        mobileDefaultOpenFacets: ["capacities"],
        truncateAfter: 8,
        defaultSort: "capacity-asc",
        resultLabel: `${nav.label} groups`,
    };
}

export function applyCatalogSurface(
    filters: Partial<CatalogFilters>,
    surface: CatalogSurfaceManifest,
): CatalogFilters {
    return {
        ...EMPTY_FILTERS,
        ...filters,
        ...surface.fixedFilters,
    };
}
