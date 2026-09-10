/**
 * Grid-card purchase model.
 *
 * Everything the catalog card needs to sell one assembly without opening the
 * PDP: which variant the card sells, whether it can be added to the cart, the
 * published quantity-break ladder, and the quantity the customer typed.
 *
 * Pricing math lives in `src/lib/volumePricing.ts`; the checkout gate lives in
 * `src/lib/checkout.ts`. This module composes them and never restates a price.
 */

import type { CartItem } from "@/components/CartProvider";
import { isCheckoutReady } from "@/lib/checkout";
import {
    activeVolumeTierIndex,
    buildDisplayVolumeTiers,
    formatVolumeQtyRange,
    type DisplayVolumeTier,
    type PublishedTier,
} from "@/lib/volumePricing";
import {
    getProductCardVariantPreviews,
    type ProductCardVariantPreviewSource,
} from "./product-card-variant-previews";

export const CATALOG_QUANTITY_MAX = 99_999;

export type CatalogPurchaseVariant = {
    id: string;
    graceSku: string;
    websiteSku: string | null;
    itemName: string | null;
    /** Short assembly label ("Shiny Black Cap") when the group offers more than one; null otherwise. */
    optionLabel: string | null;
    applicator: string | null;
    capColor: string | null;
    stockStatus: string | null;
    caseQuantity: number | null;
    webPrice1pc: number | null;
    webPrice10pc: number | null;
    webPrice12pc: number | null;
    priceTiers: PublishedTier[] | null;
    shopifyVariantId: string | null;
    shopifySellable: boolean | null;
};

type Source = ProductCardVariantPreviewSource;

function skuMatches(variant: Source, sku: string | null | undefined): boolean {
    if (!sku) return false;
    return variant.websiteSku === sku || variant.graceSku === sku;
}

/**
 * The assembly a card sells: the pictured SKU first, then the group's primary
 * SKU, then the first priced row. Rows without a Grace SKU are skipped because
 * the cart keys line items on it.
 */
export function resolveCatalogCardPurchaseVariant(
    rows: Source[] | null | undefined,
    options: { picturedSku?: string | null; primarySku?: string | null; productTitle: string },
): CatalogPurchaseVariant | null {
    const candidates = (rows ?? []).filter((row) => typeof row.graceSku === "string" && row.graceSku.trim().length > 0);
    if (candidates.length === 0) return null;
    const source = candidates.find((row) => skuMatches(row, options.picturedSku))
        ?? candidates.find((row) => skuMatches(row, options.primarySku))
        ?? candidates.find((row) => (row.webPrice1pc ?? 0) > 0)
        ?? candidates[0];
    const graceSku = source.graceSku!.trim();
    const optionLabel = candidates.length > 1
        ? getProductCardVariantPreviews([source], { productTitle: options.productTitle })[0]?.label
            ?? source.websiteSku
            ?? graceSku
        : null;
    return {
        id: source.id ?? graceSku,
        graceSku,
        websiteSku: source.websiteSku ?? null,
        itemName: source.itemName ?? null,
        optionLabel,
        applicator: source.applicator ?? null,
        capColor: source.capColor ?? null,
        stockStatus: source.stockStatus ?? null,
        caseQuantity: source.caseQuantity ?? null,
        webPrice1pc: source.webPrice1pc ?? null,
        webPrice10pc: source.webPrice10pc ?? null,
        webPrice12pc: source.webPrice12pc ?? null,
        priceTiers: source.priceTiers?.map((tier) => ({ minQty: tier.minQty, unitPrice: tier.unitPrice })) ?? null,
        shopifyVariantId: source.shopifyVariantId ?? null,
        shopifySellable: source.shopifySellable ?? null,
    };
}

export function catalogVariantInStock(variant: Pick<CatalogPurchaseVariant, "stockStatus">): boolean {
    return variant.stockStatus === "In Stock" || variant.stockStatus === "Available to order";
}

/** Mirrors the PDP add-to-cart gate: in stock, Shopify-sellable, and priced. */
export function isCatalogVariantPurchasable(variant: CatalogPurchaseVariant | null | undefined): variant is CatalogPurchaseVariant {
    if (!variant || variant.webPrice1pc == null || variant.webPrice1pc <= 0) return false;
    if (!catalogVariantInStock(variant)) return false;
    return isCheckoutReady({
        graceSku: variant.graceSku,
        shopifyVariantId: variant.shopifyVariantId ?? null,
        shopifySellable: variant.shopifySellable ?? undefined,
    });
}

/** The published ladder as closed display rows; empty when the row has no breaks. */
export function catalogCardTiers(variant: CatalogPurchaseVariant | null | undefined): DisplayVolumeTier[] {
    if (!variant?.webPrice1pc) return [];
    return buildDisplayVolumeTiers({
        webPrice1pc: variant.webPrice1pc,
        webPrice10pc: variant.webPrice10pc,
        webPrice12pc: variant.webPrice12pc,
        priceTiers: variant.priceTiers,
    });
}

/**
 * The card's headline "From" rate: the deepest published break, else the
 * variant's 1-unit price, else the group's lowest 1-unit price.
 */
export function catalogCardStartingPrice(
    variant: CatalogPurchaseVariant | null | undefined,
    tiers: DisplayVolumeTier[],
    groupStartingPrice: number | null | undefined,
): number | null {
    const deepest = tiers[tiers.length - 1];
    if (deepest) return deepest.unitPrice;
    if (variant?.webPrice1pc) return variant.webPrice1pc;
    return groupStartingPrice ?? null;
}

export type CatalogQuantityParse = { qty: number | null; error: string | null };

/** Whole numbers from 1 to CATALOG_QUANTITY_MAX; everything else carries a customer-facing message. */
export function parseCatalogQuantity(raw: string): CatalogQuantityParse {
    const text = raw.trim();
    if (text === "") return { qty: null, error: "Enter a quantity of 1 or more." };
    if (!/^\d+$/.test(text)) return { qty: null, error: "Use whole numbers only." };
    const qty = Number(text);
    if (qty < 1) return { qty: null, error: "Enter a quantity of 1 or more." };
    if (qty > CATALOG_QUANTITY_MAX) {
        return { qty: null, error: `For more than ${CATALOG_QUANTITY_MAX.toLocaleString("en-US")} units, request a quote.` };
    }
    return { qty, error: null };
}

export function activeCatalogTier(tiers: DisplayVolumeTier[], qty: number | null): DisplayVolumeTier | null {
    if (tiers.length === 0 || qty == null) return null;
    return tiers[activeVolumeTierIndex(tiers, qty)] ?? null;
}

/** Analytics label for a tier ("144–499", "500+"); null when no ladder applies. */
export function catalogTierLabel(tier: DisplayVolumeTier | null | undefined): string | null {
    return tier ? formatVolumeQtyRange(tier.minQty, tier.maxQty) : null;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

/** Screen-reader sentence for a tier row. */
export function describeCatalogTier(tier: DisplayVolumeTier): string {
    const base = `${formatVolumeQtyRange(tier.minQty, tier.maxQty)} units at ${usd.format(tier.unitPrice)} each`;
    return tier.savePct > 0 ? `${base}, save ${tier.savePct}%` : base;
}

export type CatalogCartContext = {
    title: string;
    productGroupSlug: string;
    family: string | null;
    capacity: string | null;
    color: string | null;
    category: string | null;
    neckThreadSize: string | null;
};

/** Same line-item shape the PDP sends, so the cart's tier nudge and checkout split behave identically. */
export function buildCatalogCartItem(variant: CatalogPurchaseVariant, quantity: number, context: CatalogCartContext): CartItem {
    return {
        graceSku: variant.graceSku,
        itemName: context.title,
        quantity,
        unitPrice: variant.webPrice1pc,
        checkoutEligible: true,
        shopifyVariantId: variant.shopifyVariantId,
        shopifySellable: variant.shopifySellable ?? undefined,
        websiteSku: variant.websiteSku,
        variantId: variant.id,
        productGroupSlug: context.productGroupSlug,
        family: context.family ?? undefined,
        capacity: context.capacity ?? undefined,
        color: context.color ?? undefined,
        applicator: variant.applicator,
        capColor: variant.capColor,
        category: context.category,
        neckThreadSize: context.neckThreadSize,
        webPrice1pc: variant.webPrice1pc,
        webPrice10pc: variant.webPrice10pc,
        webPrice12pc: variant.webPrice12pc,
        priceTiers: variant.priceTiers,
    };
}
