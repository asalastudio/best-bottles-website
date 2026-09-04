import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, type CatalogFilters } from "@/lib/catalogFilters";
import {
    buildAppliedFilterChips,
    removeCatalogFilterChip,
    toggleCatalogFacetValue,
} from "@/lib/catalogRefineModel";

describe("canonical Refine view model", () => {
    const filters: CatalogFilters = {
        ...EMPTY_FILTERS,
        families: ["Cylinder"],
        capacities: ["9 ml"],
        applicators: ["rollon"],
        neckThreadSizes: ["17-415"],
    };

    it("uses customer-facing labels without changing URL identity", () => {
        expect(buildAppliedFilterChips(filters)).toEqual(expect.arrayContaining([
            { facet: "families", value: "Cylinder", label: "Family: Cylinder" },
            { facet: "capacities", value: "9 ml", label: "Capacity: 9 ml (0.3 oz)" },
            { facet: "applicators", value: "rollon", label: "Applicator: Roll-On" },
            { facet: "neckThreadSizes", value: "17-415", label: "Neck: 17-415" },
        ]));
    });

    it("removes only the requested constraint", () => {
        expect(removeCatalogFilterChip(filters, {
            facet: "neckThreadSizes",
            value: "17-415",
            label: "Neck: 17-415",
        })).toMatchObject({
            capacities: ["9 ml"],
            applicators: ["rollon"],
            neckThreadSizes: [],
        });
    });

    it("toggles array facets without mutating the input", () => {
        const next = toggleCatalogFacetValue(filters, "colors", "Amber");
        expect(next.colors).toEqual(["Amber"]);
        expect(filters.colors).toEqual([]);
        expect(toggleCatalogFacetValue(next, "colors", "Amber").colors).toEqual([]);
    });

    it("labels mega-menu capacity range tokens as customer-facing ranges", () => {
        expect(buildAppliedFilterChips({
            ...EMPTY_FILTERS,
            capacities: ["miniature"],
        })).toEqual([
            { facet: "capacities", value: "miniature", label: "Capacity: Miniature — 1-5 ml" },
        ]);
    });
});
