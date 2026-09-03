import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "@/lib/catalogFilters";
import {
    CYLINDER_CATALOG_SURFACE,
    MASTER_CATALOG_SURFACE,
    applyCatalogSurface,
    applicationCatalogSurface,
} from "@/lib/catalogSurface";

describe("catalog surface manifests", () => {
    it("leaves master catalog scope open", () => {
        expect(applyCatalogSurface(
            { ...EMPTY_FILTERS, capacities: ["9 ml"] },
            MASTER_CATALOG_SURFACE,
        ).families).toEqual([]);
    });

    it("makes Cylinder scope immutable without dropping customer constraints", () => {
        expect(applyCatalogSurface({
            ...EMPTY_FILTERS,
            families: ["Boston Round"],
            capacities: ["9 ml"],
            applicators: ["rollon"],
            neckThreadSizes: ["17-415"],
        }, CYLINDER_CATALOG_SURFACE)).toMatchObject({
            families: ["Cylinder"],
            capacities: ["9 ml"],
            applicators: ["rollon"],
            neckThreadSizes: ["17-415"],
        });
    });

    it("opens Capacity by default on Cylinder and exposes only approved facets", () => {
        expect(CYLINDER_CATALOG_SURFACE.visibleFacets).toEqual([
            "capacities",
            "colors",
            "applicators",
            "neckThreadSizes",
        ]);
        expect(CYLINDER_CATALOG_SURFACE.defaultOpenFacets).toEqual(["capacities"]);
    });

    it("scopes application finders to their canonical buckets and exposes roller material only for Roll-On", () => {
        expect(applicationCatalogSurface("rollon")).toMatchObject({
            fixedFilters: { applicators: ["rollon"] },
            visibleFacets: ["capacities", "rollerMaterials", "colors", "neckThreadSizes", "families"],
            defaultSort: "capacity-asc",
        });
        expect(applicationCatalogSurface("spray").visibleFacets).not.toContain("rollerMaterials");
    });

    it("clears stale roller-material constraints on applications that do not expose that facet", () => {
        expect(applyCatalogSurface(
            { ...EMPTY_FILTERS, rollerMaterials: ["metal"] },
            applicationCatalogSurface("spray"),
        )).toMatchObject({
            applicators: ["finemist", "perfumespray"],
            rollerMaterials: [],
        });
    });
});
