import { describe, expect, it } from "vitest";
import { CYLINDER_CATALOG_SURFACE } from "@/lib/catalogSurface";
import { buildCatalogSearchArgs } from "@/lib/catalogSearchClient";

describe("buildCatalogSearchArgs", () => {
    it("produces one canonical API shape for family UI and Grace state", () => {
        expect(buildCatalogSearchArgs({
            surface: CYLINDER_CATALOG_SURFACE,
            filters: {
                capacities: ["9 ml"],
                applicators: ["rollon"],
                rollerMaterials: ["metal"],
                neckThreadSizes: ["17-415"],
            },
            sort: "capacity-asc",
            view: "visual",
            limit: 240,
        })).toMatchObject({
            filters: {
                families: ["Cylinder"],
                capacities: ["9 ml"],
                applicators: ["rollon"],
                rollerMaterials: ["metal"],
                neckThreadSizes: ["17-415"],
            },
            sort: "capacity-asc",
            view: "visual",
            limit: 240,
            cursor: null,
        });
    });

    it("uses manifest defaults when optional request values are omitted", () => {
        expect(buildCatalogSearchArgs({
            surface: CYLINDER_CATALOG_SURFACE,
            filters: {},
        })).toMatchObject({
            sort: "capacity-asc",
            view: "visual",
            limit: 48,
            cursor: null,
        });
    });
});
