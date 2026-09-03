// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogSearchResultShape } from "@/lib/catalogSearchFallback";
import type { CatalogSearchArgs } from "@/lib/catalogServer";
import { HOME_APPLICATION_LINKS } from "@/lib/homepageMerchandising";
import Navbar from "@/components/Navbar";
import ApplicationFinderClient from "@/app/catalog/application/[application]/ApplicationFinderClient";
import ApplicationFinderPage from "@/app/catalog/application/[application]/page";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
    clientSearch: vi.fn(),
    notFound: vi.fn(() => {
        throw new Error("NEXT_NOT_FOUND");
    }),
    routerPush: vi.fn(),
    routerReplace: vi.fn(),
    serverSearch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    notFound: mocks.notFound,
    useRouter: () => ({
        push: mocks.routerPush,
        replace: mocks.routerReplace,
    }),
}));

vi.mock("@/lib/catalogServer", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/catalogServer")>();
    return { ...actual, searchCatalogServer: mocks.serverSearch };
});

vi.mock("@/lib/catalogSearchClient", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/catalogSearchClient")>();
    return { ...actual, fetchCatalogSearch: mocks.clientSearch };
});

vi.mock("@/components/CartProvider", () => ({
    useCart: () => ({ itemCount: 0, isCartHydrated: true }),
}));

vi.mock("@/components/CartDrawer", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => createElement("footer", null, "Footer") }));

function catalogResult(input: {
    id: string;
    name: string;
    capacityMl: number;
    applicator: string;
    rollerMaterials?: { metal: number; plastic: number };
    capacityCounts?: Record<string, number>;
}): CatalogSearchResultShape {
    const capacity = `${input.capacityMl} ml`;
    const capacityCounts = input.capacityCounts ?? { [capacity]: 1 };
    return {
        items: [{
            _id: input.id,
            slug: input.id,
            displayName: input.name,
            family: "Cylinder",
            capacity,
            capacityMl: input.capacityMl,
            color: "Clear",
            category: "Glass Bottle",
            bottleCollection: null,
            neckThreadSize: "17-415",
            variantCount: 1,
            priceRangeMin: 0.72,
            priceRangeMax: 0.72,
            heroImageUrl: "https://cdn.shopify.com/bottle.png",
            applicatorTypes: [input.applicator],
        }],
        facets: {
            categories: { "Glass Bottle": 1 },
            collections: {},
            applicators: { rollon: 1, finemist: 1 },
            rollerMaterials: input.rollerMaterials ?? { metal: 1, plastic: 1 },
            families: { Cylinder: 1 },
            colors: { Clear: 1 },
            capacities: Object.fromEntries(Object.entries(capacityCounts).map(([label, count]) => [
                label,
                { label, ml: Number.parseFloat(label), count },
            ])),
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
                imageUrl: "https://cdn.shopify.com/bottle.png",
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

const rollOnResult = catalogResult({
    id: "cylinder-9ml-roll-on",
    name: "9 ml Clear Cylinder Roll-On Bottle",
    capacityMl: 9,
    applicator: "Metal Roller Ball",
    capacityCounts: { "9 ml": 1, "30 ml": 0 },
});

const sprayResult = catalogResult({
    id: "cylinder-30ml-spray",
    name: "30 ml Clear Cylinder Fine Mist Bottle",
    capacityMl: 30,
    applicator: "Fine Mist Sprayer",
    rollerMaterials: { metal: 0, plastic: 0 },
});

function buttonWithText(container: HTMLElement, text: string): HTMLButtonElement {
    const button = [...container.querySelectorAll("button")]
        .find((candidate) => candidate.textContent?.trim().startsWith(text));
    if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing button: ${text}`);
    return button;
}

beforeEach(() => {
    mocks.clientSearch.mockReset();
    mocks.notFound.mockClear();
    mocks.routerPush.mockReset();
    mocks.routerReplace.mockReset();
    mocks.serverSearch.mockReset().mockResolvedValue(rollOnResult);
});

afterEach(() => {
    document.body.replaceChildren();
    window.sessionStorage.clear();
});

describe("application-first finder server route", () => {
    it("selects Roll-On and renders unrefined products before hydration", async () => {
        const element = await ApplicationFinderPage({
            params: Promise.resolve({ application: "roll-on" }),
            searchParams: Promise.resolve({}),
        });
        const html = renderToStaticMarkup(element);

        expect(html).toContain('aria-pressed="true"');
        expect(html).toContain("Roll-On");
        expect(html).toContain("9 ml Clear Cylinder Roll-On Bottle");
        expect(html).toContain("1 exact product");
        expect(html).not.toContain("Choose a capacity to continue");
        expect(mocks.serverSearch).toHaveBeenCalledWith(expect.objectContaining({
            filters: expect.objectContaining({
                applicators: ["rollon"],
                capacities: [],
                rollerMaterials: [],
            }),
        }));
    });

    it.each([
        ["spray", ["finemist", "perfumespray"]],
        ["dropper", ["dropper"]],
        ["lotion-pump", ["lotionpump"]],
        ["reducer", ["reducer"]],
    ])("maps %s only to its existing canonical catalog buckets", async (slug, buckets) => {
        await ApplicationFinderPage({
            params: Promise.resolve({ application: slug }),
            searchParams: Promise.resolve({}),
        });

        const request = mocks.serverSearch.mock.calls[0]?.[0] as CatalogSearchArgs;
        expect(request.filters.applicators).toEqual(buckets);
    });

    it("returns notFound for an unsupported application route", async () => {
        await expect(ApplicationFinderPage({
            params: Promise.resolve({ application: "rollerball" }),
            searchParams: Promise.resolve({}),
        })).rejects.toThrow("NEXT_NOT_FOUND");
        expect(mocks.notFound).toHaveBeenCalledOnce();
        expect(mocks.serverSearch).not.toHaveBeenCalled();
    });
});

describe("application-first finder client", () => {
    it("updates capacity and roller refinements in the URL and search request without Apply or Next", async () => {
        mocks.clientSearch.mockResolvedValue(rollOnResult);
        const container = document.createElement("div");
        document.body.append(container);
        const root = createRoot(container);

        await act(async () => {
            root.render(createElement(ApplicationFinderClient, {
                application: "rollon",
                pathname: "/catalog/application/roll-on",
                search: "",
                unrefinedFacetSource: rollOnResult,
                initialResult: rollOnResult,
            }));
        });

        await act(async () => buttonWithText(container, "9 ml").click());
        expect(mocks.routerReplace).toHaveBeenLastCalledWith(
            "/catalog/application/roll-on?capacities=9+ml",
            { scroll: false },
        );
        expect(mocks.clientSearch).toHaveBeenLastCalledWith(expect.objectContaining({
            filters: expect.objectContaining({
                applicators: ["rollon"],
                capacities: ["9 ml"],
                rollerMaterials: [],
            }),
        }), expect.any(AbortSignal));

        await act(async () => buttonWithText(container, "Metal").click());
        expect(mocks.routerReplace).toHaveBeenLastCalledWith(
            "/catalog/application/roll-on?roller=metal&capacities=9+ml",
            { scroll: false },
        );
        expect(mocks.clientSearch).toHaveBeenLastCalledWith(expect.objectContaining({
            filters: expect.objectContaining({
                applicators: ["rollon"],
                capacities: ["9 ml"],
                rollerMaterials: ["metal"],
            }),
        }), expect.any(AbortSignal));
        expect(container.textContent).toContain("Roll-On / 9 ml / Metal roller");
        expect(container.textContent).not.toContain("Apply");
        expect(container.textContent).not.toContain("Next");

        await act(async () => root.unmount());
    });

    it("keeps current results visible in flight and focuses results after an application switch", async () => {
        let resolveSearch!: (result: CatalogSearchResultShape) => void;
        mocks.clientSearch.mockReturnValue(new Promise((resolve) => {
            resolveSearch = resolve;
        }));
        const container = document.createElement("div");
        document.body.append(container);
        const root = createRoot(container);

        await act(async () => {
            root.render(createElement(ApplicationFinderClient, {
                application: "rollon",
                pathname: "/catalog/application/roll-on",
                search: "",
                unrefinedFacetSource: rollOnResult,
                initialResult: rollOnResult,
            }));
        });
        await act(async () => buttonWithText(container, "Fine Mist & Spray").click());

        expect(container.textContent).toContain("9 ml Clear Cylinder Roll-On Bottle");
        expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
        expect(mocks.routerReplace).toHaveBeenLastCalledWith("/catalog/application/spray", { scroll: false });
        expect(mocks.clientSearch).toHaveBeenCalledWith(expect.objectContaining({
            filters: expect.objectContaining({ applicators: ["finemist", "perfumespray"] }),
        }), expect.any(AbortSignal));

        await act(async () => {
            resolveSearch(sprayResult);
            await Promise.resolve();
        });
        const heading = container.querySelector("#focused-finder-results-heading");
        expect(container.textContent).toContain("30 ml Clear Cylinder Perfume Spray Bottle");
        expect(document.activeElement).toBe(heading);

        await act(async () => root.unmount());
    });

    it("keeps results focus when the route response supersedes the pending client request", async () => {
        mocks.clientSearch.mockReturnValue(new Promise(() => undefined));
        const container = document.createElement("div");
        document.body.append(container);
        const root = createRoot(container);

        await act(async () => {
            root.render(createElement(ApplicationFinderClient, {
                application: "rollon",
                pathname: "/catalog/application/roll-on",
                search: "",
                unrefinedFacetSource: rollOnResult,
                initialResult: rollOnResult,
            }));
        });
        await act(async () => buttonWithText(container, "Fine Mist & Spray").click());
        await act(async () => {
            root.render(createElement(ApplicationFinderClient, {
                application: "spray",
                pathname: "/catalog/application/spray",
                search: "",
                unrefinedFacetSource: sprayResult,
                initialResult: sprayResult,
            }));
        });

        const heading = container.querySelector("#focused-finder-results-heading");
        expect(container.textContent).toContain("30 ml Clear Cylinder Perfume Spray Bottle");
        expect(document.activeElement).toBe(heading);

        await act(async () => root.unmount());
    });

    it("disables unavailable zero-count controls with explanatory semantics", () => {
        const html = renderToStaticMarkup(createElement(ApplicationFinderClient, {
            application: "rollon",
            pathname: "/catalog/application/roll-on",
            search: "",
            unrefinedFacetSource: rollOnResult,
            initialResult: rollOnResult,
        }));
        const parsed = new DOMParser().parseFromString(html, "text/html");
        const unavailable = parsed.querySelector('button[title*="30 ml"]');

        expect(unavailable).toHaveProperty("disabled", true);
        expect(unavailable?.getAttribute("aria-disabled")).toBe("true");
        expect(unavailable?.getAttribute("title")).toContain("not available");
    });
});

describe("finder entry links", () => {
    it("routes homepage applicators to dedicated finders", () => {
        expect(HOME_APPLICATION_LINKS.map(({ key, href }) => [key, href])).toEqual([
            ["rollon", "/catalog/application/roll-on"],
            ["spray", "/catalog/application/spray"],
            ["lotionpump", "/catalog/application/lotion-pump"],
            ["dropper", "/catalog/application/dropper"],
            ["reducer", "/catalog/application/reducer"],
        ]);
    });

    it("keeps Catalog general and exposes one secondary Build a Bottle route", () => {
        const html = renderToStaticMarkup(createElement(Navbar, { variant: "home" }));
        const parsed = new DOMParser().parseFromString(html, "text/html");
        const desktopNav = parsed.querySelector("nav");
        const links = [...(desktopNav?.querySelectorAll("a") ?? [])];

        expect(links.find((link) => link.textContent?.trim() === "Catalog")?.getAttribute("href"))
            .toBe("/catalog");
        expect(links.find((link) => link.textContent?.trim() === "Build a Bottle")?.getAttribute("href"))
            .toBe("/matrix");
    });
});
