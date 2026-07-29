/**
 * Volume-tier pricing policy.
 *
 * The catalog carries three price points per SKU (webPrice1pc / webPrice10pc /
 * webPrice12pc). Shopify's cart-permalink checkout, however, charges the flat
 * variant price — it has no knowledge of our quantity breaks.
 *
 * Verified against production on 2026-07-29:
 *   PKG-BOX-WHT-4X4X4 — PDP advertised $0.23/ea at 10+ ("save 34%")
 *   /cart/53343691407652:10 → Shopify checkout total $3.50 ($0.35/ea)
 *
 * 2,252 of 2,330 SKUs render a discount ladder, so shipping this as-is means
 * quoting a price the checkout does not honor. Until Shopify volume rules
 * (Plus quantity rules / an automatic quantity discount) are configured and
 * verified, tiers are presented as QUOTE pricing and never applied to a cart
 * subtotal that feeds Shopify checkout.
 *
 * Flip NEXT_PUBLIC_VOLUME_TIERS_HONORED_AT_CHECKOUT=true only after
 * re-running `node scripts/audit_price_parity.mjs` and confirming a qty-10
 * checkout total matches the advertised tier.
 */
export const VOLUME_TIERS_HONORED_AT_CHECKOUT =
    process.env.NEXT_PUBLIC_VOLUME_TIERS_HONORED_AT_CHECKOUT === "true";

export interface TierPrices {
    webPrice1pc?: number | null;
    webPrice10pc?: number | null;
    webPrice12pc?: number | null;
}

/**
 * The price a customer will ACTUALLY be charged per unit at this quantity.
 *
 * When Shopify does not honor tiers this is always the 1pc price, so cart
 * subtotals match the Shopify checkout total exactly.
 */
export function resolveChargedUnitPrice(quantity: number, prices: TierPrices): number | null {
    const p1 = prices.webPrice1pc ?? null;
    if (!VOLUME_TIERS_HONORED_AT_CHECKOUT) return p1;

    const p10 = prices.webPrice10pc ?? null;
    const p12 = prices.webPrice12pc ?? null;
    if (p12 != null && quantity >= 12) return p12;
    if (p10 != null && quantity >= 10) return p10;
    return p1;
}

/**
 * The best per-unit price obtainable at this quantity *via a quote*, used for
 * display only. Never feed this into a Shopify checkout total.
 */
export function resolveQuotedUnitPrice(quantity: number, prices: TierPrices): number | null {
    const p1 = prices.webPrice1pc ?? null;
    const p10 = prices.webPrice10pc ?? null;
    const p12 = prices.webPrice12pc ?? null;
    if (p12 != null && quantity >= 12) return p12;
    if (p10 != null && quantity >= 10) return p10;
    return p1;
}
