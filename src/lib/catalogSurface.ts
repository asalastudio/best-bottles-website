import {
    APPLICATOR_NAV,
    type ApplicatorNavValue,
    EMPTY_FILTERS,
    type CatalogFacetKey,
    type CatalogFilters,
    type SortValue,
} from "@/lib/catalogFilters";

export type CatalogSurfaceManifest = {
    id: "master" | "cylinder" | "family" | "application";
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
    /** Per-facet exceptions to `truncateAfter`. */
    truncateAfterByFacet?: Partial<Record<CatalogFacetKey, number>>;
    defaultSort: SortValue;
    resultLabel: string;
};

/**
 * Master catalogue sidebar (design 8a, 2026-09-25), in the order a packaging
 * buyer narrows a bottle: family, capacity, applicator, neck finish, glass,
 * then the merchandising collection and price. Product type (category) is the
 * switch in the title row, not a sidebar facet.
 */
export const MASTER_CATALOG_SURFACE: CatalogSurfaceManifest = {
    id: "master",
    fixedFilters: {},
    visibleFacets: [
        "families",
        "capacities",
        "applicators",
        "neckThreadSizes",
        "colors",
        "shopCollection",
        "price",
    ],
    defaultOpenFacets: ["families", "capacities", "applicators", "neckThreadSizes", "colors"],
    mobileDefaultOpenFacets: ["families", "capacities"],
    truncateAfter: 6,
    truncateAfterByFacet: { families: 8 },
    defaultSort: "capacity-asc",
    resultLabel: "products",
};

export function familyCatalogSurface(family: string): CatalogSurfaceManifest {
    return {
        id: family === "Cylinder" ? "cylinder" : "family",
        fixedFilters: { families: [family] },
        visibleFacets: ["capacities", "colors", "applicators", "neckThreadSizes"],
        defaultOpenFacets: ["capacities"],
        mobileDefaultOpenFacets: ["capacities"],
        truncateAfter: 8,
        defaultSort: "capacity-asc",
        resultLabel: `${family} groups`,
    };
}

export const CYLINDER_CATALOG_SURFACE: CatalogSurfaceManifest = familyCatalogSurface("Cylinder");

export function applicationCatalogSurface(application: ApplicatorNavValue): CatalogSurfaceManifest {
    const nav = APPLICATOR_NAV.find((candidate) => candidate.value === application);
    if (!nav) throw new Error(`Unknown application surface: ${application}`);
    const isRollOn = application === "rollon";
    return {
        id: "application",
        fixedFilters: {
            applicators: [...nav.buckets],
            ...(isRollOn ? {} : { rollerMaterials: [] }),
        },
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
