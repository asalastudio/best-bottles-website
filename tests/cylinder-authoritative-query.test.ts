import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { paramsToFilters } from "@/lib/catalogFilters";
import { CYLINDER_CATALOG_SURFACE } from "@/lib/catalogSurface";
import { buildCatalogSearchArgs } from "@/lib/catalogSearchClient";

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

    it("does not call the retired local card evaluator", () => {
        const source = readFileSync(
            join(process.cwd(), "src/app/catalog/cylinder/CylinderFamilyPageClient.tsx"),
            "utf8",
        );
        expect(source).not.toContain("filterCylinderFamilyCards");
        expect(source).toContain("fetchCatalogSearch");
        expect(source).toContain("activeCatalog.facets");
    });

    it("keeps builder media on the unfiltered family catalog", () => {
        const source = readFileSync(
            join(process.cwd(), "src/app/catalog/cylinder/CylinderFamilyPageClient.tsx"),
            "utf8",
        );
        expect(source).toContain("BuilderPreview catalog={baseCatalog}");
        expect(source).toContain("ReadyMadeCard key={group._id} group={group} catalog={activeCatalog}");
    });
});
