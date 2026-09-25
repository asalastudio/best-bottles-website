import { describe, expect, it } from "vitest";
import {
    CAPACITY_RANGES,
    CATALOG_PRODUCT_TYPES,
    EMPTY_FILTERS,
    capacityInRange,
    capacitySelectionMatches,
    catalogFitmentLabel,
    categorySelectionMatches,
    expandCapacityFilterValues,
    expandNeckFilterValues,
    neckFacetKind,
    neckFacetOptions,
    neckSelectionMatches,
    productTypeCount,
} from "@/lib/catalogFilters";
import { buildCatalogSearchResult, type CatalogSearchGroup } from "@/lib/catalogSearchFallback";
import { isVisibleCatalogGroup } from "@/lib/products/catalog-listing-visibility";
import { catalogCardPurchaseOptions } from "@/lib/products/catalog-card-purchase";
import { CAP_DOT_SLOTS, capDotStyle, visibleCapDots } from "@/components/catalog/CatalogCapDots";
import { catalogPackLabel } from "@/components/catalog/CatalogCardPurchase";

const group = (id: string, extra: Partial<CatalogSearchGroup> = {}): CatalogSearchGroup => ({
    _id: id, slug: id, displayName: id, family: "Cylinder", capacity: "9 ml", capacityMl: 9, color: "Clear",
    category: "Glass Bottle", bottleCollection: "Cylinder", neckThreadSize: "17-415", variantCount: 2,
    priceRangeMin: 1, priceRangeMax: 2, heroImageUrl: "/test.webp", applicatorTypes: ["Metal Roller Ball"], ...extra,
});
const run = (groups: CatalogSearchGroup[], filters: Partial<typeof EMPTY_FILTERS>) => buildCatalogSearchResult({
    groups, primarySkus: [], variantPreviewRows: [], filters: { ...EMPTY_FILTERS, ...filters },
    sort: "capacity-asc", view: "visual", limit: 50,
});

describe("capacity ranges (design 8a)", () => {
    it("are six non-overlapping ranges with ounces beside each", () => {
        expect(CAPACITY_RANGES.map((range) => `${range.label} (${range.detail})`)).toEqual([
            "1–5 ml (≤0.17 oz)", "6–15 ml (0.2–0.5 oz)", "16–30 ml (0.5–1 oz)",
            "31–60 ml (1–2 oz)", "61–100 ml (2–3.4 oz)", "101+ ml (3.4+ oz)",
        ]);
    });

    it("place every capacity, including the old gaps and decimal sizes, in exactly one range", () => {
        const sizes = [1, 3.7, 5, 5.5, 6, 15, 15.5, 16, 20, 24, 30, 46, 51, 54, 60, 78, 100, 118, 121, 127, 128, 500];
        for (const ml of sizes) {
            expect(CAPACITY_RANGES.filter((range) => capacityInRange(ml, range)), `${ml} ml`).toHaveLength(1);
        }
    });

    it("filter by range token and expand it into the milliliter labels Convex matches", () => {
        expect(capacitySelectionMatches(9, ["6-15ml"])).toBe(true);
        expect(capacitySelectionMatches(5, ["6-15ml"])).toBe(false);
        expect(capacitySelectionMatches(128, ["101ml-plus"])).toBe(true);
        const expanded = expandCapacityFilterValues(["6-15ml"]);
        expect(expanded).toContain("9 ml");
        expect(expanded).toContain("15 ml");
        expect(expanded).not.toContain("5 ml");
        expect(expanded).not.toContain("16 ml");
        // Links shared before the redesign keep working.
        expect(capacitySelectionMatches(3, ["miniature"])).toBe(true);
    });
});

describe("product type switch", () => {
    it("groups jars and packaging lines into single switch values", () => {
        expect(CATALOG_PRODUCT_TYPES.map((type) => type.label)).toEqual(["Glass bottles", "Jars", "Components", "Packaging & more"]);
        expect(categorySelectionMatches("jars", "Cream Jar")).toBe(true);
        expect(categorySelectionMatches("jars", "Glass Jar")).toBe(true);
        expect(categorySelectionMatches("jars", "Glass Bottle")).toBe(false);
        expect(categorySelectionMatches("Glass Bottle", "Glass Bottle")).toBe(true);
        expect(categorySelectionMatches(null, "Component")).toBe(true);
        expect(productTypeCount("packaging-more", { "Aluminum Bottle": 3, "Plastic Bottle": 4, Packaging: 5, "Glass Bottle": 99 })).toBe(12);
        expect(productTypeCount("jars", { "Glass Jar": 9, "Cream Jar": 3 })).toBe(12);
    });

    it("filters and counts multi-category types in the in-memory search", () => {
        const rows = [
            group("bottle"),
            group("cream", { category: "Cream Jar", family: "Cream Jar" }),
            group("jar", { category: "Glass Jar", family: "Apothecary" }),
        ];
        const result = run(rows, { category: "jars" });
        expect(result.items.map((item) => item._id).sort()).toEqual(["cream", "jar"]);
        // Category counts ignore the category filter, so the switch shows every type's count.
        expect(productTypeCount("Glass Bottle", result.facets.categories)).toBe(1);
        expect(productTypeCount("jars", result.facets.categories)).toBe(2);
    });

    it("counts products per shop collection under the other active filters", () => {
        const rows = [
            group("roller"),
            group("dropper", { applicatorTypes: ["Dropper"], family: "Boston Round" }),
        ];
        const result = run(rows, { families: ["Cylinder"] });
        expect(result.facets.shopCollections?.["roll-on-bottles"]).toBe(1);
        expect(result.facets.shopCollections?.["dropper-bottles"]).toBe(0);
    });

    it("never lists internal test records", () => {
        expect(isVisibleCatalogGroup({ slug: "qa-test", variantCount: 1, category: "Internal" })).toBe(false);
        expect(isVisibleCatalogGroup({ slug: "cylinder-9ml", variantCount: 1, category: "Glass Bottle" })).toBe(true);
    });
});

describe("neck finish facet", () => {
    it("keeps standard finishes, groups ground glass, and folds everything else into Specialty", () => {
        expect(neckFacetKind("18-415")).toBe("standard");
        expect(neckFacetKind("Ground")).toBe("ground");
        expect(neckFacetKind("Press-Fit")).toBe("specialty");
        expect(neckFacetKind("Size: GBPillar9BlkSht Nemat In")).toBe("specialty");
        expect(neckFacetKind("")).toBeNull();

        const options = neckFacetOptions({ "13-415": 40, "18-415": 90, Ground: 6, "Press-Fit": 3, snap: 2 });
        expect(options.slice(0, 2).map((option) => option.value)).toEqual(["18-415", "13-415"]);
        expect(options.at(-2)).toEqual({ value: "Ground", label: "Ground glass", count: 6 });
        expect(options.at(-1)).toEqual({ value: "specialty", label: "Specialty", count: 5 });
    });

    it("matches and expands the Specialty token", () => {
        expect(neckSelectionMatches(["specialty"], "Press-Fit")).toBe(true);
        expect(neckSelectionMatches(["specialty"], "18-415")).toBe(false);
        expect(neckSelectionMatches(["Ground"], "Ground")).toBe(true);
        expect(neckSelectionMatches([], null)).toBe(true);
        expect(expandNeckFilterValues(["specialty", "18-415"], ["18-415", "Press-Fit", "Ground", "snap"]).sort())
            .toEqual(["18-415", "Press-Fit", "snap"]);
        expect(expandNeckFilterValues(["18-415"], ["Press-Fit"])).toEqual(["18-415"]);
    });
});

describe("product card helpers", () => {
    it("names the fitted applicator for the spec line", () => {
        expect(catalogFitmentLabel("Metal Roller Ball")).toBe("Metal roller");
        expect(catalogFitmentLabel("Metal Roller", "plastic")).toBe("Plastic roller");
        expect(catalogFitmentLabel("Plastic Roller Ball")).toBe("Plastic roller");
        expect(catalogFitmentLabel("Fine Mist Sprayer")).toBe("Fine mist spray");
        expect(catalogFitmentLabel("Vintage Bulb Sprayer with Tassel")).toBe("Vintage-style bulb sprayer with tassel");
        expect(catalogFitmentLabel("Cap/Closure")).toBe("Cap");
        expect(catalogFitmentLabel("N/A")).toBeNull();
        expect(catalogFitmentLabel(null)).toBeNull();
    });

    it("shows at most six cap slots, keeping the picked cap visible", () => {
        const caps = Array.from({ length: 9 }, (_, index) => ({ id: `cap-${index}` }));
        expect(visibleCapDots(caps.slice(0, CAP_DOT_SLOTS), null)).toHaveLength(6);
        expect(visibleCapDots(caps, null).map((cap) => cap.id)).toEqual(["cap-0", "cap-1", "cap-2", "cap-3", "cap-4"]);
        expect(visibleCapDots(caps, "cap-7").map((cap) => cap.id)).toEqual(["cap-0", "cap-1", "cap-2", "cap-3", "cap-7"]);
    });

    it("fills a dot with the cap photo, else the finish's material colour", () => {
        expect(capDotStyle({ id: "a", label: "Shiny Gold" }, "/cap.webp")).toMatchObject({ backgroundImage: "url(/cap.webp)", backgroundSize: "cover" });
        expect(capDotStyle({ id: "b", label: "Matte Black" }, undefined).background).toContain("linear-gradient");
        expect(capDotStyle({ id: "c", label: "Unlisted finish", swatchColor: "#123456" }, undefined)).toEqual({ background: "#123456" });
        expect(capDotStyle({ id: "d", label: "Unlisted finish" }, undefined)).toEqual({ background: "#e6dccd" });
    });

    it("gives each cap dot the exact SKU it sells, and nothing for a dot without a sellable row", () => {
        const rows = [
            { id: "r1", graceSku: "CYL9-BLK", websiteSku: "GBCyl9Blk", capColor: "Black", webPrice1pc: 0.9 },
            { id: "r2", graceSku: "CYL9-GL", websiteSku: "GBCyl9Gl", capColor: "Gold", webPrice1pc: 1.1 },
            { id: "r3", graceSku: null, websiteSku: "GBCyl9Sl", capColor: "Silver", webPrice1pc: 1.0 },
        ];
        const options = catalogCardPurchaseOptions(rows, [
            { id: "black", websiteSku: "GBCyl9Blk" },
            { id: "gold", websiteSku: "GBCyl9Gl" },
            { id: "silver", websiteSku: "GBCyl9Sl" },
        ], "9 ml Cylinder");
        expect(Object.keys(options)).toEqual(["black", "gold"]);
        expect(options.gold.graceSku).toBe("CYL9-GL");
        expect(options.gold.webPrice1pc).toBe(1.1);
    });

    it("labels the Pack of button with the break's first piece count", () => {
        expect(catalogPackLabel(null)).toBe("1");
        expect(catalogPackLabel({ minQty: 144, maxQty: 863, unitPrice: 0.6, savePct: 10, saveEach: 0.1, appliesAtCheckout: false })).toBe("144");
        expect(catalogPackLabel({ minQty: 4320, maxQty: null, unitPrice: 0.5, savePct: 20, saveEach: 0.2, appliesAtCheckout: false })).toBe("4,320+");
    });
});
