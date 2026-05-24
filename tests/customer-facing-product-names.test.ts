import { describe, expect, it } from "vitest";
import { getCustomerFacingProductName } from "../src/lib/products/customer-facing-names";

const divaGroup = {
    displayName: "46 ml Clear Diva Bottle",
    family: "Diva",
    capacity: "46 ml (1.56 oz)",
    capacityMl: 46,
    color: "Clear",
    category: "Glass Bottle",
};

describe("customer-facing product names", () => {
    it("names Diva perfume spray finishes from variant evidence", () => {
        expect(
            getCustomerFacingProductName({
                group: divaGroup,
                variant: {
                    itemName: "Shiny Black Perfume Spray",
                    graceSku: "GB-DVA-CLR-46ML-SPR-SBLK",
                    websiteSku: "GBDiva46SpryShnBlk",
                    applicator: "Perfume Spray",
                    capColor: "Shiny Black",
                },
            }).displayName,
        ).toBe("46 ml Clear Diva Perfume Spray Bottle - Shiny Black");

        expect(
            getCustomerFacingProductName({
                group: divaGroup,
                variant: {
                    itemName: "Copper Perfume Spray",
                    graceSku: "GB-DVA-CLR-46ML-SPR-CPR",
                    websiteSku: "GBDiva46SpryCu",
                    applicator: "Perfume Spray",
                    capColor: "Copper",
                },
            }).displayName,
        ).toBe("46 ml Clear Diva Perfume Spray Bottle - Copper");
    });

    it("does not use generic applicator labels as finish names", () => {
        expect(
            getCustomerFacingProductName({
                group: divaGroup,
                variant: {
                    itemName: "Spray Clear",
                    graceSku: "GB-DVA-FRST-46ML-SPR-CPR",
                    websiteSku: "GBDivaFrst46SpryCu",
                    applicator: "Perfume Spray",
                    capColor: "Clear",
                    capStyle: "Spray",
                },
            }).displayName,
        ).toBe("46 ml Clear Diva Perfume Spray Bottle - Copper");
    });

    it("names antique bulb sprayer and tassel variants", () => {
        expect(
            getCustomerFacingProductName({
                group: divaGroup,
                variant: {
                    itemName: "Lavender Vintage Bulb Sprayer",
                    graceSku: "GB-DVA-CLR-46ML-ASP-LVN",
                    websiteSku: "GBDiva46AnSpLvn",
                    applicator: "Vintage Bulb Sprayer",
                    capColor: "Clear",
                },
            }).displayName,
        ).toBe("46 ml Clear Diva Vintage Bulb Spray Bottle - Lavender");

        expect(
            getCustomerFacingProductName({
                group: divaGroup,
                variant: {
                    itemName: "White Vintage Bulb Sprayer with Tassel",
                    graceSku: "GB-DVA-CLR-46ML-AST-WHT",
                    websiteSku: "GBDiva46AnSpTslWht",
                    applicator: "Vintage Bulb Sprayer with Tassel",
                    capColor: "White",
                },
            }).displayName,
        ).toBe("46 ml Clear Diva Vintage Bulb Spray Bottle with Tassel - White");
    });

    it("adds component-specific finish language for reducers, droppers, and roll-ons", () => {
        expect(
            getCustomerFacingProductName({
                group: divaGroup,
                variant: {
                    itemName: "Black Leather Reducer",
                    graceSku: "GB-DVA-CLR-46ML-RDC-BLK",
                    websiteSku: "GBDiva46RdcrBlkLthr",
                    applicator: "Reducer",
                    capColor: "Black Leather",
                },
            }).displayName,
        ).toBe("46 ml Clear Diva Reducer Bottle - Black Leather Cap");

        expect(
            getCustomerFacingProductName({
                group: divaGroup,
                variant: {
                    itemName: "Gold Dropper",
                    graceSku: "GB-DVA-CLR-46ML-DRP-GLD",
                    websiteSku: "GBDiva46DrpGl",
                    applicator: "Dropper",
                    capColor: "Gold",
                },
            }).displayName,
        ).toBe("46 ml Clear Diva Dropper Bottle - Gold Collar");

        expect(
            getCustomerFacingProductName({
                group: {
                    displayName: "10 ml Amber Bell Bottle",
                    family: "Bell",
                    capacity: "10 ml (0.34 oz)",
                    color: "Amber",
                    category: "Glass Bottle",
                },
                variant: {
                    itemName: "Black Roll-On Cap",
                    graceSku: "GB-BEL-AMR-10ML-ROL-BLK",
                    websiteSku: "GBBell10RollBlk",
                    applicator: "Roll-On",
                    capColor: "Black",
                },
            }).displayName,
        ).toBe("10 ml Amber Bell Roll-On Bottle - Black Cap");
    });

    it("keeps cobalt blue glass separate from roll-on cap finishes", () => {
        const cylinderGroup = {
            displayName: "5 ml Cobalt Blue Cylinder Roll-On Bottle",
            family: "Cylinder",
            capacity: "5 ml (0.17 oz)",
            capacityMl: 5,
            color: "Cobalt Blue",
            category: "Glass Bottle",
            applicatorTypes: ["Metal Roller Ball"],
        };

        expect(
            getCustomerFacingProductName({
                group: cylinderGroup,
                variant: {
                    itemName: "Silver with Dots Metal Roll-On Cap",
                    graceSku: "GB-CYL-BLU-5ML-MRL-SLDT",
                    websiteSku: "GBCylBlu5MtlRollSlDot",
                    applicator: "Metal Roller Ball",
                    capColor: "Silver with Dots",
                    capStyle: "Dot Cap",
                    ballMaterial: "Metal Roller",
                },
            }).variantLabel,
        ).toBe("Silver with Dots Cap");

        expect(
            getCustomerFacingProductName({
                group: cylinderGroup,
                variant: {
                    itemName: "Pink with Dots Metal Roll-On Cap",
                    graceSku: "GB-CYL-BLU-5ML-MRL-PKDT",
                    websiteSku: "GBCylBlu5MtlRollPinkDot",
                    applicator: "Metal Roller Ball",
                    capColor: "Pink with Dots",
                    capStyle: "Dot Cap",
                    ballMaterial: "Metal Roller",
                },
            }).variantLabel,
        ).toBe("Pink with Dots Cap");
    });

    it("keeps plain bottle fallback conservative", () => {
        expect(
            getCustomerFacingProductName({
                group: divaGroup,
                fallbackName: divaGroup.displayName,
            }).displayName,
        ).toBe("46 ml Clear Diva Bottle");
    });

    it("does not mutate identity fields", () => {
        const variant = {
            itemName: "Copper Perfume Spray",
            graceSku: "GB-DVA-CLR-46ML-SPR-CPR",
            websiteSku: "GBDiva46SpryCu",
            applicator: "Perfume Spray",
            capColor: "Copper",
        };
        const before = JSON.stringify(variant);

        const result = getCustomerFacingProductName({ group: divaGroup, variant });

        expect(JSON.stringify(variant)).toBe(before);
        expect(result.displayName).not.toContain(variant.graceSku);
        expect(result.displayName).not.toContain(variant.websiteSku);
    });
});
