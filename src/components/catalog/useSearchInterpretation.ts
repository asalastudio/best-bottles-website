"use client";

import { useEffect, useRef, useState } from "react";
import type { CatalogFilters } from "@/lib/catalogFilters";
import type { InterpretationMode, InterpretationSuggestion } from "@/lib/catalog/searchSuggestionLabel";

/** Wait for the shopper to stop typing before asking; typed half-words must never trigger a reading. */
export const INTERPRET_IDLE_MS = 1000;

export type SearchInterpretationState = {
    status: "idle" | "pending" | "ready" | "none";
    query: string;
    mode: InterpretationMode;
    suggestions: InterpretationSuggestion[];
};

const IDLE: SearchInterpretationState = { status: "idle", query: "", mode: "off", suggestions: [] };

type Options = {
    /** Server flag (CATALOG_SEARCH_INTERPRETATION); "off" disables everything. */
    mode: InterpretationMode;
    /** False for Grace navigations, the Spanish site, and `interpret=off` URLs. */
    allowed: boolean;
    /** The applied search (URL state), not the input box. */
    query: string;
    /** What the search box currently shows. */
    searchInput: string;
    filters: CatalogFilters;
    /** The page has finished loading and shows no products at all. */
    noResults: boolean;
    locale: string;
    /** Queries the shopper already turned down (Undo). */
    declined: ReadonlySet<string>;
};

function eligible(options: Options): boolean {
    const query = options.query.trim();
    return options.mode !== "off"
        && options.allowed
        && options.noResults
        && query.length > 0
        && options.searchInput.trim() === query
        && !options.declined.has(query.toLowerCase());
}

/**
 * Asks /api/catalog/interpret for "closest matches" once a search has found
 * nothing and the query has settled. Any failure leaves today's empty page.
 */
export function useSearchInterpretation(options: Options): SearchInterpretationState {
    // First render matches the server render: "pending" when a reading will be requested.
    const [state, setState] = useState<SearchInterpretationState>(() =>
        eligible(options) ? { status: "pending", query: options.query.trim(), mode: options.mode, suggestions: [] } : IDLE,
    );
    const cacheRef = useRef(new Map<string, SearchInterpretationState>());
    const isEligible = eligible(options);
    const query = options.query.trim();
    const filtersKey = JSON.stringify(options.filters);
    const { locale, mode } = options;

    useEffect(() => {
        if (!isEligible) {
            setState((prev) => (prev.status === "idle" ? prev : IDLE)); // eslint-disable-line react-hooks/set-state-in-effect
            return;
        }
        const cacheKey = `${locale}:${query.toLowerCase()}:${filtersKey}`;
        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
            setState(cached);
            return;
        }
        setState({ status: "pending", query, mode, suggestions: [] });
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            fetch("/api/catalog/interpret", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, filters: JSON.parse(filtersKey) as CatalogFilters, locale }),
                signal: controller.signal,
            })
                .then((response) => (response.ok ? response.json() : null))
                .then((body: { mode?: InterpretationMode; suggestions?: InterpretationSuggestion[] } | null) => {
                    const suggestions = Array.isArray(body?.suggestions) ? body.suggestions : [];
                    const next: SearchInterpretationState = {
                        status: suggestions.length > 0 ? "ready" : "none",
                        query,
                        mode: body?.mode ?? mode,
                        suggestions,
                    };
                    cacheRef.current.set(cacheKey, next);
                    setState(next);
                })
                .catch((error: unknown) => {
                    if (error instanceof DOMException && error.name === "AbortError") return;
                    setState({ status: "none", query, mode, suggestions: [] });
                });
        }, INTERPRET_IDLE_MS);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [isEligible, query, filtersKey, locale, mode]);

    return state;
}
