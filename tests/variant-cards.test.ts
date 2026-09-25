import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { atomizerVariantCardName, expandVariantCards, withReleasedHeroStages } from "@/lib/products/variant-cards";
import { getCatalogHero, getReleasedCatalogHero } from "@/lib/products/catalog-heroes";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";

const atomizer10 = { _id: "g10", slug: "atomizer-10ml", family: "Atomizer", variantCount: 2, capacityMl: 10 };
const cylinder = { _id: "gc", slug: "cylinder-5ml", family: "Cylinder", variantCount: 2, capacityMl: 5 };
const blu = { websiteSku: "GBAtom10Blu", graceSku: "GB-CYL-BLU-10ML-ATM-BLU", capColor: "Blue", itemName: "Blue atomizer design 10 ml bottle." };
const blk = { websiteSku: "GBAtom10Blk", graceSku: "GB-CYL-BLK-10ML-ATM-BLK-01", capColor: "Black", itemName: "Black atomizer design 10 ml bottle." };

function result() {
    return {
        items: [atomizer10, cylinder],
        totalCount: 2,
        nextCursor: null,
        primarySkus: [{ groupId: "g10", websiteSku: "GBAtom10Blk", graceSku: null }, { groupId: "gc", websiteSku: "C1", graceSku: null }],
        variantPreviewRows: [{ groupId: "g10", variants: [blk, blu] }, { groupId: "gc", variants: [{ websiteSku: "C1" }, { websiteSku: "C2" }] }],
    };
}

describe("expandVariantCards", () => {
    it("gives every Atomizer SKU its own one-variant card and leaves other families grouped", () => {
        const expanded = expandVariantCards(result());
        expect(expanded.items.map((item) => item._id)).toEqual(["g10~GBAtom10Blk", "g10~GBAtom10Blu", "gc"]);
        expect(expanded.items.every((item) => item.family !== "Atomizer" || item.variantCount === 1)).toBe(true);
        expect(expanded.totalCount).toBe(3);
        expect(expanded.variantPreviewRows.find((row) => row.groupId === "g10~GBAtom10Blu")?.variants).toEqual([blu]);
        expect(expanded.primarySkus.find((row) => row.groupId === "g10~GBAtom10Blu")?.websiteSku).toBe("GBAtom10Blu");
        expect(expanded.primarySkus.some((row) => row.groupId === "g10")).toBe(false);
        expect(expanded.items.find((item) => item._id === "g10~GBAtom10Blu")?.slug).toBe("atomizer-10ml");
    });

    it("returns the same object when nothing needs expanding", () => {
        const plain = { ...result(), items: [cylinder] };
        expect(expandVariantCards(plain)).toBe(plain);
    });
});

describe("atomizerVariantCardName", () => {
    it.each([
        [10, blu, "10 ml Blue Atomizer"],
        [5, { websiteSku: "GBAtom5SlStars", capColor: "Silver", itemName: "Silver atomizer design 5 ml bottle with star patterns." }, "5 ml Silver Atomizer with Stars"],
        [5, { websiteSku: "GBAtom5SlDot", capColor: "Silver", itemName: "Silver atomizer and sprayer with dots" }, "5 ml Silver Atomizer with Dots"],
        [5, { websiteSku: "GBAtom5PnkDot", capColor: "Pink", itemName: "Pink atomizer design 5 ml bottle with dots." }, "5 ml Pink Atomizer with Dots"],
        [5, { websiteSku: "GBAtom5SlimBlk", capColor: "Black", itemName: "Black slim atomizer design 5 ml bottle." }, "5 ml Black Slim Atomizer"],
        [10, { websiteSku: "GBAtom10Lv", capColor: "Lavender", itemName: "Lavender atomizer design 10 ml bottle." }, "10 ml Lavender Atomizer"],
    ])("%i ml %o", (ml, variant, expected) => {
        expect(atomizerVariantCardName(ml, variant)).toBe(expected);
    });

    it("gives up without a shell finish", () => {
        expect(atomizerVariantCardName(10, { websiteSku: "X" })).toBeNull();
    });
});

describe("customer-facing names", () => {
    it("never doubles the family word", () => {
        const name = getCustomerFacingProductName({
            group: { displayName: "10 ml Atomizer Bottle", family: "Atomizer", capacity: "10 ml (0.34 oz)", capacityMl: 10, color: null, slug: "atomizer-10ml" },
            fallbackName: "10 ml Atomizer Bottle",
        }).displayName;
        expect(name).not.toMatch(/Atomizer Atomizer/i);
    });
});

describe("released Atomizer heroes on the card and the PDP", () => {
    const previous = process.env.NEXT_PUBLIC_CATALOG_HERO_PILOT;
    beforeEach(() => { process.env.NEXT_PUBLIC_CATALOG_HERO_PILOT = "families-2026-09-22"; });
    afterEach(() => { process.env.NEXT_PUBLIC_CATALOG_HERO_PILOT = previous; });

    it("finds the Slim heroes from production's leftover atomizer-5ml-slim group", () => {
        for (const sku of ["GBAtom5SlimBlk", "GBAtom5SlimGl", "GBAtom5SlimSl"]) {
            expect(getCatalogHero("atomizer-5ml-slim", [{ websiteSku: sku }])?.websiteSku).toBe(sku);
            expect(getReleasedCatalogHero("atomizer-5ml-slim", sku)?.url).toContain(`/${sku}.`);
        }
    });

    it("stages the selected SKU's released hero on the PDP and keeps plates elsewhere", () => {
        const plates: Record<string, { image: string; imageCapOff: string | null; thumb?: string; heroStage?: boolean }> = {
            "GB-CYL-BLU-10ML-ATM-BLU": { image: "/plates/blu.webp", imageCapOff: "/plates/blu-off.webp", thumb: "/plates/blu-t.webp" },
            NoHero: { image: "/plates/other.webp", imageCapOff: null },
        };
        const staged = withReleasedHeroStages(atomizer10, [blu, { websiteSku: "NoHero" }], plates);
        expect(staged["GB-CYL-BLU-10ML-ATM-BLU"].image).toContain("/GBAtom10Blu.");
        expect(staged["GB-CYL-BLU-10ML-ATM-BLU"].imageCapOff).toBeNull();
        expect(staged["GB-CYL-BLU-10ML-ATM-BLU"].heroStage).toBe(true);
        expect(staged["GB-CYL-BLU-10ML-ATM-BLU"].thumb).toBe("/plates/blu-t.webp");
        expect(staged.GBAtom10Blu.image).toContain("/GBAtom10Blu.");
        expect(staged.NoHero).toBe(plates.NoHero);
        expect("heroStage" in staged.NoHero).toBe(false);
    });

    it("leaves other families' plates untouched", () => {
        const plates = { C1: { image: "/plates/c1.webp", imageCapOff: null } };
        expect(withReleasedHeroStages(cylinder, [{ websiteSku: "C1" }], plates)).toBe(plates);
    });

    it("never stages a hero when the release flag is off", () => {
        process.env.NEXT_PUBLIC_CATALOG_HERO_PILOT = "";
        const plates = { GBAtom10Blu: { image: "/plates/blu.webp", imageCapOff: null } };
        expect(withReleasedHeroStages(atomizer10, [blu], plates)).toBe(plates);
    });
});
