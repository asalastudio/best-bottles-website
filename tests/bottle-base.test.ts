import { describe, expect, it } from "vitest";
import { toBottleBases, findConfiguration, type SkuRow } from "../src/lib/matrix/bottleBase";

const row = (o: Partial<SkuRow>): SkuRow => ({
    family: "Circle", capacity: "50 ml (1.69 oz)", capacityMl: 50,
    color: "Clear", neckThreadSize: "18-415", stockStatus: "In Stock", ...o,
});

describe("BottleBase normalization", () => {
    it("collapses one bottle's many SKUs into a single configurable row", () => {
        const bases = toBottleBases([
            row({ graceSku: "A", applicator: "Lotion Pump", capColor: "Shiny Gold", webPrice1pc: 2.6 }),
            row({ graceSku: "B", applicator: "Lotion Pump", capColor: "Matte Gold", webPrice1pc: 2.6 }),
            row({ graceSku: "C", applicator: "Dropper", capColor: "Silver", webPrice1pc: 1.75 }),
        ]);
        expect(bases).toHaveLength(1);
        expect(bases[0].skuCount).toBe(3);
        expect(bases[0].closureTypes.map((g) => g.type)).toEqual(["Dropper", "Lotion Pump"]);
    });

    it("prices the row from the CHEAPEST configuration, not the first", () => {
        const [base] = toBottleBases([
            row({ graceSku: "A", applicator: "Vintage Bulb Sprayer", capColor: "Black", webPrice1pc: 6.2 }),
            row({ graceSku: "B", applicator: "Reducer", capColor: "Shiny Silver", webPrice1pc: 1.57 }),
        ]);
        expect(base.fromPrice).toBe(1.57);
    });

    it("keeps different glass apart even in the same family and size", () => {
        const bases = toBottleBases([
            row({ graceSku: "A", color: "Clear", applicator: "Cap", capColor: "Gold" }),
            row({ graceSku: "B", color: "Frosted", applicator: "Cap", capColor: "Gold" }),
        ]);
        expect(bases).toHaveLength(2);
    });

    /* The ambiguity that makes a name-based resolver unsafe. Both of these are
       real orderable SKUs recording capColor "Clear"; their names say Red and
       Matte Silver. Neither may be silently preferred. */
    it("never collapses two real SKUs into one option", () => {
        const [base] = toBottleBases([
            row({ graceSku: "GB-CIR-CLR-50ML-ASP-01", applicator: "Vintage Bulb Sprayer", capStyle: "Spray", capColor: "Clear", webPrice1pc: 6.2 }),
            row({ graceSku: "GB-CIR-CLR-50ML-ASP-02", applicator: "Vintage Bulb Sprayer", capStyle: "Spray", capColor: "Clear", webPrice1pc: 6.2 }),
        ]);
        const opts = base.closureTypes[0].options;
        expect(opts).toHaveLength(2);
        expect(new Set(opts.map((o) => o.label)).size).toBe(2);   // labels distinct
        expect(opts.every((o) => o.disambiguated)).toBe(true);    // and flagged
    });

    it("widens a colliding label by style when style distinguishes them", () => {
        const [base] = toBottleBases([
            row({ graceSku: "X", applicator: "Reducer", capStyle: "Faux Leather", capColor: "Shiny Black", webPrice1pc: 1.85 }),
            row({ graceSku: "Y", applicator: "Reducer", capStyle: "Screw Cap", capColor: "Shiny Black", webPrice1pc: 1.57 }),
        ]);
        const labels = base.closureTypes[0].options.map((o) => o.label).sort();
        expect(labels).toEqual(["Shiny Black · Faux Leather", "Shiny Black · Screw Cap"]);
    });

    /* The real Reducer group: three SKUs named "Matte Silver", two of them
       sharing a style. One widening pass leaves the two Screw Caps identical. */
    it("keeps widening until every label in a group is unique", () => {
        const [base] = toBottleBases([
            row({ graceSku: "MSLV",    applicator: "Reducer", capStyle: "Screw Cap", capColor: "Matte Silver", webPrice1pc: 1.57 }),
            row({ graceSku: "MSLV-01", applicator: "Reducer", capStyle: "Screw Cap", capColor: "Matte Silver", webPrice1pc: 1.57 }),
            row({ graceSku: "MSLV-T",  applicator: "Reducer", capStyle: "Tall",      capColor: "Matte Silver", webPrice1pc: 1.57 }),
        ]);
        const labels = base.closureTypes[0].options.map((o) => o.label);
        expect(new Set(labels).size).toBe(3);
        expect(labels).toContain("Matte Silver · Tall");
        expect(labels.filter((l) => l.includes("MSLV")).length).toBe(2);
    });

    it("drops rows with no orderable SKU rather than offering them", () => {
        const [base] = toBottleBases([
            row({ graceSku: "A", applicator: "Cap", capColor: "Gold", webPrice1pc: 1 }),
            row({ graceSku: null, applicator: "Cap", capColor: "Ghost", webPrice1pc: 1 }),
        ]);
        expect(base.skuCount).toBe(1);
    });

    it("resolves a chosen option back to its exact SKU", () => {
        const [base] = toBottleBases([
            row({ graceSku: "GB-A", applicator: "Cap", capColor: "Gold", webPrice1pc: 1.2 }),
            row({ graceSku: "GB-B", applicator: "Cap", capColor: "Silver", webPrice1pc: 1.3 }),
        ]);
        expect(findConfiguration(base, "GB-B")?.price1).toBe(1.3);
        expect(findConfiguration(base, "NOPE")).toBeNull();
    });

    it("marks a bottle out of stock only when every configuration is", () => {
        const [base] = toBottleBases([
            row({ graceSku: "A", applicator: "Cap", capColor: "Gold", stockStatus: "Out of Stock" }),
            row({ graceSku: "B", applicator: "Cap", capColor: "Silver", stockStatus: "In Stock" }),
        ]);
        expect(base.anyInStock).toBe(true);
    });
});
