"use client";

import { useEffect, useState } from "react";
import { registerCatalogHeroes, type CatalogHeroSubset } from "./catalog-heroes";

/** One request per SKU per page load, shared by every component that asks for it. Resolves false when it failed. */
const pending = new Map<string, Promise<boolean>>();

function ensureCatalogHeroes(skus: readonly string[]): Promise<boolean> {
    const missing = skus.filter(sku => !pending.has(sku));
    if (missing.length > 0) {
        const query = missing.map(sku => `sku=${encodeURIComponent(sku)}`).join("&");
        const request = fetch(`/api/catalog/heroes?${query}`)
            .then(response => {
                if (!response.ok) throw new Error(`Catalog hero request failed with HTTP ${response.status}`);
                return response.json() as Promise<{ catalogHeroes?: CatalogHeroSubset }>;
            })
            .then(body => {
                registerCatalogHeroes(body?.catalogHeroes);
                return true;
            })
            .catch(() => {
                // Offline or an HTTP error: forget the request so a later attempt asks again.
                for (const sku of missing) pending.delete(sku);
                return false;
            });
        for (const sku of missing) pending.set(sku, request);
    }
    return Promise.all(skus.map(sku => pending.get(sku) ?? Promise.resolve(false))).then(results => results.every(Boolean));
}

/**
 * Fetch and register the hero rows for SKUs that reach the browser without a
 * server payload (cart lines). Returns a counter that changes once the rows are
 * registered, so the caller re-renders and its hero lookups resolve. A failed
 * request is asked again when the browser comes back online.
 */
export function useCatalogHeroesForSkus(skus: readonly (string | null | undefined)[]): number {
    const key = [...new Set(skus.map(sku => sku?.trim()).filter((sku): sku is string => Boolean(sku)))].sort().join("\n");
    const [registered, setRegistered] = useState(0);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!key) return;
        let active = true;
        let stopWaiting: (() => void) | null = null;
        void ensureCatalogHeroes(key.split("\n")).then(ok => {
            if (!active) return;
            if (ok) {
                setRegistered(count => count + 1);
                return;
            }
            const retry = () => setAttempt(count => count + 1);
            window.addEventListener("online", retry, { once: true });
            stopWaiting = () => window.removeEventListener("online", retry);
        });
        return () => {
            active = false;
            stopWaiting?.();
        };
    }, [key, attempt]);
    return registered;
}
