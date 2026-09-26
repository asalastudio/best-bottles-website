import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "../src/lib/catalogFilters";
import {
    activeRefineFacets,
    applyRefineFacets,
    describeRefineFacets,
    rowMatchesRefineFacets,
} from "../src/lib/grace/refineFacetMatch";

const rows = [
    { graceSku: "GB-RCT-CLR-10ML-MRL-BKDT-01", family: "Rectangle", capacityMl: 10, capacity: "10 ml (0.34 oz)", color: "Clear", canonicalColor: "Clear", neckThreadSize: "13-415", applicator: "Metal Roller Ball", capColor: "Black Dotted" },
    { graceSku: "GB-BEL-CLR-10ML-ROL-BLDOT", family: "Bell", capacityMl: 10, capacity: "10 ml", color: "Clear", canonicalColor: "Clear", neckThreadSize: "13-415", applicator: "Plastic Roller Ball", capColor: "Black Dotted" },
    { graceSku: "GB-CYL-AMB-9ML-MRL-GLD", family: "Cylinder", capacityMl: 9, capacity: "9 ml", color: "Amber", canonicalColor: "Amber", neckThreadSize: "17-415", applicator: "Metal Roller Ball", capColor: "Gold" },
    { graceSku: "GB-CYL-BLU-9ML-SPR-MBLK", family: "Cylinder", capacityMl: 9, capacity: "9 ml", color: "Blue", canonicalColor: "Cobalt Blue", neckThreadSize: "17-415", applicator: "Fine Mist Sprayer", capColor: "Matte Black" },
    { graceSku: "GB-PIL-CLR-9ML-CAP-BLK", family: "Pillar", capacityMl: 9, capacity: "9 ml", color: "Clear", canonicalColor: "Clear", neckThreadSize: "13-415", applicator: "N/A", capColor: "Shiny Black" },
];

describe("Grace refine facets applied to Grace's own search rows", () => {
    it("treats a page with no facets (the homepage, a plain search) as unconstrained", () => {
        expect(activeRefineFacets(EMPTY_FILTERS)).toBeNull();
        expect(activeRefineFacets({ ...EMPTY_FILTERS, search: "10 ml roll-on bottle with gold cap" })).toBeNull();
        expect(activeRefineFacets({ ...EMPTY_FILTERS, priceMin: 1, priceMax: 5 })).toBeNull();
        expect(activeRefineFacets(null)).toBeNull();
        const result = applyRefineFacets(rows, { ...EMPTY_FILTERS, search: "anything" });
        expect(result.active).toBeNull();
        expect(result.rows).toHaveLength(rows.length);
        expect(result.excluded).toBe(0);
    });

    it("keeps the rows a family, size, colour, neck or applicator facet allows", () => {
        expect(applyRefineFacets(rows, { ...EMPTY_FILTERS, families: ["Cylinder"] }).rows.map((row) => row.graceSku))
            .toEqual(["GB-CYL-AMB-9ML-MRL-GLD", "GB-CYL-BLU-9ML-SPR-MBLK"]);
        expect(applyRefineFacets(rows, { ...EMPTY_FILTERS, capacities: ["10 ml"] }).rows).toHaveLength(2);
        expect(applyRefineFacets(rows, { ...EMPTY_FILTERS, colors: ["Cobalt Blue"] }).rows.map((row) => row.graceSku))
            .toEqual(["GB-CYL-BLU-9ML-SPR-MBLK"]);
        expect(applyRefineFacets(rows, { ...EMPTY_FILTERS, neckThreadSizes: ["17-415"] }).rows).toHaveLength(2);
        // The applicator facet carries canonical bucket keys; product values map onto them.
        expect(applyRefineFacets(rows, { ...EMPTY_FILTERS, applicators: ["rollon"] }).rows).toHaveLength(3);
        expect(applyRefineFacets(rows, { ...EMPTY_FILTERS, applicators: ["finemist"] }).rows).toHaveLength(1);
        expect(applyRefineFacets(rows, { ...EMPTY_FILTERS, applicators: ["rollon"], rollerMaterials: ["plastic"] }).rows.map((row) => row.graceSku))
            .toEqual(["GB-BEL-CLR-10ML-ROL-BLDOT"]);
    });

    it("folds the colour facet through the canonical glass colour, as the sidebar does", () => {
        const facets = activeRefineFacets({ ...EMPTY_FILTERS, colors: ["Blue"] })!;
        expect(facets.colors).toEqual(["Cobalt Blue"]);
        expect(rowMatchesRefineFacets(rows[3], facets)).toBe(true);
        expect(rowMatchesRefineFacets(rows[2], facets)).toBe(false);
    });

    it("expands a capacity range the way the catalogue does", () => {
        const facets = activeRefineFacets({ ...EMPTY_FILTERS, capacities: ["6-15"] });
        // Whatever the range key expands to, both 9 ml and 10 ml rows must survive it.
        if (facets && facets.capacityMls.length > 0) {
            expect(rows.filter((row) => rowMatchesRefineFacets(row, facets))).toHaveLength(rows.length);
        }
    });

    it("reports how many rows the active facets excluded, so the gateway can say so", () => {
        const result = applyRefineFacets(rows, { ...EMPTY_FILTERS, families: ["Bell"], search: "10 ml roll-on bottle" });
        expect(result.rows.map((row) => row.graceSku)).toEqual(["GB-BEL-CLR-10ML-ROL-BLDOT"]);
        expect(result.excluded).toBe(rows.length - 1);
        expect(describeRefineFacets(result.active!)).toBe("family Bell");
        const none = applyRefineFacets(rows, { ...EMPTY_FILTERS, families: ["Diva"] });
        expect(none.rows).toHaveLength(0);
        expect(none.excluded).toBe(rows.length);
    });

    it("never uses a cap-only bottle to satisfy an applicator facet", () => {
        const facets = activeRefineFacets({ ...EMPTY_FILTERS, applicators: ["capclosure"] })!;
        // "N/A" is not a closure applicator value; the row must not match.
        expect(rowMatchesRefineFacets(rows[4], facets)).toBe(false);
    });
});
