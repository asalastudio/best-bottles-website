import { describe, expect, it } from "vitest";
import {
    activeCatalogTier,
    buildCatalogCartItem,
    catalogCardStartingPrice,
    catalogCardTiers,
    catalogTierLabel,
    describeCatalogTier,
    isCatalogVariantPurchasable,
    parseCatalogQuantity,
    resolveCatalogCardPurchaseVariant,
} from "@/lib/products/catalog-card-purchase";
import type { ProductCardVariantPreviewSource } from "@/lib/products/product-card-variant-previews";

const ladder = [
    { minQty: 1, unitPrice: 0.92 },
    { minQty: 12, unitPrice: 0.76 },
    { minQty: 48, unitPrice: 0.64 },
    { minQty: 144, unitPrice: 0.56 },
    { minQty: 500, unitPrice: 0.53 },
];

const black: ProductCardVariantPreviewSource = {
    id: "v-black",
    graceSku: "CYL5-ROLL-BLK",
    websiteSku: "GBCyl5RollBlk",
    itemName: "5 ml Clear Cylinder Roll-On, Black Cap",
    capColor: "Black",
    applicator: "Roll-On",
    stockStatus: "In Stock",
    webPrice1pc: 0.92,
    priceTiers: ladder.map((tier) => ({ ...tier, totalPrice: tier.unitPrice * tier.minQty })),
    shopifyVariantId: "gid://shopify/ProductVariant/1",
    shopifySellable: true,
};
const gold: ProductCardVariantPreviewSource = {
    ...black,
    id: "v-gold",
    graceSku: "CYL5-ROLL-GLD",
    websiteSku: "GBCyl5RollGld",
    itemName: "5 ml Clear Cylinder Roll-On, Gold Cap",
    capColor: "Gold",
    webPrice1pc: 0.95,
    priceTiers: null,
    shopifyVariantId: null,
    shopifySellable: null,
};

describe("resolveCatalogCardPurchaseVariant", () => {
    const title = "5 ml Clear Cylinder Roll-On Bottle";

    it("sells the pictured SKU first, then the primary SKU, then the first priced row", () => {
        expect(resolveCatalogCardPurchaseVariant([black, gold], { picturedSku: "GBCyl5RollGld", primarySku: "GBCyl5RollBlk", productTitle: title })?.graceSku).toBe("CYL5-ROLL-GLD");
        expect(resolveCatalogCardPurchaseVariant([black, gold], { picturedSku: null, primarySku: "CYL5-ROLL-GLD", productTitle: title })?.graceSku).toBe("CYL5-ROLL-GLD");
        expect(resolveCatalogCardPurchaseVariant([{ ...gold, webPrice1pc: null }, black], { productTitle: title })?.graceSku).toBe("CYL5-ROLL-BLK");
    });

    it("skips rows without a Grace SKU and returns null for an empty group", () => {
        expect(resolveCatalogCardPurchaseVariant([{ ...black, graceSku: " " }], { productTitle: title })).toBeNull();
        expect(resolveCatalogCardPurchaseVariant([], { productTitle: title })).toBeNull();
        expect(resolveCatalogCardPurchaseVariant(undefined, { productTitle: title })).toBeNull();
    });

    it("carries the ladder as minQty/unitPrice pairs and labels the option only when there is a choice", () => {
        const multi = resolveCatalogCardPurchaseVariant([black, gold], { productTitle: title })!;
        expect(multi.priceTiers).toEqual(ladder);
        expect(multi.optionLabel).toBe("Black Roll-On");
        const single = resolveCatalogCardPurchaseVariant([black], { productTitle: title })!;
        expect(single.optionLabel).toBeNull();
    });
});

describe("isCatalogVariantPurchasable mirrors the PDP add-to-cart gate", () => {
    const variant = resolveCatalogCardPurchaseVariant([black], { productTitle: "x" })!;

    it("needs stock, a Shopify-sellable variant, and a 1-unit price", () => {
        expect(isCatalogVariantPurchasable(variant)).toBe(true);
        expect(isCatalogVariantPurchasable({ ...variant, stockStatus: "Available to order" })).toBe(true);
        expect(isCatalogVariantPurchasable({ ...variant, stockStatus: "Out of Stock" })).toBe(false);
        expect(isCatalogVariantPurchasable({ ...variant, stockStatus: null })).toBe(false);
        expect(isCatalogVariantPurchasable({ ...variant, shopifySellable: false })).toBe(false);
        expect(isCatalogVariantPurchasable({ ...variant, shopifyVariantId: null, shopifySellable: null })).toBe(false);
        expect(isCatalogVariantPurchasable({ ...variant, webPrice1pc: null })).toBe(false);
        expect(isCatalogVariantPurchasable(null)).toBe(false);
    });
});

describe("ladder and headline", () => {
    const variant = resolveCatalogCardPurchaseVariant([black], { productTitle: "x" })!;

    it("renders the five published breaks as closed ranges with savings", () => {
        const tiers = catalogCardTiers(variant);
        expect(tiers.map((tier) => [catalogTierLabel(tier), tier.unitPrice, tier.savePct])).toEqual([
            ["1–11", 0.92, 0],
            ["12–47", 0.76, 17],
            ["48–143", 0.64, 30],
            ["144–499", 0.56, 39],
            ["500+", 0.53, 42],
        ]);
        expect(activeCatalogTier(tiers, 144)?.minQty).toBe(144);
        expect(activeCatalogTier(tiers, 499)?.minQty).toBe(144);
        expect(activeCatalogTier(tiers, 500)?.minQty).toBe(500);
        expect(activeCatalogTier(tiers, null)).toBeNull();
        expect(describeCatalogTier(tiers[3])).toBe("144–499 units at $0.56 each, save 39%");
        expect(describeCatalogTier(tiers[0])).toBe("1–11 units at $0.92 each");
    });

    it("headlines the deepest break, else the 1-unit price, else the group floor", () => {
        expect(catalogCardStartingPrice(variant, catalogCardTiers(variant), 0.4)).toBe(0.53);
        const flat = { ...variant, priceTiers: null, webPrice10pc: null, webPrice12pc: null };
        expect(catalogCardTiers(flat)).toEqual([]);
        expect(catalogCardStartingPrice(flat, [], 0.4)).toBe(0.92);
        expect(catalogCardStartingPrice(null, [], 0.4)).toBe(0.4);
        expect(catalogCardStartingPrice(null, [], null)).toBeNull();
    });
});

describe("parseCatalogQuantity", () => {
    it("accepts whole numbers from 1 and explains everything else", () => {
        expect(parseCatalogQuantity("144")).toEqual({ qty: 144, error: null });
        expect(parseCatalogQuantity(" 12 ")).toEqual({ qty: 12, error: null });
        expect(parseCatalogQuantity("0").error).toMatch(/1 or more/);
        expect(parseCatalogQuantity("").error).toMatch(/1 or more/);
        expect(parseCatalogQuantity("12.5").error).toMatch(/whole numbers/i);
        expect(parseCatalogQuantity("-3").error).toMatch(/whole numbers/i);
        expect(parseCatalogQuantity("100000").error).toMatch(/request a quote/i);
    });
});

describe("buildCatalogCartItem", () => {
    it("sends the same line-item shape as the PDP so the cart policy decides the charged rate", () => {
        const variant = resolveCatalogCardPurchaseVariant([black, gold], { picturedSku: "GBCyl5RollBlk", productTitle: "x" })!;
        const item = buildCatalogCartItem(variant, 144, {
            title: "5 ml Clear Cylinder Roll-On Bottle",
            productGroupSlug: "cylinder-5ml-clear-roll-on",
            family: "Cylinder",
            capacity: "5 ml",
            color: "Clear",
            category: "Bottle",
            neckThreadSize: "13-415",
        });
        expect(item).toMatchObject({
            graceSku: "CYL5-ROLL-BLK",
            websiteSku: "GBCyl5RollBlk",
            itemName: "5 ml Clear Cylinder Roll-On Bottle",
            quantity: 144,
            unitPrice: 0.92,
            webPrice1pc: 0.92,
            priceTiers: ladder,
            checkoutEligible: true,
            shopifyVariantId: "gid://shopify/ProductVariant/1",
            productGroupSlug: "cylinder-5ml-clear-roll-on",
            capColor: "Black",
            neckThreadSize: "13-415",
        });
    });
});
