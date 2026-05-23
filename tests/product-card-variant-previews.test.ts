import { describe, expect, it } from "vitest";
import { getMaterialSwatchBackground } from "../src/lib/products/material-swatches";
import { getProductCardVariantPreviews } from "../src/lib/products/product-card-variant-previews";

describe("product card variant previews", () => {
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
        expect(previews[0]?.swatchImageUrl).toContain("cdn.sanity.io");
    });
});

describe("material swatch backgrounds", () => {
    it("normalizes prefixed labels to premium material finishes", () => {
        expect(getMaterialSwatchBackground("Spray Shiny Gold")).toContain("radial-gradient");
        expect(getMaterialSwatchBackground("Screw Cap Matte Silver")).toContain("linear-gradient");
        expect(getMaterialSwatchBackground("Black Leather")).toContain("linear-gradient");
    });
});
