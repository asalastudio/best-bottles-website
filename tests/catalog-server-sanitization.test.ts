import { describe, expect, it } from "vitest";
import {
    sanitizeCatalogResult,
} from "../src/lib/catalogServer";
import type { CatalogSearchResultShape } from "../src/lib/catalogSearchFallback";
import { buildCatalogSearchResult } from "../src/lib/catalogSearchFallback";
import { EMPTY_FILTERS } from "../src/lib/catalogFilters";

function resultFixture(): CatalogSearchResultShape {
    return {
        items: [
            {
                _id: "alias",
                slug: "cylinder-9ml-clear",
                displayName: "Legacy Cylinder alias",
                family: "Cylinder",
                capacity: "9 ml (0.3 oz)",
                capacityMl: 9,
                color: "Clear",
                category: "Glass Bottle",
                bottleCollection: null,
                neckThreadSize: "17-415",
                variantCount: 1,
                priceRangeMin: 1,
                priceRangeMax: 1,
                applicatorTypes: ["Metal Roller Ball"],
            },
            {
                _id: "canonical",
                slug: "cylinder-9ml-clear-17-415-rollon",
                displayName: "9 ml Clear Cylinder Roll-On Bottle",
                family: "Cylinder",
                capacity: "9 ml (0.3 oz)",
                capacityMl: 9,
                color: "Clear",
                category: "Glass Bottle",
                bottleCollection: null,
                neckThreadSize: "17-415",
                variantCount: 20,
                priceRangeMin: 1,
                priceRangeMax: 2,
                applicatorTypes: ["Metal Roller Ball"],
            },
        ],
        facets: {
            categories: { "Glass Bottle": 300, Component: 67 },
            collections: { Bottles: 300 },
            applicators: { rollon: 30, finemist: 80, lotionpump: 20 },
            families: { Cylinder: 22, Elegant: 20, "Boston Round": 18 },
            colors: { Clear: 180, Amber: 70, "Cobalt Blue": 30 },
            capacities: {
                "3 ml": { label: "3 ml", ml: 3, count: 2 },
                "9 ml": { label: "9 ml", ml: 9, count: 20 },
                "100 ml": { label: "100 ml", ml: 100, count: 40 },
                "250 ml": { label: "250 ml", ml: 250, count: 12 },
            },
            neckThreadSizes: { "13-415": 30, "17-415": 25, "24-410": 40 },
            componentTypes: { Sprayer: 25, Cap: 40 },
            priceRange: { min: 0.2, max: 15 },
        },
        totalCount: 367,
        nextCursor: "24",
        primarySkus: [
            { groupId: "alias", websiteSku: "OLD", graceSku: "OLD" },
            { groupId: "canonical", websiteSku: "GOOD", graceSku: "GOOD" },
        ],
        variantPreviewRows: [
            { groupId: "alias", variants: [] },
            { groupId: "canonical", variants: [] },
        ],
    };
}

describe("catalog result canonicalization", () => {
    it("includes -finemist product groups in the canonical fine-mist filter", () => {
        const fixture = resultFixture();
        const sprayGroup = {
            ...fixture.items[1],
            _id: "fine-mist",
            slug: "cylinder-9ml-clear-17-415-finemist",
            displayName: "9 ml Clear Cylinder Fine Mist Bottle",
            applicatorTypes: ["Fine Mist Sprayer"],
        };
        const result = buildCatalogSearchResult({
            groups: [sprayGroup],
            primarySkus: [],
            variantPreviewRows: [],
            filters: { ...EMPTY_FILTERS, applicators: ["finemist"] },
            sort: "featured",
            view: "visual",
            limit: 24,
            cursor: null,
        });

        expect(result.totalCount).toBe(1);
        expect(result.items[0]?.slug).toBe("cylinder-9ml-clear-17-415-finemist");
    });

    it("removes legacy route aliases without collapsing global facets to the current page", () => {
        const result = sanitizeCatalogResult(resultFixture());

        expect(result.items.map((item) => item.slug)).toEqual([
            "cylinder-9ml-clear-17-415-rollon",
        ]);
        expect(result.totalCount).toBe(366);
        expect(result.primarySkus).toHaveLength(1);
        expect(result.variantPreviewRows).toHaveLength(1);
        expect(Object.keys(result.facets.families)).toEqual([
            "Cylinder",
            "Elegant",
            "Boston Round",
        ]);
        expect(Object.keys(result.facets.capacities)).toEqual([
            "3 ml",
            "9 ml",
            "100 ml",
            "250 ml",
        ]);
    });
});
