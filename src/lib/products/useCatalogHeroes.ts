"use client";

import { useEffect, useState } from "react";
import { registerCatalogHeroes, type CatalogHeroSubset } from "./catalog-heroes";

/** One request per SKU per page load, shared by every component that asks for it. */
const pending = new Map<string, Promise<void>>();

function ensureCatalogHeroes(skus: readonly string[]): Promise<void> {
    const missing = skus.filter(sku => !pending.has(sku));
    if (missing.length > 0) {
        const query = missing.map(sku => `sku=${encodeURIComponent(sku)}`).join("&");
        const request = fetch(`/api/catalog/heroes?${query}`)
            .then(response => (response.ok ? response.json() as Promise<{ catalogHeroes?: CatalogHeroSubset }> : null))
            .then(body => registerCatalogHeroes(body?.catalogHeroes))
            .catch(() => {
                // Offline or failed: let a later render ask again.
                for (const sku of missing) pending.delete(sku);
            });
        for (const sku of missing) pending.set(sku, request);
    }
    return Promise.all(skus.map(sku => pending.get(sku))).then(() => undefined);
}

/**
 * Fetch and register the hero rows for SKUs that reach the browser without a
 * server payload (cart lines). Returns a counter that changes once the rows are
 * registered, so the caller re-renders and its hero lookups resolve.
 */
export function useCatalogHeroesForSkus(skus: readonly (string | null | undefined)[]): number {
    const key = [...new Set(skus.map(sku => sku?.trim()).filter((sku): sku is string => Boolean(sku)))].sort().join("\n");
    const [registered, setRegistered] = useState(0);
    useEffect(() => {
        if (!key) return;
        let active = true;
        void ensureCatalogHeroes(key.split("\n")).then(() => {
            if (active) setRegistered(count => count + 1);
        });
        return () => { active = false; };
    }, [key]);
    return registered;
}
