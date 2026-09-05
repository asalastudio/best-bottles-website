// @vitest-environment jsdom

import { act, createElement, type ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProductCardImagePreview from "@/components/products/ProductCardImagePreview";
import heroes from "@/lib/products/cylinder-catalog-heroes.json";

vi.mock("next/image", () => ({
    default: (props: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
        const imageProps = { ...props };
        delete imageProps.fill;
        return createElement("img", imageProps);
    },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const hero = heroes[0];
const href = "/products/" + hero.groupSlug;
const variant = {
    id: "white-spray", label: "White", optionType: "capColor" as const,
    imageUrl: "/white-spray.png", websiteSku: "GBSpry3mlClWht",
    shopifyVariantId: "gid://shopify/ProductVariant/white", swatchColor: "#fff",
};
const props = {
    productTitle: "3.3 ml Clear Cylinder", productHref: href, catalogHero: hero,
    defaultImage: { url: "/legacy.png", alt: "Legacy bottle" },
    variantPreviews: [variant, { ...variant, id: "black-spray", label: "Black", imageUrl: "/black-spray.png" }],
    auditMeta: { surface: "test-catalog-card", websiteSku: "legacy-sku", shopifyVariantId: "legacy-shopify" },
};
let root: Root | undefined;
let container: HTMLDivElement;
function mount(overrides = {}) {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root!.render(createElement(ProductCardImagePreview, { ...props, ...overrides })));
}
function img() { return container.querySelector("img")!; }
function choose() { act(() => container.querySelector("button")!.click()); }
function failImage() { act(() => img().dispatchEvent(new Event("error"))); }
afterEach(() => { act(() => root?.unmount()); document.body.replaceChildren(); });

describe("Cylinder hero and cap preview behavior", () => {
    it("starts with the approved hero instead of the first variant and retains the product route", () => {
        mount();
        expect(img().getAttribute("src")).toBe(hero.url);
        expect(img().getAttribute("data-bb-website-sku")).toBe(hero.websiteSku);
        expect(img().getAttribute("data-bb-shopify-variant-id")).toBe(hero.shopifyVariantId);
        expect(container.querySelector("a")?.getAttribute("href")).toBe(href);
        expect(container.querySelector("[data-bb-studio-hero]")?.className).toContain("aspect-[10/11]");
        expect(img().getAttribute("sizes")).toContain("calc(100vw - 32px)");
        expect(img().className).not.toContain("group-hover");
        expect(img().style.transform).toContain("translateY");
    });

    it("shows the actual cap photo and identity on touch/click, then restores the hero on pointer exit", () => {
        mount(); choose();
        expect(img().getAttribute("src")).toBe(variant.imageUrl);
        expect(img().getAttribute("data-bb-website-sku")).toBe(variant.websiteSku);
        expect(img().getAttribute("data-bb-shopify-variant-id")).toBe(variant.shopifyVariantId);
        expect(container.querySelector("button")?.getAttribute("aria-pressed")).toBe("true");
        act(() => container.firstElementChild!.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body })));
        expect(img().getAttribute("src")).toBe(hero.url);
    });

    it("supports keyboard previews and restores the hero when focus leaves the card", () => {
        mount();
        act(() => container.querySelector("button")!.focus());
        expect(img().getAttribute("src")).toBe(variant.imageUrl);
        act(() => container.querySelector("button")!.blur());
        expect(img().getAttribute("src")).toBe(hero.url);
    });

    it("falls back to legacy media and then a placeholder if both default images fail", () => {
        mount(); failImage();
        expect(img().getAttribute("src")).toBe("/legacy.png");
        expect(img().getAttribute("data-bb-website-sku")).toBe("legacy-sku");
        failImage();
        expect(container.querySelector("img")).toBeNull();
    });

    it("can still use legacy media when a selected variant and the hero both fail", () => {
        mount(); choose(); failImage();
        expect(img().getAttribute("src")).toBe(hero.url);
        failImage();
        expect(img().getAttribute("src")).toBe("/legacy.png");
    });

    it("does not retain a previous product's selected photo after navigation", () => {
        mount(); choose();
        act(() => root!.render(createElement(ProductCardImagePreview, { ...props, productHref: "/products/another", catalogHero: null, variantPreviews: [] })));
        expect(img().getAttribute("src")).toBe("/legacy.png");
    });

    it("preserves the original first-variant preview for products without studio heroes", () => {
        mount({ catalogHero: null });
        expect(img().getAttribute("src")).toBe(variant.imageUrl);
        expect(img().className).toContain("group-hover");
        expect(img().style.transform).toBe("");
    });
});
