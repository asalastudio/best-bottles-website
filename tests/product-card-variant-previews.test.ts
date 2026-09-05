import { describe, expect, it } from "vitest";
import { getMaterialSwatchBackground } from "../src/lib/products/material-swatches";
import {
    getProductCardPreviewAccessibleLabel,
    getProductCardVariantPreviews,
} from "../src/lib/products/product-card-variant-previews";

describe("product card variant previews", () => {
    it("gives visually similar swatches unique product- and SKU-specific accessible names", () => {
        const first = {
            id: "gold-metal",
            label: "Shiny Gold Roller",
            graceSku: "GB-CYL-AMB-9ML-MRL-SGLD",
        };
        const second = {
            id: "gold-plastic",
            label: "Shiny Gold Roller",
            graceSku: "GB-CYL-AMB-9ML-ROL-SGLD",
        };

        expect(getProductCardPreviewAccessibleLabel(first, "9 mL Amber Cylinder", 0)).toBe(
            "Preview Shiny Gold Roller for 9 mL Amber Cylinder · SKU GB-CYL-AMB-9ML-MRL-SGLD",
        );
        expect(getProductCardPreviewAccessibleLabel(second, "9 mL Amber Cylinder", 1)).not.toBe(
            getProductCardPreviewAccessibleLabel(first, "9 mL Amber Cylinder", 0),
        );
    });

    it("uses finish swatches for cap variants instead of glass texture fallbacks", () => {
        const previews = getProductCardVariantPreviews(
            [
                {
                    id: "gold-spray",
                    itemName: "Shiny Gold Perfume Spray",
                    imageUrl: "https://cdn.shopify.com/gold.png",
                    color: "Clear",
                    applicator: "Perfume Spray",
                    capColor: "Shiny Gold",
                    websiteSku: "GBEMP50SPRYSHNGL",
                },
                {
                    id: "silver-spray",
                    itemName: "Shiny Silver Perfume Spray",
                    imageUrl: "https://cdn.shopify.com/silver.png",
                    color: "Clear",
                    applicator: "Perfume Spray",
                    capColor: "Shiny Silver",
                    websiteSku: "GBEMP50SPRYSHNSLV",
                },
            ],
            {
                productTitle: "50 ml Clear Empire Bottle",
                groupColor: "Clear",
            },
        );

        expect(previews).toHaveLength(2);
        expect(previews.map((preview) => preview.optionType)).not.toContain("glassColor");
        expect(previews.every((preview) => preview.swatchImageUrl === undefined)).toBe(true);
        expect(new Set(previews.map((preview) => preview.swatchColor)).size).toBe(2);
    });

    it("keeps glass texture swatches for sibling glass-color previews", () => {
        const previews = getProductCardVariantPreviews(
            [
                {
                    id: "amber",
                    itemName: "10 ml Amber Bottle",
                    imageUrl: "https://cdn.shopify.com/amber.png",
                    color: "Amber",
                    websiteSku: "GBTESTAMBER",
                },
            ],
            {
                productTitle: "10 ml Clear Bottle",
                groupColor: "Clear",
            },
        );

        expect(previews[0]?.optionType).toBe("glassColor");
        expect(previews[0]?.swatchImageUrl).toContain("/assets/glass-swatches/amber-");
    });

    it("uses SKU finish evidence when imported cap fields are generic", () => {
        const previews = getProductCardVariantPreviews(
            [
                {
                    id: "copper-spray",
                    itemName: "Spray Clear",
                    imageUrl: "https://cdn.shopify.com/copper.png",
                    color: "Clear",
                    applicator: "Perfume Spray",
                    capColor: "Clear",
                    capStyle: "Spray",
                    websiteSku: "GBDivaFrst46SpryCu",
                    graceSku: "GB-DVA-FRST-46ML-SPR-CPR",
                },
                {
                    id: "gold-spray",
                    itemName: "Spray Clear",
                    imageUrl: "https://cdn.shopify.com/gold.png",
                    color: "Clear",
                    applicator: "Perfume Spray",
                    capColor: "Clear",
                    capStyle: "Spray",
                    websiteSku: "GBDivaFrst46SpryShnGl",
                    graceSku: "GB-DVA-FRST-46ML-SPR-SGLD",
                },
            ],
            {
                productTitle: "46 ml Clear Diva Perfume Spray Bottle",
                groupColor: "Clear",
            },
        );

        expect(previews.map((preview) => preview.label)).toEqual([
            "Copper Pump",
            "Shiny Gold Pump",
        ]);
        expect(previews.map((preview) => preview.swatchColor)).toEqual(["#B87333", "#D2A94F"]);
        expect(previews.every((preview) => preview.optionType === "fitment")).toBe(true);
    });

    it("collapses duplicate cap-finish dots that only differ by cap-on/cap-off media", () => {
        const previews = getProductCardVariantPreviews(
            [
                {
                    id: "green-cap-on",
                    itemName: "3 ml Green Vial Bottle with Cap",
                    imageUrl: "https://cdn.shopify.com/green-cap-on.png",
                    color: "Green",
                    capColor: "Green",
                    capStyle: "Short",
                    websiteSku: "GBVGreen2o4BlackCapSht",
                },
                {
                    id: "green-cap-off",
                    itemName: "3 ml Green Vial Bottle with Cap",
                    imageUrlCapOff: "https://cdn.shopify.com/green-cap-off.png",
                    color: "Green",
                    capColor: "Green",
                    capStyle: "Short",
                    websiteSku: "GBVGreen2o4BlackCapSht",
                },
            ],
            {
                productTitle: "3 ml Green Vial Bottle with Cap",
                groupColor: "Green",
            },
        );

        expect(previews).toHaveLength(1);
        expect(previews[0]?.label).toBe("Short Green Cap");
    });
});

describe("material swatch backgrounds", () => {
    it("normalizes prefixed labels to premium material finishes", () => {
        expect(getMaterialSwatchBackground("Spray Shiny Gold")).toContain("radial-gradient");
        expect(getMaterialSwatchBackground("Screw Cap Matte Silver")).toContain("linear-gradient");
        expect(getMaterialSwatchBackground("Black Leather")).toContain("linear-gradient");
    });
});
