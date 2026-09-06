// @vitest-environment jsdom
import { act, createElement, type ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import CatalogCardPreview from "@/components/catalog/CatalogCardPreview";
import { getProductHero } from "@/lib/products/catalog-heroes";
vi.mock("convex/react", () => ({ useQuery: () => undefined }));
vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    const p = { ...props }; delete p.fill; return createElement("img", p);
} }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
afterEach(() => { act(() => root?.unmount()); container?.remove(); });
it("keeps the new catalog wrapper static and falls back only to the pictured SKU", () => {
    const hero = getProductHero("GBAtom10Gl")!;
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    act(() => root.render(createElement(CatalogCardPreview, {
        title: "Atomizer", catalogHero: hero, imageUrl: "/wrong-group-default.webp", heroHoverImageUrl: "/filled.webp",
        href: "/products/atomizer-10ml?sku=GBAtom10Gl", family: "Atomizer", slug: "atomizer-10ml", neck: "17mm", capKind: null,
        variants: [
            { id: "black", label: "Black", websiteSku: "GBAtom10Blk", imageUrl: "/black.webp", optionType: "capColor" },
            { id: "gold", label: "Gold", websiteSku: "GBAtom10Gl", imageUrl: "/exact-gold.webp", optionType: "capColor" },
        ],
    })));
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(hero.url);
    expect(container.querySelectorAll('[aria-label="Available variant previews"] button')).toHaveLength(0);
    act(() => container.querySelector("img")!.dispatchEvent(new Event("error")));
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/exact-gold.webp");
    expect(container.innerHTML).not.toContain("/filled.webp");
    expect(container.innerHTML).not.toContain("/wrong-group-default.webp");
});
