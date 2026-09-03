// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import FocusedApplicationCards from "@/components/catalog/FocusedApplicationCards";
import FocusedFinderControls from "@/components/catalog/FocusedFinderControls";
import FocusedFinderResults from "@/components/catalog/FocusedFinderResults";
import {
    buildFocusedProductHref,
} from "@/components/catalog/FocusedProductCard";
import {
    default as FinderNavigationMemory,
    clampFinderScrollPosition,
    finderNavigationMemoryKey,
    parseFinderNavigationMemory,
    safeCatalogReturnPath,
} from "@/components/catalog/FinderNavigationMemory";
import type { GuidedFinderFamily, GuidedFinderProduct } from "@/lib/products/guided-finder";

const finderUrl = "/catalog/application/roll-on?capacity=9+ml&rollerMaterial=metal";

const product: GuidedFinderProduct = {
    id: "variant-9",
    groupId: "cylinder-9",
    displayName: "9 ml Amber Cylinder Roll-On Bottle",
    imageUrl: "https://cdn.shopify.com/cylinder-9.png",
    family: "Cylinder",
    capacity: "9 ml",
    color: "Amber",
    application: "Roll-On",
    rollerMaterial: "metal",
    neckFinish: "17-415",
    stockStatus: "In Stock",
    availability: "in-stock",
    caseQuantity: 144,
    webPrice1pc: 1.35,
    startingUnitPrice: 1.1,
    shopifyVariantId: "gid://shopify/ProductVariant/9",
    shopifySellable: true,
    checkoutReady: true,
    href: "/products/cylinder-9ml-amber",
};

const families: GuidedFinderFamily[] = [{ family: "Cylinder", exactProducts: [product] }];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
    document.body.replaceChildren();
    window.sessionStorage.clear();
});

describe("focused finder navigation safety", () => {
    it.each([
        [finderUrl, finderUrl],
        ["/catalog", "/catalog"],
        ["//catalog/evil", null],
        ["https://example.com/catalog", null],
        ["/products/cylinder", null],
        [null, null],
    ])("accepts only local catalog return paths", (value, expected) => {
        expect(safeCatalogReturnPath(value)).toBe(expected);
    });

    it("adds the exact safe finder URL to an exact PDP link", () => {
        expect(buildFocusedProductHref(product.href, finderUrl)).toBe(
            "/products/cylinder-9ml-amber?from=%2Fcatalog%2Fapplication%2Froll-on%3Fcapacity%3D9%2Bml%26rollerMaterial%3Dmetal",
        );
        expect(buildFocusedProductHref(product.href, "//catalog/evil")).toBe(product.href);
    });

    it("namespaces and restores memory only for the exact finder URL", () => {
        const route = "/catalog/application/roll-on?capacity=9+ml";
        const otherRoute = "/catalog/application/roll-on?capacity=30+ml";
        expect(finderNavigationMemoryKey("/catalog/application/roll-on", "?capacity=9+ml"))
            .not.toBe(finderNavigationMemoryKey("/catalog/application/roll-on", "?capacity=30+ml"));

        const stored = JSON.stringify({ route, expandedFamily: "Cylinder", scrollY: 780 });
        expect(parseFinderNavigationMemory(stored, route)).toEqual({
            route,
            expandedFamily: "Cylinder",
            scrollY: 780,
        });
        expect(parseFinderNavigationMemory(stored, otherRoute)).toBeNull();
        expect(clampFinderScrollPosition(780, 1000, 500)).toBe(500);
        expect(clampFinderScrollPosition(-40, 1000, 500)).toBe(0);
    });

    it("saves the latest scroll position when SPA navigation unmounts the finder", () => {
        const pathname = "/catalog/application/roll-on";
        const search = "?capacity=9+ml";
        const container = document.createElement("div");
        document.body.append(container);
        const root = createRoot(container);
        Object.defineProperty(window, "scrollY", { configurable: true, value: 120, writable: true });

        act(() => {
            root.render(createElement(FinderNavigationMemory, {
                pathname,
                search,
                expandedFamily: "Cylinder",
                onRestoreExpandedFamily: () => undefined,
            }));
        });
        Object.defineProperty(window, "scrollY", { configurable: true, value: 740, writable: true });
        act(() => root.unmount());

        expect(JSON.parse(window.sessionStorage.getItem(
            finderNavigationMemoryKey(pathname, search),
        ) ?? "null")).toEqual({
            route: "/catalog/application/roll-on?capacity=9+ml",
            expandedFamily: "Cylinder",
            scrollY: 740,
        });
    });

    it("restores an intentionally collapsed family state through the callback", () => {
        const pathname = "/catalog/application/roll-on";
        const search = "?capacity=9+ml";
        const route = `${pathname}${search}`;
        const restored: Array<string | null> = [];
        window.sessionStorage.setItem(
            finderNavigationMemoryKey(pathname, search),
            JSON.stringify({ route, expandedFamily: null, scrollY: 0 }),
        );
        const container = document.createElement("div");
        document.body.append(container);
        const root = createRoot(container);

        act(() => {
            root.render(createElement(FinderNavigationMemory, {
                pathname,
                search,
                expandedFamily: "Cylinder",
                onRestoreExpandedFamily: (family) => restored.push(family),
            }));
        });

        expect(restored).toEqual([null]);
        act(() => root.unmount());
    });
});

describe("focused finder presentation", () => {
    it("exposes current-route or pressed state on application choices", () => {
        const linked = renderToStaticMarkup(createElement(FocusedApplicationCards, {
            applications: [
                { value: "rollon", label: "Roll-On", description: "Oils and topicals", href: "/catalog/application/roll-on" },
                { value: "spray", label: "Fine Mist & Spray", description: "Fragrance and room scent", href: "/catalog/application/spray" },
            ],
            activeApplication: "rollon",
        }));
        expect(linked).toContain('aria-current="page"');

        const buttons = renderToStaticMarkup(createElement(FocusedApplicationCards, {
            applications: [{ value: "rollon", label: "Roll-On" }],
            activeApplication: null,
            onSelect: () => undefined,
        }));
        expect(buttons).toContain('aria-pressed="false"');
        expect(buttons).toContain("min-h-11");
    });

    it("keeps Capacity and Roller material as visible 44px optional controls", () => {
        const html = renderToStaticMarkup(createElement(FocusedFinderControls, {
            capacityOptions: [{ value: "9 ml", label: "9 ml", count: 4 }],
            rollerMaterialOptions: [{ value: "metal", label: "Metal", count: 3 }],
            selectedCapacities: [],
            selectedRollerMaterials: [],
            onToggleCapacity: () => undefined,
            onToggleRollerMaterial: () => undefined,
        }));
        expect(html).toContain("Capacity");
        expect(html).toContain("Roller Material");
        expect(html.match(/min-h-11/g)?.length).toBeGreaterThanOrEqual(2);
        expect(html).not.toContain("Next step");
    });

    it("renders count and exact family results before optional refinements", () => {
        const html = renderToStaticMarkup(createElement(FocusedFinderResults, {
            families,
            finderUrl,
            resultCount: 1,
            refinementControls: createElement("div", { id: "optional-refinement" }, "Refine"),
        }));
        expect(html).toContain('aria-live="polite"');
        expect(html).toContain("1 exact product");
        expect(html).toContain("Cylinder");
        expect(html).toContain("9 ml Amber Cylinder Roll-On Bottle");
        expect(html).toContain("/products/cylinder-9ml-amber?from=");
        expect(html.indexOf("9 ml Amber Cylinder Roll-On Bottle")).toBeLessThan(html.indexOf("optional-refinement"));
        expect(html).not.toContain('href="/catalog?family=Cylinder"');
    });

    it("requires an explicit one-click action to remove a conflicting filter", () => {
        const html = renderToStaticMarkup(createElement(FocusedFinderResults, {
            families: [],
            finderUrl,
            resultCount: 0,
            recovery: {
                filterLabel: "Amber glass",
                onRemove: () => undefined,
            },
        }));
        expect(html).toContain("No exact products match");
        expect(html).toContain("Remove Amber glass filter");
        expect(html).toContain('type="button"');
    });
});
