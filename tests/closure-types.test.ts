import { describe, expect, it } from "vitest";
import { toClosureType, closureRank } from "../src/lib/products/closureTypes";

describe("closure vocabulary", () => {
    it("merges the two names for one sprayer", () => {
        expect(toClosureType("Perfume Spray Pump").label).toBe("Fine Mist Sprayer");
        expect(toClosureType("Fine Mist Sprayer").label).toBe("Fine Mist Sprayer");
    });

    it("does NOT collapse bulb sprayers into fine mist", () => {
        expect(toClosureType("Vintage Bulb Sprayer").label).toBe("Vintage Bulb Sprayer");
        expect(toClosureType("Vintage Bulb Sprayer with Tassel").icon).toBe("Antique Bulb Sprayer");
        // the generic component family stays generic — it covers bulbs too
        expect(toClosureType("Sprayer").label).toBe("Sprayer");
    });

    it("normalises the catalogue's cap spellings", () => {
        expect(toClosureType("Cap/Closure").label).toBe("Cap");
        expect(toClosureType("Cap/Component").label).toBe("Cap");
    });

    it("picks the right icon for rollers", () => {
        expect(toClosureType("Metal Roller Ball").icon).toBe("Metal Roller");
        expect(toClosureType("Plastic Roller Ball").icon).toBe("Plastic Roller");
    });

    /* 99 SKUs record no applicator; 83 name a closure in their item name.
       Missing must never render as "no closure". */
    it("infers a closure when applicator is blank, and flags it", () => {
        const fromStyle = toClosureType(null, { capStyle: "Short" });
        expect(fromStyle.label).toBe("Short Cap");
        expect(fromStyle.inferred).toBe(true);

        const fromName = toClosureType("N/A", {
            itemName: "Boston round design 15ml Clear glass bottle with a black dropper.",
        });
        expect(fromName.icon).toBe("Dropper");
        expect(fromName.inferred).toBe(true);
    });

    it("never returns an empty or 'none' label", () => {
        for (const raw of [null, "", "N/A", "none", "—", "?"]) {
            const t = toClosureType(raw);
            expect(t.label.length).toBeGreaterThan(0);
            expect(t.label.toLowerCase()).not.toMatch(/^(none|n\/a|null)$/);
        }
    });

    it("orders plain closures before decorated ones", () => {
        expect(closureRank("Cap")).toBeLessThan(closureRank("Vintage Bulb Sprayer"));
        expect(closureRank("Fine Mist Sprayer")).toBeLessThan(closureRank("Vintage Bulb Sprayer with Tassel"));
    });
});
