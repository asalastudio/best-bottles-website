import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildMatrixCartItems, summarizeMatrixOrder } from "@/lib/matrix/cart";

describe("Product Compatibility Matrix cart contract", () => {
    it("adds the configured bottle and its server-resolved component as separate cart lines", () => {
        const items = buildMatrixCartItems([{
            row: {
                graceSku: "GB-CYL-10",
                websiteSku: "Cyl10Clr",
                itemName: "10 ml clear Cylinder bottle",
                family: "Cylinder",
                capacity: "10 ml",
                color: "Clear",
                neckThreadSize: "18-415",
                webPrice1pc: 1.5,
                webPrice10pc: null,
                webPrice12pc: 1.25,
                shopifyVariantId: "gid://shopify/ProductVariant/10",
                shopifySellable: true,
            },
            component: {
                graceSku: "CMP-SPR-18",
                websiteSku: "Spr18Blk",
                itemName: "Black fine mist sprayer",
                capColor: "Black",
                webPrice1pc: 0.5,
                webPrice12pc: 0.4,
                shopifyVariantId: "gid://shopify/ProductVariant/18",
                shopifySellable: false,
            },
            quantity: 12,
        }]);

        expect(items).toEqual([
            expect.objectContaining({
                graceSku: "GB-CYL-10",
                websiteSku: "Cyl10Clr",
                quantity: 12,
                unitPrice: 1.5,
                checkoutEligible: true,
                shopifyVariantId: "gid://shopify/ProductVariant/10",
                shopifySellable: true,
                family: "Cylinder",
                neckThreadSize: "18-415",
            }),
            expect.objectContaining({
                graceSku: "CMP-SPR-18",
                websiteSku: "Spr18Blk",
                quantity: 12,
                unitPrice: 0.5,
                checkoutEligible: false,
                shopifyVariantId: "gid://shopify/ProductVariant/18",
                shopifySellable: false,
                category: "Component",
                neckThreadSize: "18-415",
            }),
        ]);
    });

    it("adds only the bottle when bottle-only was selected", () => {
        const items = buildMatrixCartItems([{
            row: {
                graceSku: "GB-CYL-10",
                itemName: "10 ml clear Cylinder bottle",
                webPrice1pc: 1.5,
            },
            component: null,
            quantity: 50,
        }]);

        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            graceSku: "GB-CYL-10",
            quantity: 50,
            unitPrice: 1.5,
        });
    });

    it("refuses a configured line with no catalog SKU instead of inventing one", () => {
        expect(() => buildMatrixCartItems([{
            row: { itemName: "Unmapped bottle", webPrice1pc: 1.5 },
            component: null,
            quantity: 12,
        }])).toThrow("missing a catalog SKU");
    });

    it("counts a selected component toward the same $50 eligibility total that reaches the cart", () => {
        const lines = [{
            row: {
                graceSku: "GB-CYL-100",
                itemName: "100 ml clear Cylinder bottle",
                webPrice1pc: 4,
            },
            component: {
                graceSku: "CMP-SPR-100",
                itemName: "Fine mist sprayer",
                webPrice1pc: 1,
            },
            quantity: 10,
        }];

        const summary = summarizeMatrixOrder(lines, 50);

        expect(summary.items).toEqual(buildMatrixCartItems(lines));
        expect(summary.subtotal).toBe(50);
        expect(summary.priced).toBe(true);
        expect(summary.meetsMinimum).toBe(true);
    });
});

describe("compatibility resolver parity", () => {
    it("routes Matrix, Grace, and the server-initialized PDP through the shared fitment chain", () => {
        const matrix = readFileSync("convex/matrix.ts", "utf8");
        const grace = readFileSync("convex/grace.ts", "utf8");
        const products = readFileSync("convex/products.ts", "utf8");
        const productPage = readFileSync("src/app/products/[slug]/page.tsx", "utf8");
        const chain = [
            "normalizeComponentsByType",
            "selectBestFitmentRule",
            "filterGroupedComponentsByFitmentRule",
        ];

        for (const source of [matrix, grace, products]) {
            for (const functionName of chain) {
                expect(source).toContain(`${functionName}(`);
            }
        }
        expect(productPage).toContain("api.grace.getBottleComponents");
        expect(productPage).toContain("initialCompatibility");
    });
});
