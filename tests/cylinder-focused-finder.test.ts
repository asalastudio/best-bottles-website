// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CylinderFamilyPageClient from "@/app/catalog/cylinder/CylinderFamilyPageClient";
import CylinderFamilyPage from "@/app/catalog/cylinder/page";
import type { CatalogSearchResultShape } from "@/lib/catalogSearchFallback";
import type { CatalogSearchArgs } from "@/lib/catalogServer";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
    clientSearch: vi.fn(),
    routerPush: vi.fn(),
    routerReplace: vi.fn(),
    serverSearch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mocks.routerPush, replace: mocks.routerReplace }),
}));

vi.mock("@/lib/catalogServer", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/catalogServer")>();
    return { ...actual, searchCatalogServer: mocks.serverSearch };
});

vi.mock("@/lib/catalogSearchClient", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/catalogSearchClient")>();
    return { ...actual, fetchCatalogSearch: mocks.clientSearch };
});

vi.mock("@/sanity/lib/queries", () => ({
    getProductFamilyPageContent: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/components/CartProvider", () => ({
    useCart: () => ({ itemCount: 0, isCartHydrated: true }),
}));
vi.mock("@/components/CartDrawer", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => createElement("footer", null, "Footer") }));

function result(input: {
    id: string;
    name: string;
    applicator: string;
    applicatorFacets?: Record<string, number>;
    capacityMl?: number;
}): CatalogSearchResultShape {
    const capacityMl = input.capacityMl ?? 9;
    const capacity = `${capacityMl} ml`;
    return {
        items: [{
            _id: input.id,
            slug: input.id,
            displayName: input.name,
            family: "Cylinder",
            capacity,
            capacityMl,
            color: "Clear",
            category: "Glass Bottle",
            bottleCollection: null,
            neckThreadSize: "17-415",
            variantCount: 1,
            priceRangeMin: 0.72,
            priceRangeMax: 0.72,
            heroImageUrl: "https://cdn.shopify.com/cylinder.png",
            paperDollFamilyKey: "CYL-9ML",
            applicatorTypes: [input.applicator],
        }],
        facets: {
            categories: { "Glass Bottle": 1 },
            collections: {},
            applicators: input.applicatorFacets ?? { rollon: 1 },
            rollerMaterials: { metal: 1, plastic: 1 },
            families: { Cylinder: 1 },
            colors: { Clear: 1 },
            capacities: { [capacity]: { label: capacity, ml: capacityMl, count: 1 } },
            neckThreadSizes: { "17-415": 1 },
            componentTypes: {},
            priceRange: { min: 0.72, max: 0.72 },
        },
        totalCount: 1,
        nextCursor: null,
        primarySkus: [{ groupId: input.id, websiteSku: "GB-CYL", graceSku: "GB-CYL" }],
        variantPreviewRows: [{
            groupId: input.id,
            variants: [{
                id: `${input.id}-variant`,
                itemName: input.name,
                websiteSku: "GB-CYL",
                graceSku: "GB-CYL",
                imageUrl: "https://cdn.shopify.com/cylinder.png",
                imageUrlCapOff: null,
                color: "Clear",
                applicator: input.applicator,
                capColor: "Black",
                trimColor: null,
                capStyle: null,
                capHeight: null,
                ballMaterial: input.applicator.includes("Metal") ? "Metal" : null,
                stockStatus: "In Stock",
                caseQuantity: 144,
                webPrice1pc: 0.72,
                shopifyVariantId: "gid://shopify/ProductVariant/1",
                shopifySellable: true,
            }],
        }],
    };
}

const allCylinderResult = result({
    id: "cylinder-9ml-spray",
    name: "9 ml Clear Cylinder Fine Mist Bottle",
    applicator: "Fine Mist Sprayer",
    applicatorFacets: { rollon: 4, finemist: 2, perfumespray: 1, dropper: 0, lotionpump: 0, reducer: 0 },
});
const rollOnResult = result({
    id: "cylinder-9ml-roll-on",
    name: "9 ml Clear Cylinder Roll-On Bottle",
    applicator: "Metal Roller Ball",
    applicatorFacets: { rollon: 1, finemist: 0, perfumespray: 0 },
});

function buttonWithText(container: HTMLElement, text: string): HTMLButtonElement {
    const button = [...container.querySelectorAll("button")]
        .find((candidate) => candidate.textContent?.trim().startsWith(text));
    if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing button: ${text}`);
    return button;
}

beforeEach(() => {
    mocks.clientSearch.mockReset();
    mocks.routerPush.mockReset();
    mocks.routerReplace.mockReset();
    mocks.serverSearch.mockReset().mockImplementation((args: CatalogSearchArgs) => (
        (args.filters.applicators ?? []).includes("rollon") ? rollOnResult : allCylinderResult
    ));
});

afterEach(() => {
    document.body.replaceChildren();
    window.sessionStorage.clear();
});

describe("Cylinder family-first server route", () => {
    it("fixes Cylinder in the route and honors canonical application refinements on first render", async () => {
        const element = await CylinderFamilyPage({
            searchParams: Promise.resolve({ applicators: "rollon", capacities: "9 ml", roller: "metal" }),
        });
        const html = renderToStaticMarkup(element);

        expect(html).toContain("9 ml Clear Cylinder Roll-On Bottle");
        expect(html).toContain('aria-pressed="true"');
        expect(html).not.toContain("Choose a family");
        expect(mocks.serverSearch).toHaveBeenCalledWith(expect.objectContaining({
            filters: expect.objectContaining({
                families: ["Cylinder"],
                applicators: ["rollon"],
                capacities: ["9 ml"],
                rollerMaterials: ["metal"],
            }),
        }));
    });

    it.each(["family", "families"])(
        "removes inbound %s aliases before SSR state and exact PDP return URLs",
        async (familyParam) => {
            const element = await CylinderFamilyPage({
                searchParams: Promise.resolve({
                    [familyParam]: "Cylinder",
                    applicators: "rollon",
                    roller: "metal",
                    colors: "Amber",
                    capacities: "9 ml",
                    threads: "17-415",
                    sort: "price-asc",
                }),
            });
            const html = renderToStaticMarkup(element);
            const parsed = new DOMParser().parseFromString(html, "text/html");
            const productHref = parsed.querySelector('a[href^="/products/cylinder-9ml-roll-on"]')
                ?.getAttribute("href");
            const returnPath = productHref
                ? new URL(productHref, "https://bestbottles.com").searchParams.get("from")
                : null;

            expect(returnPath).toBe(
                "/catalog/cylinder?applicators=rollon&roller=metal&colors=Amber&capacities=9+ml&threads=17-415&sort=price-asc",
            );
            expect(returnPath).not.toContain("family");
            expect(mocks.serverSearch).toHaveBeenCalledWith(expect.objectContaining({
                filters: expect.objectContaining({
                    families: ["Cylinder"],
                    applicators: ["rollon"],
                    rollerMaterials: ["metal"],
                    colors: ["Amber"],
                    capacities: ["9 ml"],
                    neckThreadSizes: ["17-415"],
                }),
                sort: "price-asc",
            }));
        },
    );
});

describe("Cylinder family-first client", () => {
    it("shows only application cards verified by live Cylinder facets", () => {
        const html = renderToStaticMarkup(createElement(CylinderFamilyPageClient, {
            baseCatalog: allCylinderResult,
            initialResult: allCylinderResult,
            search: "",
            editorial: null,
        }));
        const parsed = new DOMParser().parseFromString(html, "text/html");
        const switcherText = parsed.querySelector('nav[aria-label="Choose an application"]')?.textContent ?? "";

        expect(switcherText).toContain("Roll-On");
        expect(switcherText).toContain("Fine Mist & Spray");
        expect(switcherText).not.toContain("Lotion Pump");
        expect(switcherText).not.toContain("Dropper");
    });

    it("selects Roll-On at a canonical Cylinder URL and updates results in place", async () => {
        let resolveSearch!: (value: CatalogSearchResultShape) => void;
        mocks.clientSearch.mockReturnValue(new Promise((resolve) => { resolveSearch = resolve; }));
        const container = document.createElement("div");
        document.body.append(container);
        const root = createRoot(container);

        await act(async () => {
            root.render(createElement(CylinderFamilyPageClient, {
                baseCatalog: allCylinderResult,
                initialResult: allCylinderResult,
                search: "?roller=metal&colors=Amber&capacities=9+ml&threads=13-415",
                editorial: null,
            }));
        });
        await act(async () => buttonWithText(container, "Roll-On").click());

        expect(mocks.routerReplace).toHaveBeenLastCalledWith(
            "/catalog/cylinder?applicators=rollon&roller=metal&capacities=9+ml",
            { scroll: false },
        );
        expect(container.querySelector('a[href^="/products/cylinder-9ml-spray"]')).not.toBeNull();
        expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

        await act(async () => {
            resolveSearch(rollOnResult);
            await Promise.resolve();
        });
        expect(container.textContent).toContain("9 ml Clear Cylinder Roll-On Bottle");
        expect(buttonWithText(container, "Roll-On").getAttribute("aria-pressed")).toBe("true");
        expect(container.textContent).toContain("Fine Mist & Spray");

        await act(async () => root.unmount());
    });

    it("keeps one exact result on the page and links it directly to its PDP with safe return state", () => {
        const html = renderToStaticMarkup(createElement(CylinderFamilyPageClient, {
            baseCatalog: allCylinderResult,
            initialResult: rollOnResult,
            search: "?applicators=rollon",
            editorial: null,
        }));
        const parsed = new DOMParser().parseFromString(html, "text/html");
        const exactLinks = [...parsed.querySelectorAll('a[href^="/products/cylinder-9ml-roll-on"]')];

        expect(html).toContain("1 exact product");
        expect(exactLinks.length).toBeGreaterThan(0);
        expect(exactLinks.every((link) => link.getAttribute("href")?.includes(
            "from=%2Fcatalog%2Fcylinder%3Fapplicators%3Drollon",
        ))).toBe(true);
        expect(mocks.routerReplace).not.toHaveBeenCalled();
    });

    it("keeps results focus when the server route response supersedes a pending client search", async () => {
        mocks.clientSearch.mockReturnValue(new Promise(() => undefined));
        const container = document.createElement("div");
        document.body.append(container);
        const root = createRoot(container);

        await act(async () => {
            root.render(createElement(CylinderFamilyPageClient, {
                baseCatalog: allCylinderResult,
                initialResult: allCylinderResult,
                search: "",
                editorial: null,
            }));
        });
        await act(async () => buttonWithText(container, "Roll-On").click());
        await act(async () => {
            root.render(createElement(CylinderFamilyPageClient, {
                baseCatalog: allCylinderResult,
                initialResult: rollOnResult,
                search: "?applicators=rollon",
                editorial: null,
            }));
        });

        expect(container.querySelector('a[href^="/products/cylinder-9ml-roll-on"]')).not.toBeNull();
        expect(document.activeElement).toBe(container.querySelector("#focused-finder-results-heading"));

        await act(async () => root.unmount());
    });

    it("keeps Build a Bottle as the secondary action", () => {
        const html = renderToStaticMarkup(createElement(CylinderFamilyPageClient, {
            baseCatalog: allCylinderResult,
            initialResult: allCylinderResult,
            search: "",
            editorial: null,
        }));
        const parsed = new DOMParser().parseFromString(html, "text/html");
        const buildLink = [...parsed.querySelectorAll('main a[href="/matrix"]')]
            .find((link) => link.textContent?.trim() === "Build a Bottle");

        expect(buildLink?.getAttribute("href")).toBe("/matrix");
        expect(buildLink?.className).toContain("border-obsidian");
        expect(buildLink?.className).not.toContain("bg-obsidian");
    });
});
