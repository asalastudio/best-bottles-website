import { describe, expect, it } from "vitest";
import {
    sanitizeCatalogResult,
} from "../src/lib/catalogServer";
import type { CatalogSearchResultShape } from "../src/lib/catalogSearchFallback";
import { buildCatalogSearchResult } from "../src/lib/catalogSearchFallback";
import { EMPTY_FILTERS } from "../src/lib/catalogFilters";

// A catalog card must never sell a cap which the destination PDP excludes.
import { getCatalogCardVariantPreviews } from "../src/lib/products/product-card-variant-previews";
import { catalogCardPurchaseOptions, resolveCatalogCardPurchaseVariant } from "../src/lib/products/catalog-card-purchase";
import { filterVariantsForGroupIntent } from "../src/lib/products/group-variant-intent";
import { derivePicks, resolveVariant } from "../src/lib/products/pdp-redesign/model";
import { squareVariant } from "./fixtures/square-variant";

function resultFixture(): CatalogSearchResultShape {
    return {
        items: [
            {
                _id: "alias",
                slug: "cylinder-9ml-clear",
                displayName: "Legacy Cylinder alias",
                family: "Cylinder",
                capacity: "9 ml (0.3 oz)",
                capacityMl: 9,
                color: "Clear",
                category: "Glass Bottle",
                bottleCollection: null,
                neckThreadSize: "17-415",
                variantCount: 1,
                priceRangeMin: 1,
                priceRangeMax: 1,
                applicatorTypes: ["Metal Roller Ball"],
            },
            {
                _id: "canonical",
                slug: "cylinder-9ml-clear-17-415-rollon",
                displayName: "9 ml Clear Cylinder Roll-On Bottle",
                family: "Cylinder",
                capacity: "9 ml (0.3 oz)",
                capacityMl: 9,
                color: "Clear",
                category: "Glass Bottle",
                bottleCollection: null,
                neckThreadSize: "17-415",
                variantCount: 20,
                priceRangeMin: 1,
                priceRangeMax: 2,
                applicatorTypes: ["Metal Roller Ball"],
            },
        ],
        facets: {
            categories: { "Glass Bottle": 300, Component: 67 },
            collections: { Bottles: 300 },
            applicators: { rollon: 30, finemist: 80, lotionpump: 20 },
            rollerMaterials: { metal: 25, plastic: 5 },
            families: { Cylinder: 22, Elegant: 20, "Boston Round": 18 },
            colors: { Clear: 180, Amber: 70, "Cobalt Blue": 30 },
            capacities: {
                "3 ml": { label: "3 ml", ml: 3, count: 2 },
                "9 ml": { label: "9 ml", ml: 9, count: 20 },
                "100 ml": { label: "100 ml", ml: 100, count: 40 },
                "250 ml": { label: "250 ml", ml: 250, count: 12 },
            },
            neckThreadSizes: { "13-415": 30, "17-415": 25, "24-410": 40 },
            componentTypes: { Sprayer: 25, Cap: 40 },
            priceRange: { min: 0.2, max: 15 },
        },
        totalCount: 367,
        nextCursor: "24",
        primarySkus: [
            { groupId: "alias", websiteSku: "OLD", graceSku: "OLD" },
            { groupId: "canonical", websiteSku: "GOOD", graceSku: "GOOD" },
        ],
        variantPreviewRows: [
            { groupId: "alias", variants: [] },
            { groupId: "canonical", variants: [] },
        ],
    };
}

describe("catalog result canonicalization", () => {
    it("includes -finemist product groups in the canonical fine-mist filter", () => {
        const fixture = resultFixture();
        const sprayGroup = {
            ...fixture.items[1],
            _id: "fine-mist",
            slug: "cylinder-9ml-clear-17-415-finemist",
            displayName: "9 ml Clear Cylinder Fine Mist Bottle",
            applicatorTypes: ["Fine Mist Sprayer"],
        };
        const result = buildCatalogSearchResult({
            groups: [sprayGroup],
            primarySkus: [],
            variantPreviewRows: [],
            filters: { ...EMPTY_FILTERS, applicators: ["finemist"] },
            sort: "featured",
            view: "visual",
            limit: 24,
            cursor: null,
        });

        expect(result.totalCount).toBe(1);
        expect(result.items[0]?.slug).toBe("cylinder-9ml-clear-17-415-finemist");
    });

    it("removes legacy route aliases without collapsing global facets to the current page", () => {
        const result = sanitizeCatalogResult(resultFixture());

        expect(result.items.map((item) => item.slug)).toEqual([
            "cylinder-9ml-clear-17-415-rollon",
        ]);
        expect(result.totalCount).toBe(366);
        expect(result.primarySkus).toHaveLength(1);
        expect(result.variantPreviewRows).toHaveLength(1);
        expect(Object.keys(result.facets.families)).toEqual([
            "Cylinder",
            "Elegant",
            "Boston Round",
        ]);
        expect(Object.keys(result.facets.capacities)).toEqual([
            "3 ml",
            "9 ml",
            "100 ml",
            "250 ml",
        ]);
    });
});

function squareFixture() {
    const result = resultFixture();
    const skuCaps = [
        ["GBSqr15CuSht", "Short Matte Copper", 0.60],
        ["GBSqr15BlkSht", "Short Black", 0.44],
        ["GBSqr15WhtSht", "Short White", 0.44],
        ["GBSqr15Gl", "Shiny Gold", 0.60],
        ["GBSqr15Sl", "Shiny Silver", 0.60],
    ] as const;
    const variants = skuCaps.map(([websiteSku, capColor, webPrice1pc]) => ({
        ...squareVariant, _id: websiteSku, id: websiteSku, websiteSku, graceSku: `grace-${websiteSku}`, itemName: `${capColor} cap`,
        family: "Square", capColor, webPrice1pc, webPrice12pc: null, priceTiers: null, applicator: null, capStyle: null, imageUrl: null, imageUrlCapOff: null, capHeight: null, ballMaterial: null,
    }));
    const group = { ...result.items[1], _id: "square", slug: "square-15ml-clear-13-415", family: "Square", capacityMl: 15, neckThreadSize: "13-415", primaryWebsiteSku: "GBSqr15CuSht", primaryGraceSku: "grace-GBSqr15CuSht" };
    return { result: { ...result, items: [group], primarySkus: [{ groupId: "square", websiteSku: "GBSqr15CuSht", graceSku: "grace-GBSqr15CuSht" }], variantPreviewRows: [{ groupId: "square", variants }] }, group, variants };
}

describe("catalog/PDP Square finish agreement", () => {
    for (const mode of ["server", "fallback"] as const) {
        it(`${mode} excludes unapproved quick-add finishes and preserves each approved SKU on the PDP`, () => {
            const { result: fixture, group, variants } = squareFixture();
            const result = mode === "server" ? sanitizeCatalogResult(fixture) : buildCatalogSearchResult({
                groups: fixture.items, primarySkus: fixture.primarySkus, variantPreviewRows: fixture.variantPreviewRows,
                filters: EMPTY_FILTERS, sort: "featured", view: "visual", limit: 24,
            });
            const rows = result.variantPreviewRows[0].variants;
            expect(rows.map(row => row.websiteSku)).toEqual(["GBSqr15BlkSht", "GBSqr15WhtSht", "GBSqr15Gl", "GBSqr15Sl"]);
            expect(result.primarySkus[0].websiteSku).toBe("GBSqr15BlkSht");
            const previews = getCatalogCardVariantPreviews(rows, { productTitle: "15 ml Clear Square", productHref: `/products/${group.slug}` });
            const purchases = catalogCardPurchaseOptions(rows, previews, "15 ml Clear Square");
            expect(Object.values(purchases).map(row => row.websiteSku)).not.toContain("GBSqr15CuSht");
            expect(resolveCatalogCardPurchaseVariant(rows, { picturedSku: "GBSqr15CuSht", productTitle: "Square" })?.websiteSku).toBe("GBSqr15BlkSht");
            const pdpRows = filterVariantsForGroupIntent(group.slug, variants);
            for (const preview of previews) {
                const sku = new URL(preview.href!, "https://example.test").searchParams.get("sku")!;
                const picked = resolveVariant(pdpRows, derivePicks(pdpRows, group, { sku }));
                expect(picked?.websiteSku).toBe(sku);
                expect(purchases[preview.id].websiteSku).toBe(sku);
                expect(purchases[preview.id].webPrice1pc).toBe(picked?.webPrice1pc);
            }
        });
    }

    it("does not reopen the explicit Square allowlist when only an unapproved SKU is returned", () => {
        const { result, group, variants } = squareFixture();
        result.variantPreviewRows[0].variants = [variants[0]];
        expect(filterVariantsForGroupIntent(group.slug, [variants[0]])).toEqual([]);
        const scoped = sanitizeCatalogResult(result);
        expect(scoped.variantPreviewRows[0].variants).toEqual([]);
        expect(scoped.primarySkus[0].websiteSku).toBeNull();
    });
});
