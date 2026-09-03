import { describe, expect, it } from "vitest";
import { paramsToFilters } from "@/lib/catalogFilters";
import { CYLINDER_CATALOG_SURFACE } from "@/lib/catalogSurface";
import { buildCatalogSearchArgs } from "@/lib/catalogSearchClient";
import { buildFocusedProductHref } from "@/components/catalog/FocusedProductCard";
import { buildCylinderApplicationOptions } from "@/lib/products/cylinder-family-page";

describe("Cylinder authoritative catalog query", () => {
    it("keeps the approved 9 ml 17-415 roll-on constraints exact", () => {
        const { filters } = paramsToFilters(new URLSearchParams(
            "families=Cylinder&capacities=9+ml&applicators=rollon&threads=17-415",
        ));
        expect(buildCatalogSearchArgs({
            surface: CYLINDER_CATALOG_SURFACE,
            filters,
            sort: "capacity-asc",
            view: "visual",
            limit: 240,
        }).filters).toMatchObject({
            families: ["Cylinder"],
            capacities: ["9 ml"],
            applicators: ["rollon"],
            neckThreadSizes: ["17-415"],
        });
    });

    it("derives the application switcher from authoritative Cylinder facets", () => {
        expect(buildCylinderApplicationOptions({
            rollon: 5,
            finemist: 2,
            perfumespray: 1,
            lotionpump: 0,
            dropper: 0,
            reducer: 0,
        }).map(({ value, count }) => [value, count])).toEqual([
            ["rollon", 5],
            ["spray", 3],
        ]);
    });

    it("links exact cards to stable PDPs with a safe Cylinder return route", () => {
        expect(buildFocusedProductHref(
            "/products/cylinder-9ml-rollon",
            "/catalog/cylinder?applicators=rollon&capacities=9+ml",
        )).toBe(
            "/products/cylinder-9ml-rollon?from=%2Fcatalog%2Fcylinder%3Fapplicators%3Drollon%26capacities%3D9%2Bml",
        );
        expect(buildFocusedProductHref(
            "/products/cylinder-9ml-rollon",
            "https://malicious.example/catalog/cylinder",
        )).toBe("/products/cylinder-9ml-rollon");
    });
});
