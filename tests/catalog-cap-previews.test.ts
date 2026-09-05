import { describe, expect, it } from "vitest";
import { catalogCapKind, catalogCapPhoto } from "../src/lib/products/catalog-cap-photos";
import { getCatalogCardVariantPreviews, productCardVariantHref } from "../src/lib/products/product-card-variant-previews";

const options = { productTitle: "9 ml Clear Cylinder Roll-On", groupColor: "Clear", productHref: "/products/cylinder?applicator=rollon&from=%2Fcatalog" };
const variants = [
    { id: "metal-black", websiteSku: "TestMtlRollShnBlk", color: "Clear", applicator: "Metal Roller Ball", ballMaterial: "metal", capColor: "Shiny Black" },
    { id: "metal-gold", websiteSku: "TestMtlRollShnGl", color: "Clear", applicator: "Metal Roller Ball", ballMaterial: "metal", capColor: "Shiny Gold" },
    { id: "plastic-black", websiteSku: "TestRollShnBlk", color: "Clear", applicator: "Plastic Roller Ball", ballMaterial: "plastic", capColor: "Shiny Black" },
    { id: "plastic-gold", websiteSku: "TestRollShnGl", color: "Clear", applicator: "Plastic Roller Ball", ballMaterial: "plastic", capColor: "Shiny Gold" },
];

describe("catalog top previews", () => {
    it("keeps distinct frosted-bottle finishes despite imported glass colors in capColor", () => {
        const sources = ["BlkMatt", "BlkSh", "BluMatt", "CuMatt", "GlMatt", "GlSh", "SlMatt", "SlSh"].map((finish) => ({
            id: finish, websiteSku: `GBTallCylFrst9Spry${finish}`, color: "Frosted", capColor: "Frosted", applicator: "Fine Mist Sprayer", capStyle: "Tall",
        }));
        const result = getCatalogCardVariantPreviews(sources, { ...options, groupColor: "Frosted" });
        expect(result).toHaveLength(8);
        expect(new Set(result.map(v => v.label)).size).toBe(8);
        expect(result.every(v => !v.label.includes("Frosted"))).toBe(true);
    });
    it("recognizes the 13-415 sprayer component SKU format", () => {
        expect(catalogCapPhoto({ id: "black", label: "Matte Black", websiteSku: "GBTallCyl9SpryBlkMatt" }, [
            { websiteSku: "CP13-415SpryBlkMt", thumb: "13-415-sprayer" },
        ], "sprayer")).toBe("13-415-sprayer");
    });
    it("shows cap finishes within one roller assembly, without doubling the count", () => {
        expect(getCatalogCardVariantPreviews(variants, options).map(v => v.id)).toEqual(["metal-black", "metal-gold"]);
    });
    it("respects a material filter and ranks a searched finish first", () => {
        const result = getCatalogCardVariantPreviews(variants, { ...options, rollerMaterials: ["plastic"], search: "gold cylinder" });
        expect(result.map(v => v.id)).toEqual(["plastic-gold", "plastic-black"]);
    });
    it("carries the selected SKU while preserving navigation context", () => {
        const result = getCatalogCardVariantPreviews(variants, { ...options, search: "gold" });
        const href = new URL(productCardVariantHref(options.productHref, result[0]), "https://bestbottles.com");
        expect(href.searchParams.get("sku")).toBe("TestMtlRollShnGl");
        expect(href.searchParams.get("applicator")).toBe("rollon");
        expect(href.searchParams.get("from")).toBe("/catalog");
    });
    it("never uses a roller plug or sprayer photograph as a roller cap", () => {
        const preview = { id: "black", label: "Black", websiteSku: "TestRollShnBlk" };
        expect(catalogCapPhoto(preview, [
            { websiteSku: "Roller17-415ShnBlk", thumb: "roller" },
            { websiteSku: "Spry17-415ShnBlk", thumb: "sprayer" },
            { websiteSku: "CPRoll17-415ShnBlk", thumb: "cap" },
        ], "roller")).toBe("cap");
    });
    it("does not collapse smooth/dotted or short/tall component photos", () => {
        const rows = [
            { websiteSku: "CPRoll17-415Black", thumb: "smooth" },
            { websiteSku: "CPRoll17-415BlackDot", thumb: "dotted" },
        ];
        expect(catalogCapPhoto({ id: "dot", label: "Black Dotted", websiteSku: "TestRollBlackDot" }, rows, "roller")).toBe("dotted");
        expect(catalogCapPhoto({ id: "short", label: "Short Black", websiteSku: "TestRollBlackSht" }, rows, "roller")).toBeUndefined();
    });
    it("prefers reviewed exact-SKU cap photos and recovers if that asset fails", () => {
        const preview = { id: "black", label: "Shiny Black", websiteSku: "GBCyl9MtlRollShBlk" };
        const rows = [{ websiteSku: "CPRoll17-415ShnBlk", thumb: "fallback" }];
        const exact = catalogCapPhoto(preview, rows, "roller");
        expect(exact).toContain("reviewed-cap-thumbs");
        expect(catalogCapPhoto(preview, rows, "roller", new Set([exact!]))).toBe("fallback");
    });
    it("supports the requested swappable tops and excludes mixed assemblies", () => {
        expect(catalogCapKind(["Fine Mist Sprayer"])).toBe("sprayer");
        expect(catalogCapKind(["Lotion Pump"])).toBe("pump");
        expect(catalogCapKind(["Dropper"])).toBe("dropper");
        expect(catalogCapKind(["Antique Bulb Sprayer"])).toBe("antique");
        expect(catalogCapKind(["Antique Bulb Sprayer with Tassel"])).toBe("antiqueTassel");
        expect(catalogCapKind(["Metal Roller Ball", "Fine Mist Sprayer"])).toBeNull();
    });
    it("uses the catalog finish for legacy SKUs without a recognized finish token", () => {
        expect(catalogCapPhoto({ id: "red", label: "Red", capLabel: "Red", websiteSku: "GBCylAmb9SpryRd" }, [
            { websiteSku: "Spry17-415Red", thumb: "red-sprayer" },
        ], "sprayer")).toBe("red-sprayer");
    });
});
