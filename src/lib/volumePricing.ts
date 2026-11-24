/**
 * Volume-tier pricing policy.
 *
 * The catalog carries the complete published `priceTiers` ladder plus legacy
 * webPrice1pc / webPrice10pc / webPrice12pc columns. Shopify checkout
 * (Storefront Cart or cart permalink) charges the flat variant price — it
 * has no knowledge of our quantity breaks.
 *
 * Verified against production on 2026-07-29:
 *   PKG-BOX-WHT-4X4X4 — PDP advertised $0.23/ea at 10+ ("save 34%")
 *   qty 10 of PKG-BOX-WHT-4X4X4 → Shopify checkout total $3.50 ($0.35/ea)
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
    priceTiers?: PublishedTier[] | null;
}

export type PublishedTier = {
    minQty: number;
    unitPrice: number;
    /** The set's published total ("Set of 144 – $77.76"), when the ladder carries one; more exact than minQty × a rounded unit price. */
    totalPrice?: number;
};

export type DisplayVolumeTier = {
    minQty: number;
    maxQty: number | null;
    unitPrice: number;
    /** What one set of `minQty` pieces costs, as the "Set of" menu shows it. */
    packPrice: number;
    savePct: number;
    saveEach: number;
    appliesAtCheckout: boolean;
};

/**
 * Baymard-ready quantity-break rows: closed ranges, unit price, savings vs 1-pc,
 * and whether Shopify checkout will honor the rate.
 */
export function buildDisplayVolumeTiers(prices: TierPrices & {
    priceTiers?: PublishedTier[] | null;
}): DisplayVolumeTier[] {
    const p1 = prices.webPrice1pc ?? null;
    if (p1 == null || p1 <= 0) return [];

    const published = (prices.priceTiers ?? [])
        .filter((tier) => tier.unitPrice > 0)
        .sort((a, b) => a.minQty - b.minQty);

    let raw: PublishedTier[];
    if (published.length >= 2 && published[0]?.minQty === 1) {
        raw = published;
    } else {
        raw = [{ minQty: 1, unitPrice: p1 }];
        if (prices.webPrice10pc && prices.webPrice10pc < p1) {
            raw.push({ minQty: 10, unitPrice: prices.webPrice10pc });
        }
        if (prices.webPrice12pc && prices.webPrice12pc < p1) {
            raw.push({ minQty: 12, unitPrice: prices.webPrice12pc });
        }
    }

    if (raw.length < 2) return [];

    const list = raw[0]?.unitPrice ?? p1;
    return raw.map((tier, index) => {
        const next = raw[index + 1];
        const saveEach = Math.max(0, Math.round((list - tier.unitPrice) * 100) / 100);
        return {
            minQty: tier.minQty,
            maxQty: next ? next.minQty - 1 : null,
            unitPrice: tier.unitPrice,
            packPrice: tier.totalPrice != null && Number.isFinite(tier.totalPrice) && tier.totalPrice > 0
                ? tier.totalPrice
                : Math.round(tier.minQty * tier.unitPrice * 100) / 100,
            savePct: list > 0 && tier.minQty > 1 ? Math.max(0, Math.round((saveEach / list) * 100)) : 0,
            saveEach,
            appliesAtCheckout: VOLUME_TIERS_HONORED_AT_CHECKOUT || tier.minQty === 1,
        };
    });
}

/**
 * One "Set of" menu line, the legacy site's pack menu worded as sets (Jordan, 20 Nov 2026):
 * "Set of 1 – $0.60 each", "Set of 12 – $6.84 ($0.57 each)".
 */
export function packOptionLabel(tier: Pick<DisplayVolumeTier, "minQty" | "unitPrice" | "packPrice">, formatPrice: (usd: number) => string): string {
    const set = `Set of ${tier.minQty.toLocaleString("en-US")}`;
    return tier.minQty === 1
        ? `${set} – ${formatPrice(tier.unitPrice)} each`
        : `${set} – ${formatPrice(tier.packPrice)} (${formatPrice(tier.unitPrice)} each)`;
}

/**
 * The quantity a buyer chose, read back as packs: a total that is whole packs of
 * a published size (144 = 1 × 144) opens on that pack; anything else is single pieces.
 */
export function packSelectionFromQuantity(tiers: Pick<DisplayVolumeTier, "minQty">[], quantity: number): { packIndex: number; packs: number } {
    for (let index = tiers.length - 1; index > 0; index--) {
        const size = tiers[index].minQty;
        if (size > 1 && quantity >= size && quantity % size === 0) return { packIndex: index, packs: quantity / size };
    }
    return { packIndex: 0, packs: Math.max(1, quantity) };
}

export function formatVolumeQtyRange(minQty: number, maxQty: number | null): string {
    const min = minQty.toLocaleString("en-US");
    if (maxQty == null) return `${min}+`;
    if (maxQty === minQty) return min;
    return `${min}–${maxQty.toLocaleString("en-US")}`;
}

export function activeVolumeTierIndex(tiers: DisplayVolumeTier[], qty: number): number {
    return tiers.reduce((acc, tier, index) => (qty >= tier.minQty ? index : acc), 0);
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

    return resolveVolumeTierUnitPrice(quantity, prices);
}

export type CartVolumeNudge = { units: number; targetQty: number; price: number; savePct: number };

/**
 * The cart's "Add N more to unlock 12+ pricing at $X/ea" line. Shown only when checkout charges that tier: while
 * Shopify bills the flat rate, adding units never reaches the promised price (the product page already stays
 * quiet in that case and says volume rates are quoted).
 */
export function cartVolumeNudge(
    quantity: number,
    prices: TierPrices & { unitPrice?: number | null },
    honored: boolean = VOLUME_TIERS_HONORED_AT_CHECKOUT,
): CartVolumeNudge | null {
    if (!honored) return null;
    const p1 = prices.webPrice1pc ?? prices.unitPrice ?? 0;
    const p10 = prices.webPrice10pc ?? null;
    const p12 = prices.webPrice12pc ?? null;
    if (p1 <= 0) return null;
    if (p12 != null && quantity < 12 && (p10 == null || quantity >= 10)) {
        const savePct = Math.round((1 - p12 / p1) * 100);
        return savePct > 0 ? { units: 12 - quantity, targetQty: 12, price: p12, savePct } : null;
    }
    if (p10 != null && quantity < 10) {
        const savePct = Math.round((1 - p10 / p1) * 100);
        return savePct > 0 ? { units: 10 - quantity, targetQty: 10, price: p10, savePct } : null;
    }
    return null;
}

/**
 * The best per-unit price obtainable at this quantity *via a quote*, used for
 * display only. Never feed this into a Shopify checkout total.
 */
export function resolveQuotedUnitPrice(quantity: number, prices: TierPrices): number | null {
    return resolveVolumeTierUnitPrice(quantity, prices);
}

/**
 * Resolve the published unit rate at a quantity from the complete site-truth
 * ladder. Older rows without `priceTiers` retain the 10/12-column fallback.
 */
export function resolveVolumeTierUnitPrice(quantity: number, prices: TierPrices): number | null {
    const p1 = prices.webPrice1pc ?? null;
    const published = (prices.priceTiers ?? [])
        .filter((tier) =>
            Number.isFinite(tier.minQty)
            && tier.minQty >= 1
            && Number.isFinite(tier.unitPrice)
            && tier.unitPrice > 0
            && tier.minQty <= quantity
        )
        .sort((a, b) => a.minQty - b.minQty);
    const activePublished = published[published.length - 1];
    if (activePublished) return activePublished.unitPrice;

    const p10 = prices.webPrice10pc ?? null;
    const p12 = prices.webPrice12pc ?? null;
    if (p12 != null && quantity >= 12) return p12;
    if (p10 != null && quantity >= 10) return p10;
    return p1;
}
