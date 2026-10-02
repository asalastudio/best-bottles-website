import { describe, expect, it } from "vitest";
import { buildCatalogSearchResult, type CatalogSearchGroup } from "@/lib/catalogSearchFallback";
import { applyGraceRefinementRequest, getGraceRefineState, graceRefineDestination } from "@/lib/grace/refineState";

const request = "Please open the catalogue filtered to Elegant family, 15 ml, clear glass, roll-on applicator and 13-415 neck. Tell me the number of matching bottle product cards, distinguishing cards from cap variants. Keep my cart unchanged.";
// Captured from a fresh production typed conversation. Roll-On Bottle was an
// extra model-proposed category; the matching group's stored category is Glass Bottle.
const proposal = {
    category: "Roll-On Bottle", applicators: ["rollon"] as const,
    families: ["Elegant"], colors: ["Clear"], capacities: ["15 ml"], neckThreadSizes: ["13-415"],
};
const group: CatalogSearchGroup = {
    _id: "elegant", slug: "elegant-15ml-clear-13-415-rollon", displayName: "15 ml Clear Elegant Roll-On Bottle",
    family: "Elegant", capacity: "15 ml", capacityMl: 15, color: "Clear", category: "Glass Bottle",
    bottleCollection: null, neckThreadSize: "13-415", variantCount: 18, priceRangeMin: 0.76, priceRangeMax: 1,
    applicatorTypes: ["Metal Roller Ball", "Plastic Roller Ball"],
};
const refine = (query = "", extra = {}) => applyGraceRefinementRequest(
    getGraceRefineState(new URLSearchParams(query)), { ...proposal, applicators: ["rollon"], ...extra }, request,
);

describe("Grace typed roll-on refinement category", () => {
    it("verifies one catalogue card and constructs its five-filter destination from the captured proposal", () => {
        const next = refine();
        const result = buildCatalogSearchResult({
            ...next, limit: 24, cursor: null, primarySkus: [], variantPreviewRows: [],
            groups: [group, { ...group, _id: "spray", slug: "elegant-15ml-clear-13-415-finemist", applicatorTypes: ["Fine Mist Sprayer"] }],
        });
        expect(result.totalCount).toBe(1);
        expect(result.items.map(item => item.slug)).toEqual([group.slug]);
        expect(result.items[0].variantCount).toBe(18); // variants are not bottle-card count
        expect(graceRefineDestination(next)).toBe("/catalog?applicators=rollon&families=Elegant&colors=Clear&capacities=15+ml&threads=13-415&sort=capacity-asc");
    });

    it("also translates a category-only roll-on proposal into the applicator facet", () => {
        const next = applyGraceRefinementRequest(getGraceRefineState(new URLSearchParams()), { category: "Roll-On Bottle" }, "Show roll-on bottles");
        expect(next.filters.category).toBeNull();
        expect(next.filters.applicators).toEqual(["rollon"]);
    });

    it("preserves a shopper's existing category and metal/Specialty constraints", () => {
        const next = refine("category=Plastic+Bottle&roller=metal&threads=specialty");
        expect(next.filters.category).toBe("Plastic Bottle");
        expect(next.filters.rollerMaterials).toEqual(["metal"]);
        expect(next.filters.neckThreadSizes).toEqual(["specialty"]);
    });

    it("does not remove an existing explicit Roll-On Bottle category", () => {
        expect(refine("category=Roll-On+Bottle").filters.category).toBe("Roll-On Bottle");
    });

    it("does not broaden conflicting applicator criteria", () => {
        const next = refine("", { applicators: ["finemist"] });
        expect(next.filters.category).toBe("Roll-On Bottle");
        expect(next.filters.applicators).toEqual(["finemist"]);
    });
});

import { graceCatalogLookupRefineState } from "@/lib/grace/refineState";

describe("explicitly independent catalogue questions", () => {
    const active = () => getGraceRefineState(new URLSearchParams("applicators=rollon&capacities=6-15ml&colors=Clear&roller=metal&threads=13-415"));
    it.each([
        ["Independent product question: do you have a 3.3 ml glass spray bottle?", "3.3 ml glass spray bottle", "Glass Bottle"],
        ["Independent stock question: are 3x12 bags available?", "3x12 bags", "Packaging"],
    ])("uses the actual customer turn when the model omits its qualifier: %s", (request, search, category) => {
        const current = active();
        const before = structuredClone(current);
        const next = graceCatalogLookupRefineState(current, { search, category }, search, request);
        expect(next.filters).toMatchObject({ category, search, applicators: [], capacities: [], colors: [], rollerMaterials: [], neckThreadSizes: [] });
        expect(current).toEqual(before); // read-only lookup does not clear the visible catalogue
    });
    it.each(["Make it Amber", "What about a spray option?", "This is not an independent question"])('keeps active criteria for "%s"', request => {
        const current = active();
        const next = graceCatalogLookupRefineState(current, { search: "Amber bottle" }, "Amber bottle", request);
        expect(next.filters).toMatchObject({ applicators: ["rollon"], capacities: ["6-15ml"], colors: ["Clear"], rollerMaterials: ["metal"], neckThreadSizes: ["13-415"] });
    });
});
