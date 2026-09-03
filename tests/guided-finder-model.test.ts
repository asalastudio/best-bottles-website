import { describe, expect, it } from "vitest";
import { buildGuidedFinderFamilies, conflictingRefinement } from "@/lib/products/guided-finder";

describe("guided finder result model", () => {
    it("exposes the exact B2B decision fields from real group and variant rows", () => {
        const families = buildGuidedFinderFamilies({
            items: [
                {
                    _id: "elegant-50",
                    slug: "elegant-50ml-clear",
                    displayName: "Legacy source name",
                    family: "Elegant",
                    capacity: "50 ml (1.7 oz)",
                    capacityMl: 50,
                    color: "Clear",
                    category: "Glass Bottle",
                    bottleCollection: "Bottles",
                    neckThreadSize: "20-410",
                    variantCount: 1,
                    priceRangeMin: 99,
                    priceRangeMax: 99,
                    heroImageUrl: "https://cdn.shopify.com/elegant-group.png",
                    applicatorTypes: ["Metal Roller Ball"],
                },
            ],
            facets: {
                categories: {}, collections: {}, applicators: {}, rollerMaterials: { metal: 1, plastic: 0 },
                families: { Elegant: 1 }, colors: {}, capacities: {}, neckThreadSizes: {}, componentTypes: {}, priceRange: { min: 0, max: 0 },
            },
            totalCount: 1,
            nextCursor: null,
            primarySkus: [],
            variantPreviewRows: [{
                groupId: "elegant-50",
                variants: [{
                    id: "variant-1",
                    itemName: "50 ml Clear Elegant Metal Roller Bottle",
                    websiteSku: "GBELEG50MRL",
                    graceSku: "GB-ELEG-CLR-50ML-MRL",
                    imageUrl: "https://cdn.shopify.com/elegant-roller.png",
                    imageUrlCapOff: null,
                    color: "Clear",
                    applicator: "Metal Roller Ball",
                    capColor: "Shiny Gold",
                    trimColor: null,
                    capStyle: "Roller",
                    capHeight: null,
                    ballMaterial: "Stainless Steel",
                    stockStatus: "In Stock",
                    caseQuantity: 96,
                    webPrice1pc: 2.75,
                    shopifyVariantId: "gid://shopify/ProductVariant/42",
                    shopifySellable: true,
                }],
            }],
        });

        expect(families).toEqual([{
            family: "Elegant",
            exactProducts: [expect.objectContaining({
                imageUrl: "https://cdn.shopify.com/elegant-roller.png",
                displayName: "50 ml Clear Elegant Roll-On Bottle - Shiny Gold Cap",
                family: "Elegant",
                capacity: "50 ml",
                color: "Clear",
                application: "Roll-On",
                rollerMaterial: "metal",
                neckFinish: "20-410",
                stockStatus: "In Stock",
                availability: "in-stock",
                caseQuantity: 96,
                startingUnitPrice: 2.75,
                checkoutReady: true,
                href: "/products/elegant-50ml-clear",
            })],
        }]);
    });

    it("uses the approved group image fallback and keeps explicit sellability authoritative", () => {
        const [family] = buildGuidedFinderFamilies({
            items: [{
                _id: "cylinder-9", slug: "cylinder-9ml-amber", displayName: "9 ml Amber Cylinder",
                family: "Cylinder", capacity: "9 ml (0.3 oz)", capacityMl: 9, color: "Amber",
                category: "Glass Bottle", bottleCollection: null, neckThreadSize: "17-415", variantCount: 1,
                priceRangeMin: null, priceRangeMax: null, heroImageUrl: "https://cdn.shopify.com/cylinder-group.png", applicatorTypes: ["Plastic Roller Ball"],
            }],
            facets: {
                categories: {}, collections: {}, applicators: {}, rollerMaterials: { metal: 0, plastic: 1 },
                families: { Cylinder: 1 }, colors: {}, capacities: {}, neckThreadSizes: {}, componentTypes: {}, priceRange: { min: 0, max: 0 },
            },
            totalCount: 1, nextCursor: null, primarySkus: [],
            variantPreviewRows: [{
                groupId: "cylinder-9",
                variants: [{
                    id: "variant-2", itemName: "9 ml Amber Cylinder", websiteSku: "GBCYL9", graceSku: "GB-CYL-AMB-9ML-ROL",
                    imageUrl: "https://cdn.sanity.io/blocked.png", imageUrlCapOff: null, color: "Amber", applicator: "Plastic Roller Ball",
                    capColor: null, trimColor: null, capStyle: null, capHeight: null, ballMaterial: "Plastic",
                    stockStatus: null, caseQuantity: null, webPrice1pc: 1.5,
                    shopifyVariantId: "gid://shopify/ProductVariant/blocked", shopifySellable: false,
                }],
            }],
        });

        expect(family?.exactProducts[0]).toMatchObject({
            imageUrl: "https://cdn.shopify.com/cylinder-group.png",
            availability: "confirm-availability",
            startingUnitPrice: 1.5,
            checkoutReady: false,
        });
    });

    it("groups by the canonical family order and then exact capacity", () => {
        const result = buildGuidedFinderFamilies({
            items: [
                { _id: "round-30", slug: "round-30", displayName: "Round 30", family: "Round", capacity: "30 ml", capacityMl: 30, color: "Clear", category: "Glass Bottle", bottleCollection: null, neckThreadSize: "20-410", variantCount: 0, priceRangeMin: null, priceRangeMax: null, applicatorTypes: [] },
                { _id: "cylinder-9", slug: "cylinder-9", displayName: "Cylinder 9", family: "Cylinder", capacity: "9 ml", capacityMl: 9, color: "Clear", category: "Glass Bottle", bottleCollection: null, neckThreadSize: "17-415", variantCount: 0, priceRangeMin: null, priceRangeMax: null, applicatorTypes: [] },
                { _id: "cylinder-3", slug: "cylinder-3", displayName: "Cylinder 3", family: "Cylinder", capacity: "3 ml", capacityMl: 3, color: "Clear", category: "Glass Bottle", bottleCollection: null, neckThreadSize: "13-415", variantCount: 0, priceRangeMin: null, priceRangeMax: null, applicatorTypes: [] },
            ],
            facets: { categories: {}, collections: {}, applicators: {}, rollerMaterials: { metal: 0, plastic: 0 }, families: {}, colors: {}, capacities: {}, neckThreadSizes: {}, componentTypes: {}, priceRange: { min: 0, max: 0 } },
            totalCount: 3, nextCursor: null, primarySkus: [], variantPreviewRows: [],
        });

        expect(result.map((family) => [family.family, family.exactProducts.map((product) => product.capacity)])).toEqual([
            ["Cylinder", ["3 ml", "9 ml"]],
            ["Round", ["30 ml"]],
        ]);
    });

    it("identifies the active refinement that has no facet results", () => {
        expect(conflictingRefinement(
            { entryMode: "search", glassColors: ["Amber"], neckThreads: ["17-415"] },
            {
                categories: {}, collections: {}, applicators: {}, rollerMaterials: { metal: 0, plastic: 0 },
                families: {}, colors: { Amber: 0 }, capacities: {}, neckThreadSizes: { "17-415": 1 }, componentTypes: {}, priceRange: { min: 0, max: 0 },
            },
        )).toBe("glassColors");
    });
});
