// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const SKU = "GBSpry3mlClBlk";
const hero = { groupSlug: "cylinder-3.3ml-clear-12mm-finemist", websiteSku: SKU, url: "/images/hero.png" };

async function freshModules() {
    vi.resetModules();
    const core = await import("@/lib/products/catalog-heroes");
    const { useCatalogHeroesForSkus } = await import("@/lib/products/useCatalogHeroes");
    return { core, useCatalogHeroesForSkus };
}

async function settle() {
    for (let i = 0; i < 5; i++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

describe("useCatalogHeroesForSkus", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("asks again after an HTTP error, and registers the row once the endpoint recovers", async () => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response("busy", { status: 503 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ catalogHeroes: { original: [[0, hero]], pilot: [], complete: [] } }), { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);
        const { core, useCatalogHeroesForSkus } = await freshModules();
        function Line() {
            useCatalogHeroesForSkus([SKU]);
            return <span>{core.getProductHero(SKU)?.url ?? ""}</span>;
        }
        const container = document.createElement("div");
        const root = createRoot(container);
        const url = () => container.textContent || null;
        await act(async () => root.render(<Line />));
        await settle();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(url()).toBeNull();
        // The failed request was not kept as answered: coming back online asks again.
        await act(async () => { window.dispatchEvent(new Event("online")); });
        await settle();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(url()).toBe("/images/hero.png");
        await act(async () => root.unmount());
    });

    it("retries an offline failure when the browser is back online", async () => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce(new Response(JSON.stringify({ catalogHeroes: { original: [[0, hero]], pilot: [], complete: [] } }), { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);
        const { core, useCatalogHeroesForSkus } = await freshModules();
        function Line() {
            useCatalogHeroesForSkus([SKU]);
            return <span>{core.getProductHero(SKU)?.url ?? ""}</span>;
        }
        const container = document.createElement("div");
        const root = createRoot(container);
        const url = () => container.textContent || null;
        await act(async () => root.render(<Line />));
        await settle();
        expect(url()).toBeNull();
        await act(async () => { window.dispatchEvent(new Event("online")); });
        await settle();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(url()).toBe("/images/hero.png");
        await act(async () => root.unmount());
    });
});
