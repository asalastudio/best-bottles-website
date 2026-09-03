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
                    priceRangeMin: 2.75,
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
                priceRangeMin: 1.5, priceRangeMax: 1.5, heroImageUrl: "https://cdn.shopify.com/cylinder-group.png", applicatorTypes: ["Plastic Roller Ball"],
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

    it("keeps OR-selected refinements valid when any selected facet still has results", () => {
        const facets = {
            categories: {}, collections: {}, applicators: {}, rollerMaterials: { metal: 0, plastic: 1 },
            families: {}, colors: { Amber: 0, Clear: 1 },
            capacities: { "3 ml": { label: "3 ml", ml: 3, count: 0 }, "9 ml": { label: "9 ml", ml: 9, count: 1 } },
            neckThreadSizes: { "13-415": 0, "17-415": 1 }, componentTypes: {}, priceRange: { min: 0, max: 0 },
        };

        expect(conflictingRefinement({ entryMode: "search", capacities: ["3 ml", "9 ml"] }, facets)).toBeNull();
        expect(conflictingRefinement({ entryMode: "search", rollerMaterials: ["metal", "plastic"] }, facets)).toBeNull();
        expect(conflictingRefinement({ entryMode: "search", glassColors: ["Amber", "Clear"] }, facets)).toBeNull();
        expect(conflictingRefinement({ entryMode: "search", neckThreads: ["13-415", "17-415"] }, facets)).toBeNull();
    });

    it("uses the group minimum for starting price regardless of variant collection order", () => {
        const variant = (id: string, webPrice1pc: number) => ({
            id, itemName: `9 ml Clear Cylinder ${id}`, websiteSku: id, graceSku: id,
            imageUrl: null, imageUrlCapOff: null, color: "Clear", applicator: "Metal Roller Ball",
            capColor: null, trimColor: null, capStyle: null, capHeight: null, ballMaterial: "Stainless Steel",
            stockStatus: null, caseQuantity: null, webPrice1pc, shopifyVariantId: null, shopifySellable: null,
        });
        const result = (variants: ReturnType<typeof variant>[]) => buildGuidedFinderFamilies({
            items: [{
                _id: "cylinder-9", slug: "cylinder-9ml-clear", displayName: "9 ml Clear Cylinder",
                family: "Cylinder", capacity: "9 ml", capacityMl: 9, color: "Clear", category: "Glass Bottle",
                bottleCollection: null, neckThreadSize: "17-415", variantCount: 2,
                priceRangeMin: 1.2, priceRangeMax: 3.5, heroImageUrl: null, applicatorTypes: ["Metal Roller Ball"],
            }],
            facets: { categories: {}, collections: {}, applicators: {}, rollerMaterials: { metal: 1, plastic: 0 }, families: {}, colors: {}, capacities: {}, neckThreadSizes: {}, componentTypes: {}, priceRange: { min: 1.2, max: 3.5 } },
            totalCount: 1, nextCursor: null, primarySkus: [], variantPreviewRows: [{ groupId: "cylinder-9", variants }],
        });

        expect(result([variant("expensive", 3.5), variant("starting", 1.2)])[0]?.exactProducts[0]?.startingUnitPrice).toBe(1.2);
        expect(result([variant("starting", 1.2), variant("expensive", 3.5)])[0]?.exactProducts[0]?.startingUnitPrice).toBe(1.2);
    });
});
