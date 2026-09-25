// @vitest-environment jsdom
import { act, createElement, type ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import framingRows from "@/lib/products/catalog-cap-swap-framing.json";
import { capSwapFraming, capSwapPlateBox, capSwapPlateUrl } from "@/lib/products/catalog-cap-swap";
import { getProductHero, type CatalogHero } from "@/lib/products/catalog-heroes";

const plates = vi.hoisted(() => ({ current: {} as Record<string, { image: string; imageCapOff: string | null; thumb: string; thumbCapOff: string | null }> }));
vi.mock("convex/react", () => ({ useQuery: () => ({ plates: plates.current, conflicts: [] }) }));
vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; unoptimized?: boolean }) => {
    const p = { ...props } as Record<string, unknown>; delete p.fill; delete p.unoptimized; return createElement("img", p);
} }));

import CatalogCardPreview from "@/components/catalog/CatalogCardPreview";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const hero = getProductHero("GBCyl5MtlRollBlkDot")!;
const copper = { id: "cu", label: "Matte Copper", websiteSku: "GBCyl5MtlRollCuMatt", optionType: "capColor" as const };
const plate = (sku: string) => ({
    image: `https://blob.example/${sku}.front-on.webp`, imageCapOff: `https://blob.example/${sku}.front-off.webp`,
    thumb: `https://blob.example/${sku}.thumb.webp`, thumbCapOff: null,
});

let root: Root;
let container: HTMLDivElement;
function render(catalogHero: CatalogHero, selected: typeof copper | null) {
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    act(() => root.render(createElement(CatalogCardPreview, {
        title: "5 ml Clear Cylinder Roll-On Bottle", catalogHero, imageUrl: null, href: "/products/cylinder-5ml",
        variants: [{ id: "blk", label: "Black with Dots", websiteSku: "GBCyl5MtlRollBlkDot", optionType: "capColor" }, copper],
        family: "Cylinder", slug: catalogHero.groupSlug, selected,
    })));
}
afterEach(() => { act(() => root?.unmount()); container?.remove(); plates.current = {}; });

describe("cap swap on a hero card", () => {
    it("has a calibrated placement and the hero's own shadow for most heroes", () => {
        const rows = Object.values(framingRows as unknown as Record<string, { match: number; shadow?: string; scale: number }>);
        expect(rows.length).toBeGreaterThan(300);
        // Only confident matches ship (bar set by eye: the worst mismatch reviewed scored 0.677).
        expect(rows.every((row) => row.match >= 0.74 && row.shadow?.startsWith("/images/catalog/cap-swap-shadows/"))).toBe(true);
        // Component close-ups (a cap filling the frame) scale their plate up to ~3×.
        expect(rows.every((row) => row.scale > 0.2 && row.scale < 4)).toBe(true);
    });

    it("draws the picked cap's plate where the hero's bottle stands, on bone with the hero's shadow", () => {
        const framing = capSwapFraming(hero.url)!;
        expect(framing).not.toBeNull();
        plates.current = { GBCyl5MtlRollCuMatt: plate("GBCyl5MtlRollCuMatt") };
        render(hero, copper);
        const swap = container.querySelector<HTMLElement>('[data-testid="catalog-card-cap-swap"]')!;
        expect(swap).not.toBeNull();
        const [shadow, photo] = [...swap.querySelectorAll("img")];
        expect(shadow.getAttribute("src")).toBe(framing.shadow);
        expect(photo.getAttribute("src")).toBe(capSwapPlateUrl(framing, plate("GBCyl5MtlRollCuMatt")));
        expect(photo.getAttribute("alt")).toBe("5 ml Clear Cylinder Roll-On Bottle, Matte Copper");
        expect((photo.parentElement as HTMLElement).style.left).toBe(capSwapPlateBox(framing).left);
        expect((photo.parentElement as HTMLElement).style.mixBlendMode).toBe("multiply");
        expect(container.querySelector("a")?.className).toContain("aspect-[10/11]");
    });

    it("keeps the hero until the picked cap's plate has loaded, and for heroes without a calibration", () => {
        render(hero, copper);
        expect(container.querySelector('[data-testid="catalog-card-cap-swap"]')).toBeNull();
        expect(container.querySelector("img")?.getAttribute("src")).toBe(hero.url);
        act(() => root.unmount()); container.remove();

        plates.current = { GBCyl5MtlRollCuMatt: plate("GBCyl5MtlRollCuMatt") };
        render({ ...hero, url: "/images/catalog/uncalibrated.png" }, copper);
        expect(container.querySelector('[data-testid="catalog-card-cap-swap"]')).toBeNull();
        expect(container.querySelector("img")?.getAttribute("src")).toBe("/images/catalog/uncalibrated.png");
    });

    it("shows the hero when the default cap is pictured", () => {
        plates.current = { GBCyl5MtlRollCuMatt: plate("GBCyl5MtlRollCuMatt") };
        render(hero, null);
        expect(container.querySelector('[data-testid="catalog-card-cap-swap"]')).toBeNull();
        expect(container.querySelector("img")?.getAttribute("src")).toBe(hero.url);
    });
});
