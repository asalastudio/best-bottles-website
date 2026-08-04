import {
    EMPTY_FILTERS,
    type CatalogFacetKey,
    type CatalogFilters,
    type SortValue,
} from "@/lib/catalogFilters";

export type CatalogSurfaceManifest = {
    id: "master" | "cylinder";
    fixedFilters: Partial<CatalogFilters>;
    visibleFacets: CatalogFacetKey[];
    defaultOpenFacets: CatalogFacetKey[];
    defaultSort: SortValue;
    resultLabel: string;
};

export const MASTER_CATALOG_SURFACE: CatalogSurfaceManifest = {
    id: "master",
    fixedFilters: {},
    visibleFacets: [
        "applicators",
        "families",
        "capacities",
        "colors",
        "category",
        "collection",
        "componentType",
        "neckThreadSizes",
        "price",
    ],
    defaultOpenFacets: ["applicators", "families", "capacities"],
    defaultSort: "featured",
    resultLabel: "products",
};

export const CYLINDER_CATALOG_SURFACE: CatalogSurfaceManifest = {
    id: "cylinder",
    fixedFilters: { families: ["Cylinder"] },
    visibleFacets: ["capacities", "colors", "applicators", "neckThreadSizes"],
    defaultOpenFacets: ["capacities"],
    defaultSort: "capacity-asc",
    resultLabel: "Cylinder groups",
};

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
