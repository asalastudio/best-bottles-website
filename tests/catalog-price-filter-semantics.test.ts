import { describe, expect, it } from "vitest";
import { buildCatalogSearchResult, type CatalogSearchGroup } from "../src/lib/catalogSearchFallback";
import { EMPTY_FILTERS } from "../src/lib/catalogFilters";

function group(overrides: Partial<CatalogSearchGroup> & { _id: string }): CatalogSearchGroup {
    return {
        slug: overrides._id,
        displayName: overrides._id,
        family: "Cylinder",
        capacity: "9 ml",
        capacityMl: 9,
        color: "Clear",
        category: "Glass Bottle",
        bottleCollection: "Cylinder",
        neckThreadSize: "17-415",
        variantCount: 3,
        priceRangeMin: 1,
        priceRangeMax: 1,
        applicatorTypes: ["Cap/Closure"],
        ...overrides,
    } as CatalogSearchGroup;
}

const run = (groups: CatalogSearchGroup[], filters: Partial<typeof EMPTY_FILTERS>) =>
    buildCatalogSearchResult({
        groups,
        primarySkus: [],
        variantPreviewRows: [],
        filters: { ...EMPTY_FILTERS, ...filters },
        sort: "featured",
        view: "visual",
        limit: 50,
    });

describe("price window semantics", () => {
    const spanning = group({ _id: "wide", priceRangeMin: 2, priceRangeMax: 40 });
    const cheap = group({ _id: "cheap", priceRangeMin: 0.5, priceRangeMax: 0.9 });
    const dear = group({ _id: "dear", priceRangeMin: 12, priceRangeMax: 25 });

    it("a group matches when ANY variant sits inside the window", () => {
        const result = run([spanning, cheap, dear], { priceMin: 10, priceMax: 15 });
        expect(result.items.map((item) => item._id).sort()).toEqual(["dear", "wide"]);
    });

    it("a floor alone keeps groups whose top price clears it", () => {
        const result = run([spanning, cheap, dear], { priceMin: 30 });
        expect(result.items.map((item) => item._id)).toEqual(["wide"]);
    });

    it("a ceiling alone keeps groups whose cheapest variant is under it", () => {
        const result = run([spanning, cheap, dear], { priceMax: 1 });
        expect(result.items.map((item) => item._id)).toEqual(["cheap"]);
    });

    it("the slider bounds span the real catalogue range, not just the cheapest variants", () => {
        const result = run([spanning, cheap, dear], {});
        expect(result.facets.priceRange).toEqual({ min: 0.5, max: 40 });
    });
});

describe("colour and category facets", () => {
    const blue = group({ _id: "raw-blue", color: "Blue" });
    const cobalt = group({ _id: "cobalt", color: "Cobalt Blue" });
    const amber = group({ _id: "amber", color: "Amber" });
    const cap = group({ _id: "cap", category: "Cap/Closure", family: "Cap/Closure" });

    it("raw 'Blue' rows are counted and matched under the canonical 'Cobalt Blue'", () => {
        const facets = run([blue, cobalt, amber], {}).facets;
        expect(facets.colors).toEqual({ "Cobalt Blue": 2, Amber: 1 });
        const filtered = run([blue, cobalt, amber], { colors: ["Cobalt Blue"] });
        expect(filtered.items.map((item) => item._id).sort()).toEqual(["cobalt", "raw-blue"]);
    });

    it("category counts are drill-down aware so sibling scopes stay visible", () => {
        const facets = run([blue, cobalt, amber, cap], { category: "Cap/Closure" }).facets;
        expect(facets.categories).toEqual({ "Glass Bottle": 3, "Cap/Closure": 1 });
    });

    it("Cap/Closure groups are reachable through the capclosure bucket", () => {
        const result = run([blue, cap], { applicators: ["capclosure"] });
        expect(result.items.map((item) => item._id).sort()).toEqual(["cap", "raw-blue"]);
    });
});
