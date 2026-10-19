"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

    // The root layout no longer reads cookies, so a returning buyer's market
    // is applied after the first paint. USD is the server HTML.
    useEffect(() => {
        if (isMarketCode(initialMarketCode)) return;
        const match = document.cookie.match(new RegExp(`(?:^|; )${REGION_COOKIE}=([^;]*)`));
        const value = match?.[1] ? decodeURIComponent(match[1]) : null;
        if (isMarketCode(value)) setCode(value); // eslint-disable-line react-hooks/set-state-in-effect -- cookie is not available during SSR
    }, [initialMarketCode]);

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
