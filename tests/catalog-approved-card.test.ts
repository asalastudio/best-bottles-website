// @vitest-environment jsdom
import { act, createElement, type ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import CatalogCardPreview from "@/components/catalog/CatalogCardPreview";
import { getProductHero } from "@/lib/products/catalog-heroes";
vi.mock("convex/react", () => ({ useQuery: () => undefined }));
vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    const p = { ...props } as Record<string, unknown>; delete p.fill; delete p.unoptimized; return createElement("img", p);
}, getImageProps: ({ src }: { src: string }) => ({ props: { src } }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
afterEach(() => { act(() => root?.unmount()); container?.remove(); });
// The pictured SKU is a Slim 100 ml sprayer: it has a catalog hero and no approved master (the Empire 100 ml sprayer used
// here before now has one, 4 Nov 2026), so the card shows the hero photograph.
it("keeps the new catalog wrapper static and falls back only to the pictured SKU", () => {
    const hero = getProductHero("GBSlm100SpryMtGl")!;
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    act(() => root.render(createElement(CatalogCardPreview, {
        title: "Atomizer", catalogHero: hero, imageUrl: "/wrong-group-default.webp", heroHoverImageUrl: "/filled.webp",
        href: "/products/atomizer-10ml?sku=GBSlm100SpryMtGl", family: "Atomizer", slug: "atomizer-10ml",
        variants: [
            { id: "black", label: "Black", websiteSku: "GBSlm100SpryBlack", imageUrl: "/black.webp", optionType: "capColor" },
            { id: "gold", label: "Gold", websiteSku: "GBSlm100SpryMtGl", imageUrl: "/exact-gold.webp", optionType: "capColor" },
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
