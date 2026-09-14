/**
 * Markets + display currencies for the storefront.
 *
 * Shopify (Plus, store currency USD) settles every order in USD until Shopify
 * Markets is enabled. Until then, non-USD prices are ESTIMATES converted with
 * the rates below, and the selector says so. When Markets goes live, replace
 * `rate` with presentment prices from the Storefront API (@inContext) and drop
 * the estimate notice.
 */
export type MarketCode = "US" | "CA" | "GB" | "EU" | "AU" | "AE";

export interface Market {
    code: MarketCode;
    country: string;
    currency: string;
    symbol: string;
    locale: string;
    /** Units of this currency per 1 USD. */
    rate: number;
}

export const RATES_AS_OF = "2026-09-13";

export const MARKETS: readonly Market[] = [
    { code: "US", country: "United States", currency: "USD", symbol: "$", locale: "en-US", rate: 1 },
    { code: "CA", country: "Canada", currency: "CAD", symbol: "$", locale: "en-CA", rate: 1.36 },
    { code: "GB", country: "United Kingdom", currency: "GBP", symbol: "£", locale: "en-GB", rate: 0.78 },
    { code: "EU", country: "European Union", currency: "EUR", symbol: "€", locale: "en-IE", rate: 0.92 },
    { code: "AU", country: "Australia", currency: "AUD", symbol: "$", locale: "en-AU", rate: 1.52 },
    { code: "AE", country: "United Arab Emirates", currency: "AED", symbol: "د.إ", locale: "en-AE", rate: 3.67 },
] as const;

export const DEFAULT_MARKET_CODE: MarketCode = "US";
export const REGION_COOKIE = "bb_market";

export function isMarketCode(value: unknown): value is MarketCode {
    return typeof value === "string" && MARKETS.some((m) => m.code === value);
}

export function getMarket(code: string | null | undefined): Market {
    return MARKETS.find((m) => m.code === code) ?? MARKETS[0];
}

export function isEstimate(market: Market): boolean {
    return market.currency !== "USD";
}

export function convertUsd(usd: number, market: Market): number {
    return usd * market.rate;
}

export interface FormatMoneyOptions {
    /** Drop cents when the converted amount is a whole number. Default false. */
    trimZeros?: boolean;
}

/** Format a USD amount in the market's currency, e.g. 3.05 → "CA$4.15" / "£2.38". */
export function formatMoney(usd: number, market: Market, options: FormatMoneyOptions = {}): string {
    const amount = convertUsd(usd, market);
    // en-US + "symbol" yields unambiguous prefixes across markets: $, CA$, £, €, A$, AED.
    const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: market.currency,
        currencyDisplay: "symbol",
        minimumFractionDigits: options.trimZeros && Number.isInteger(amount) ? 0 : 2,
        maximumFractionDigits: 2,
    });
    return formatter.format(amount);
}
