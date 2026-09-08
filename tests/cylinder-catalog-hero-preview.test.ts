// @vitest-environment jsdom
import { act, createElement, type ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProductCardImagePreview from "@/components/products/ProductCardImagePreview";
import allHeroes from "@/lib/products/catalog-heroes.json";
const heroes = allHeroes.filter(hero => hero.family === "Cylinder");
import { getCatalogHeroStyle } from "@/lib/products/catalog-heroes";

vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    const p = { ...props }; delete p.fill; return createElement("img", p);
} }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
const hero = heroes[0];
const props = {
    productTitle: "Cylinder", productHref: "/products/"+hero.groupSlug+"?sku="+hero.websiteSku,
    catalogHero: hero, defaultImage: { url: "/legacy.png" },
    variantPreviews: [
        { id:"white", label:"White", imageUrl:"/white.png", websiteSku:"WHITE", optionType:"capColor" as const },
        { id:"black", label:"Black", imageUrl:"/black.png", websiteSku:"BLACK", optionType:"capColor" as const },
    ],
    auditMeta: {surface:"test", websiteSku:"legacy-sku"},
};
function mount(overrides={}) { container=document.createElement("div");document.body.append(container);root=createRoot(container);act(()=>root.render(createElement(ProductCardImagePreview,{...props,...overrides}))); }
const empty=()=>container.querySelector<HTMLImageElement>('[data-bb-hero-state="empty"]')!;
const filled=()=>container.querySelector<HTMLImageElement>('[data-bb-hero-state="filled"]')!;

afterEach(()=>{act(()=>root?.unmount());document.body.replaceChildren();});
describe("Cylinder static catalog hero",()=>{
    it("preserves reviewed empty framing without requesting a filled hover",()=>{
        mount();expect(empty().getAttribute('src')).toBe(hero.url);
        expect(empty().style.transform).toBe(getCatalogHeroStyle(hero).transform);
        expect(empty().style.maskImage).toBe('');expect(empty().className).not.toContain('group-hover');
        expect(filled()).toBeNull();
        expect(container.querySelector('a')?.getAttribute('href')).toBe(props.productHref);
        expect(empty().getAttribute('data-bb-website-sku')).toBe(hero.websiteSku);
        expect(container.querySelector('button')).toBeNull();

    });
    it("uses a placeholder if the approved default fails instead of exposing the filled image",()=>{
        mount();act(()=>empty().dispatchEvent(new Event('error')));expect(container.querySelector('img')).toBeNull();
    });
    it("uses the newly filtered group without reviving retired hover artwork",()=>{
        mount();
        act(()=>root.render(createElement(ProductCardImagePreview,{...props,catalogHero:heroes[1],productHref:'/products/next'})));
        expect(empty().getAttribute('src')).toBe(heroes[1].url);
    });
    it("preserves variant previews and fallback behavior outside the approved Cylinder mapping",()=>{
        mount({catalogHero:null});expect(container.querySelector('img')?.getAttribute('src')).toBe('/white.png');
        expect(container.querySelectorAll('button')).toHaveLength(2);expect(filled()).toBeNull();
        act(()=>container.querySelector('img')!.dispatchEvent(new Event('error')));
        expect(container.querySelector('img')?.getAttribute('src')).toBe('/legacy.png');
    });
});
