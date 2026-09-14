"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
    DEFAULT_MARKET_CODE,
    REGION_COOKIE,
    formatMoney,
    getMarket,
    isEstimate,
    isMarketCode,
    type FormatMoneyOptions,
    type Market,
    type MarketCode,
} from "@/lib/region";

interface RegionContextValue {
    market: Market;
    /** True when displayed prices are converted estimates (orders settle in USD). */
    estimate: boolean;
    setMarket: (code: MarketCode) => void;
    /** Format a USD amount in the active market's currency. */
    formatPrice: (usd: number, options?: FormatMoneyOptions) => string;
}

const RegionContext = createContext<RegionContextValue | null>(null);

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function RegionProvider({ children, initialMarketCode }: { children: ReactNode; initialMarketCode?: string | null }) {
    const [code, setCode] = useState<MarketCode>(isMarketCode(initialMarketCode) ? initialMarketCode : DEFAULT_MARKET_CODE);

    const setMarket = useCallback((next: MarketCode) => {
        setCode(next);
        try {
            document.cookie = `${REGION_COOKIE}=${next}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
        } catch {
            /* cookies unavailable (private mode / SSR) — selection lives for the session */
        }
    }, []);

    const value = useMemo<RegionContextValue>(() => {
        const market = getMarket(code);
        return {
            market,
            estimate: isEstimate(market),
            setMarket,
            formatPrice: (usd, options) => formatMoney(usd, market, options),
        };
    }, [code, setMarket]);

    return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

const FALLBACK: RegionContextValue = {
    market: getMarket(DEFAULT_MARKET_CODE),
    estimate: false,
    setMarket: () => undefined,
    formatPrice: (usd, options) => formatMoney(usd, getMarket(DEFAULT_MARKET_CODE), options),
};

/** Active market + price formatter. Safe outside the provider (falls back to USD). */
export function useRegion(): RegionContextValue {
    return useContext(RegionContext) ?? FALLBACK;
}
