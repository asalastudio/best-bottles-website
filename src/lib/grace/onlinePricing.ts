import { buildDisplayVolumeTiers, type TierPrices } from "../volumePricing";

/**
 * Grace's pricing contract (Jordan, 17 Oct 2026: launch with quote-priced
 * volume tiers). Online checkout bills the product's 1–11 rate (webPrice1pc,
 * the Shopify variant price) at EVERY quantity; rates for larger quantities are
 * confirmed on a quote at /request-quote.
 *
 * On 9 Oct Grace quoted 60 × $0.84 = $50.40 for a clear Elegant SKU whose cart
 * charged 60 × $0.88 = $52.80: her tools returned webPrice10pc, webPrice12pc
 * and priceTiers next to webPrice1pc, and her prompt told her to read the tiers.
 * Every product row Grace reads now carries its price under two names a model
 * cannot mix up: `onlineUnitPrice` (billed online at any quantity) and
 * `quoteOnlyVolumeRates` (never billed online). The quote rates are the breaks
 * the product page lists (buildDisplayVolumeTiers), so Grace and the page agree.
 *
 * VOLUME_TIERS_HONORED_AT_CHECKOUT is off for launch. If it is ever turned on,
 * revisit this contract; until then Grace under-promises rather than quoting a
 * rate the checkout does not bill.
 *
 * Imported by Convex (convex/grace.ts, convex/graceSearchUtils.ts) as well as
 * the browser gateway, so keep imports relative and runtime-neutral.
 */

export type QuoteOnlyVolumeRate = {
    /** The break starts at this many pieces. */
    fromQty: number;
    /** Per-piece rate a quote confirms. Online checkout never bills it. */
    quotedUnitPrice: number;
};

export type GraceOnlinePricing = {
    /** Per-piece price online checkout bills at every quantity; null when unpriced. */
    onlineUnitPrice: number | null;
    /** Volume rates confirmed on a quote only; empty when the product has none. */
    quoteOnlyVolumeRates: QuoteOnlyVolumeRate[];
};

/** The one-line rule every Grace tool result that carries prices leads with. */
export const GRACE_ONLINE_PRICING_RULE =
    "PRICING: onlineUnitPrice is the per-piece price online checkout bills at EVERY quantity, so an online total is onlineUnitPrice × quantity; that total is what counts toward the $50 order minimum. quoteOnlyVolumeRates are NOT billed online: when a quantity reaches a break, say the volume rate is from $X each (the quotedUnitPrice of the largest fromQty at or below the quantity), confirmed on a quote at /request-quote. Never multiply a quotedUnitPrice by a quantity, and never call it an online, cart or checkout price.";

/** What getPriceStats and getFamilyOverview prices mean (they are online unit prices). */
export const GRACE_PRICE_STATS_BASIS =
    "All prices here are online unit prices: online checkout bills them per piece at every quantity. Volume rates are confirmed on a quote at /request-quote.";

const TIER_FIELDS = ["webPrice10pc", "webPrice12pc", "priceTiers"] as const;
type TierField = (typeof TIER_FIELDS)[number];

function positivePrice(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** The online price and the quote-only breaks for one product's price fields. */
export function graceOnlinePricing(prices: TierPrices): GraceOnlinePricing {
    const onlineUnitPrice = positivePrice(prices.webPrice1pc);
    if (onlineUnitPrice == null) return { onlineUnitPrice: null, quoteOnlyVolumeRates: [] };
    const quoteOnlyVolumeRates = buildDisplayVolumeTiers({
        webPrice1pc: onlineUnitPrice,
        webPrice10pc: prices.webPrice10pc ?? null,
        webPrice12pc: prices.webPrice12pc ?? null,
        priceTiers: prices.priceTiers?.map((tier) => ({ minQty: tier.minQty, unitPrice: tier.unitPrice })) ?? null,
    })
        .filter((tier) => tier.minQty > 1 && tier.unitPrice < onlineUnitPrice)
        .map((tier) => ({ fromQty: tier.minQty, quotedUnitPrice: tier.unitPrice }));
    return { onlineUnitPrice, quoteOnlyVolumeRates };
}

type PricedRow = Partial<Record<TierField, unknown>> & { webPrice1pc?: number | null } & Partial<GraceOnlinePricing>;

/**
 * A product row for a Grace tool payload: the tier columns and ladder are
 * replaced by `onlineUnitPrice` and `quoteOnlyVolumeRates`. `webPrice1pc` stays
 * for the chat cards and cart staging, which read it; it equals onlineUnitPrice.
 * A row that already carries `onlineUnitPrice` keeps its pricing as it is.
 */
export function withGraceOnlinePricing<Row extends PricedRow>(row: Row): Omit<Row, TierField> & GraceOnlinePricing {
    const { webPrice10pc, webPrice12pc, priceTiers, ...rest } = row;
    const pricing: GraceOnlinePricing = "onlineUnitPrice" in row
        ? { onlineUnitPrice: row.onlineUnitPrice ?? null, quoteOnlyVolumeRates: row.quoteOnlyVolumeRates ?? [] }
        : graceOnlinePricing({
            webPrice1pc: row.webPrice1pc ?? null,
            webPrice10pc: typeof webPrice10pc === "number" ? webPrice10pc : null,
            webPrice12pc: typeof webPrice12pc === "number" ? webPrice12pc : null,
            priceTiers: Array.isArray(priceTiers) ? priceTiers as TierPrices["priceTiers"] : null,
        });
    return { ...rest, ...pricing };
}

/**
 * A product row as the model reads it: only `onlineUnitPrice` and
 * `quoteOnlyVolumeRates`, with no `webPrice*` column whose "1pc" or "12pc"
 * suffix invites reading it as a quantity rule.
 */
export function forGraceModel<Row extends PricedRow>(row: Row): Omit<Row, TierField | "webPrice1pc"> & GraceOnlinePricing {
    const { webPrice1pc, ...rest } = withGraceOnlinePricing(row) as Omit<Row, TierField> & GraceOnlinePricing & { webPrice1pc?: unknown };
    void webPrice1pc;
    return rest as unknown as Omit<Row, TierField | "webPrice1pc"> & GraceOnlinePricing;
}

/** True when any row would show the model a price, so the result should lead with the rule. */
export function rowsCarryPrices(rows: readonly object[]): boolean {
    return rows.some((row) => "webPrice1pc" in row || "onlineUnitPrice" in row || TIER_FIELDS.some((field) => field in row));
}
