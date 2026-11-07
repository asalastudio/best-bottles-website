import { describe, expect, it } from "vitest";
import { bottleFormatAfterFamily } from "../convex/bottleDisplayName";
import { collapseRepeatedWords, getCustomerFacingProductName } from "@/lib/products/customer-facing-names";

// 2026-11-07: nine groups were stored as "… Lotion/Aluminum/Plastic Bottle Bottle with Cap".
describe("bottle names never repeat a word", () => {
    it("drops the format's leading Bottle when the family already ends in Bottle", () => {
        const name = (family: string, format: string) => ["30 ml", "Clear", family, bottleFormatAfterFamily(family, format)].filter(Boolean).join(" ");
        expect(name("Lotion Bottle", "Bottle with Cap")).toBe("30 ml Clear Lotion Bottle with Cap");
        expect(name("Aluminum Bottle", "Bottle with Cap")).toBe("30 ml Clear Aluminum Bottle with Cap");
        expect(name("Plastic Bottle", "Bottle")).toBe("30 ml Clear Plastic Bottle");
        // Other families and formats are unchanged.
        expect(name("Cylinder", "Bottle with Cap")).toBe("30 ml Clear Cylinder Bottle with Cap");
        expect(name("Lotion Bottle", "Lotion Pump Bottle")).toBe("30 ml Clear Lotion Bottle Lotion Pump Bottle");
        expect(bottleFormatAfterFamily(null, "Bottle with Cap")).toBe("Bottle with Cap");
    });

    it("collapses an adjacent repeated word, whatever its case, and nothing else", () => {
        expect(collapseRepeatedWords("30 ml Clear Lotion Bottle Bottle with Cap")).toBe("30 ml Clear Lotion Bottle with Cap");
        expect(collapseRepeatedWords("10 ml Atomizer atomizer Bottle")).toBe("10 ml Atomizer Bottle");
        expect(collapseRepeatedWords("Black Cap - Black")).toBe("Black Cap - Black");
        expect(collapseRepeatedWords("9 ml Clear Cylinder Roll-On Bottle")).toBe("9 ml Clear Cylinder Roll-On Bottle");
    });

    it("never renders a stored doubled group name on a card or page", () => {
        for (const stored of ["3 ml Clear Lotion Bottle Bottle with Cap", "120 ml Aluminum Bottle Bottle with Cap", "10 ml Plastic Bottle Bottle with Cap"]) {
            const name = getCustomerFacingProductName({ group: { displayName: stored }, fallbackName: stored });
            expect(name.displayName).not.toMatch(/\bBottle Bottle\b/i);
            expect(name.displayName).toBe(stored.replace("Bottle Bottle", "Bottle"));
        }
        const card = getCustomerFacingProductName({
            group: { displayName: "30 ml Clear Lotion Bottle Bottle with Cap", family: "Lotion Bottle", capacity: "30 ml (1.01 oz)", color: "Clear", category: "Glass Bottle" },
            variant: { websiteSku: "LB1ozSl", graceSku: "LB-LTB-CLR-30ML-SLV-T", itemName: "Clear Glass Lotion Bottle with Silver Top and Base.Capacity:1oz(30ml)", capColor: "Silver" },
            fallbackName: "30 ml Clear Lotion Bottle Bottle with Cap",
        });
        expect(card.displayName).not.toMatch(/\bBottle Bottle\b/i);
    });
});
