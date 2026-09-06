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
describe("Cylinder static empty hero",()=>{
    it("renders only the approved empty hero with its reviewed framing and pictured-SKU link",()=>{
        mount();expect(empty().getAttribute('src')).toBe(hero.url);
        expect(container.querySelectorAll('img')).toHaveLength(1);
        expect(filled()).toBeNull();
        expect(empty().style.transform).toBe(getCatalogHeroStyle(hero).transform);
        expect(empty().style.maskImage).toBe('');expect(empty().className).not.toContain('group-hover');
        expect(container.querySelector('a')?.getAttribute('href')).toBe(props.productHref);
        expect(empty().getAttribute('data-bb-website-sku')).toBe(hero.websiteSku);
        expect(container.querySelector('button')).toBeNull();
    });
    it("keeps the empty hero on pointer hover and keyboard focus without loading a filled state",()=>{
        mount();const before=container.querySelector('img');
        act(()=>{container.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));container.querySelector('a')!.focus();});
        expect(container.querySelector('img')).toBe(before);
        expect(container.querySelectorAll('img')).toHaveLength(1);
        expect(filled()).toBeNull();expect(container.innerHTML).not.toContain('data-bb-hero-state="filled"');
    });
    it("uses a placeholder if the empty hero fails and never falls back to perfume-filled imagery",()=>{
        mount();act(()=>empty().dispatchEvent(new Event('error')));expect(container.querySelector('img')).toBeNull();
    });
    it("updates to the exact empty hero when the filtered group changes",()=>{
        mount();
        act(()=>root.render(createElement(ProductCardImagePreview,{...props,catalogHero:heroes[1],productHref:'/products/next'})));
        expect(empty().getAttribute('src')).toBe(heroes[1].url);
        expect(container.querySelectorAll('img')).toHaveLength(1);expect(filled()).toBeNull();
    });
    it("preserves variant previews and fallback behavior outside the approved Cylinder mapping",()=>{
        mount({catalogHero:null});expect(container.querySelector('img')?.getAttribute('src')).toBe('/white.png');
        expect(container.querySelectorAll('button')).toHaveLength(2);expect(filled()).toBeNull();
        act(()=>container.querySelector('img')!.dispatchEvent(new Event('error')));
        expect(container.querySelector('img')?.getAttribute('src')).toBe('/legacy.png');
    });
});
