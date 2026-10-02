import { resolveQuotedUnitPrice } from "@/lib/volumePricing";
import { parseCatalogQuantity, type CatalogPurchaseVariant } from "@/lib/products/catalog-card-purchase";

/** Published order-pad estimate. Same resolver as server draft repricing.
 * This is not a claim of authenticated native Shopify context/checkout approval.
 */
export function portalCatalogPrice(variant: CatalogPurchaseVariant | null | undefined, quantityText: string) {
    const { qty, error } = parseCatalogQuantity(quantityText);
    if (!variant || qty === null) return { quantity: qty, unitPrice: null, total: null, error };
    const unitPrice = resolveQuotedUnitPrice(qty, variant);
    if (unitPrice === null || !Number.isFinite(unitPrice) || unitPrice <= 0) {
        return { quantity: qty, unitPrice: null, total: null, error: "Published pricing is unavailable." };
    }
    return { quantity: qty, unitPrice, total: Math.round(unitPrice * 100) * qty / 100, error: null };
}
