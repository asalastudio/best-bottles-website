// @vitest-environment jsdom
import { act, createElement, type ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { capSwapFraming } from "@/lib/products/catalog-cap-swap";
import { getCatalogHero, getProductHero, type CatalogHero } from "@/lib/products/catalog-heroes";

const plates = vi.hoisted(() => ({ current: {} as Record<string, { image: string; imageCapOff: string | null; thumb: string; thumbCapOff: string | null }> }));
vi.mock("convex/react", () => ({ useQuery: () => ({ plates: plates.current, conflicts: [] }) }));
vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; unoptimized?: boolean }) => {
    const p = { ...props } as Record<string, unknown>; delete p.fill; delete p.unoptimized; return createElement("img", p);
} }));

import CatalogCardPreview from "@/components/catalog/CatalogCardPreview";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Production builds with the release flag on, so the released black-tassel hero competes.
const previousFlag = process.env.NEXT_PUBLIC_CATALOG_HERO_PILOT;
beforeAll(() => { process.env.NEXT_PUBLIC_CATALOG_HERO_PILOT = "families-2026-09-22"; });
afterAll(() => { process.env.NEXT_PUBLIC_CATALOG_HERO_PILOT = previousFlag; });

const TASSEL = "circle-50ml-frosted-18-415-antiquespray-tassel";
const black = { id: "blk", label: "Black", websiteSku: "GBCrclFrst50AnSpTslBlk", optionType: "capColor" as const };
const gold = { id: "gl", label: "Gold", websiteSku: "GBCrclFrst50AnSpTslGl", optionType: "capColor" as const };

describe("an asked-for SKU's own approved hero", () => {
    it("wins over a sibling's released hero, and the group default is unchanged", () => {
        expect(getCatalogHero(TASSEL, [black, gold], "GBCrclFrst50AnSpTslGl")?.url).toBe(getProductHero("GBCrclFrst50AnSpTslGl")?.url);
        expect(getCatalogHero(TASSEL, [black, gold], "GBCrclFrst50AnSpTslGl")?.url).toContain("/psd-gap-2026-10-30/GBCrclFrst50AnSpTslGl.");
        expect(getCatalogHero(TASSEL, [black, gold])?.websiteSku).toBe("GBCrclFrst50AnSpTslBlk");
        expect(getCatalogHero(TASSEL, [black, gold], "GBCrclFrst50AnSpTslBlk")?.websiteSku).toBe("GBCrclFrst50AnSpTslBlk");
    });

    it("picks the asked-for finish inside merged production groups", () => {
        const bags = [{ websiteSku: "VBagRed4x5" }, { websiteSku: "OBagBlack4x6" }];
        expect(getCatalogHero("gift-bag-0ml-mixed", bags, "OBagBlack4x6")?.websiteSku).toBe("OBagBlack4x6");
        expect(getCatalogHero("gift-bag-0ml-mixed", bags)?.websiteSku).toBe("VBagRed4x5");
    });

    it("never lends a hero to an asked-for SKU that has none, or one outside the result", () => {
        expect(getCatalogHero(TASSEL, [black], "GBCrclFrst50AnSpTslGl")?.websiteSku).toBe("GBCrclFrst50AnSpTslBlk");
        expect(getCatalogHero(TASSEL, [{ websiteSku: "not-a-real-finish" }], "not-a-real-finish")).toBeNull();
    });
});

let root: Root;
let container: HTMLDivElement;
function render(catalogHero: CatalogHero, selected: { id: string; label: string; websiteSku: string; optionType: "capColor" } | null, selectedHero: CatalogHero | null, variants = [black, gold]) {
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    act(() => root.render(createElement(CatalogCardPreview, {
        title: "50 ml Frosted Circle Vintage-Style Bulb Sprayer Bottle with Tassel", catalogHero, imageUrl: null,
        href: `/products/${catalogHero.groupSlug}`, variants, family: "Circle", slug: catalogHero.groupSlug, selected, selectedHero,
    })));
}
afterEach(() => { act(() => root?.unmount()); container?.remove(); plates.current = {}; });

describe("picking a finish on a hero card", () => {
    it("shows the picked finish's own hero when the group hero has no cap swap", () => {
        const groupHero = getCatalogHero(TASSEL, [black, gold])!;
        expect(capSwapFraming(groupHero.url)).toBeNull();
        const goldHero = getCatalogHero(TASSEL, [gold], gold.websiteSku)!;
        render(groupHero, gold, goldHero);
        const urls = [...container.querySelectorAll("img")].map(img => img.getAttribute("src"));
        expect(urls).toContain(goldHero.url);
        expect(urls).not.toContain(groupHero.url);
    });

    it("keeps the group hero when no finish is picked, or the pick has no hero of its own", () => {
        const groupHero = getCatalogHero(TASSEL, [black, gold])!;
        render(groupHero, null, null);
        expect([...container.querySelectorAll("img")].map(img => img.getAttribute("src"))).toContain(groupHero.url);
        act(() => root.unmount()); container.remove();
        render(groupHero, gold, null);
        expect([...container.querySelectorAll("img")].map(img => img.getAttribute("src"))).toContain(groupHero.url);
    });

    it("leaves a calibrated cap swap in charge", () => {
        const cylinder = getProductHero("GBCyl5MtlRollBlkDot")!;
        expect(capSwapFraming(cylinder.url)).not.toBeNull();
        const copper = { id: "cu", label: "Matte Copper", websiteSku: "GBCyl5MtlRollCuMatt", optionType: "capColor" as const };
        plates.current = { GBCyl5MtlRollCuMatt: { image: "https://blob.example/cu.front-on.webp", imageCapOff: "https://blob.example/cu.front-off.webp", thumb: "https://blob.example/cu.thumb.webp", thumbCapOff: null } };
        const copperHero = { ...cylinder, websiteSku: copper.websiteSku, url: "/images/catalog/copper-own.png" };
        render(cylinder, copper, copperHero, [{ id: "blk", label: "Black with Dots", websiteSku: "GBCyl5MtlRollBlkDot", optionType: "capColor" }, copper]);
        expect(container.querySelector('[data-testid="catalog-card-cap-swap"]')).not.toBeNull();
        expect([...container.querySelectorAll("img")].map(img => img.getAttribute("src"))).not.toContain("/images/catalog/copper-own.png");
    });
});
