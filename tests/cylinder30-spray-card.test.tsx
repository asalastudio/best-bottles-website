// @vitest-environment jsdom
import { act, createElement, type ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getCatalogHero, type CatalogHero } from "@/lib/products/catalog-heroes";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import { getCatalogCardVariantPreviews } from "@/lib/products/product-card-variant-previews";
import { inferGroupApplicatorTypes, inferVariantApplicator } from "@/lib/products/applicator-inference";

const plates = vi.hoisted(() => ({ current: {} as Record<string, { image: string; imageCapOff: string | null; thumb: string; thumbCapOff: string | null }> }));
vi.mock("@/lib/products/cylinder-master", () => ({ cylinderMasterSku: () => null, cylinderMasterSource: () => null, masterProductHref: (href: string) => href }));
vi.mock("convex/react", () => ({ useQuery: () => ({ plates: plates.current, conflicts: [] }) }));
vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; unoptimized?: boolean }) => {
    const p = { ...props } as Record<string, unknown>; delete p.fill; delete p.unoptimized; return createElement("img", p);
} }));

import CatalogCardPreview from "@/components/catalog/CatalogCardPreview";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const previousFlag = process.env.NEXT_PUBLIC_CATALOG_HERO_PILOT;
beforeAll(() => { process.env.NEXT_PUBLIC_CATALOG_HERO_PILOT = "families-2026-09-22"; });
afterAll(() => { process.env.NEXT_PUBLIC_CATALOG_HERO_PILOT = previousFlag; });

const SLUG = "cylinder-30ml-clear-18-415";
// Production rows as Convex holds them: no applicator; the gold row carries a stray "Screw Cap" capStyle.
const goldRow = {
    id: "gold", websiteSku: "GBSpry1ozGl", graceSku: "GB-SPR-CLR-30ML-GLD", applicator: null, capColor: "Shiny Gold",
    capStyle: "Screw Cap", color: "Clear", itemName: "Clear Glass Spray Bottle with Gold Top and Base. Capacity: 1oz (30ml)",
};
const silverRow = {
    id: "silver", websiteSku: "GBSpry1ozSl", graceSku: "GB-SPR-CLR-30ML-SLV", applicator: null, capColor: "Silver",
    capStyle: null, color: "Clear", itemName: "Clear Glass Spray Bottle with Silver Top and Base. Capacity: 1oz (30ml)",
};
const group = {
    slug: SLUG, family: "Cylinder", capacity: "30 ml (1.01 oz)", capacityMl: 30, color: "Clear", category: "Glass Bottle",
    neckThreadSize: "18-415", applicatorTypes: [] as string[], displayName: "30 ml Clear Cylinder Bottle with Cap",
};

describe("30 ml Cylinder spray naming with a null applicator", () => {
    it("names the catalog card as a perfume spray bottle", () => {
        expect(getCustomerFacingProductName({ group, fallbackName: group.displayName }).displayName).toBe("30 ml Clear Cylinder Perfume Spray Bottle");
        // A null applicator may also surface as the Cap/Closure default.
        expect(getCustomerFacingProductName({ group: { ...group, applicatorTypes: ["Cap/Closure"] }, fallbackName: group.displayName }).displayName)
            .toBe("30 ml Clear Cylinder Perfume Spray Bottle");
    });

    it("names each PDP finish as a perfume spray bottle", () => {
        expect(getCustomerFacingProductName({ group, variant: goldRow, fallbackName: group.displayName }).displayName)
            .toBe("30 ml Clear Cylinder Perfume Spray Bottle - Shiny Gold");
        expect(getCustomerFacingProductName({ group, variant: silverRow, fallbackName: group.displayName }).displayName)
            .toBe("30 ml Clear Cylinder Perfume Spray Bottle - Silver");
    });

    it("leaves other null-applicator capped groups as they were", () => {
        const capped = { ...group, slug: "cylinder-15ml-clear-18-415", capacity: "15 ml", capacityMl: 15, displayName: "15 ml Clear Cylinder Bottle with Cap" };
        expect(getCustomerFacingProductName({ group: capped, fallbackName: capped.displayName }).displayName).toBe("15 ml Clear Cylinder Bottle with Cap");
        expect(inferGroupApplicatorTypes(capped)).toEqual([]);
        expect(inferGroupApplicatorTypes({ slug: SLUG, applicatorTypes: ["Metal Roller Ball"] })).toEqual(["Metal Roller Ball"]);
    });

    it("infers only an empty applicator, from spray evidence", () => {
        expect(inferVariantApplicator(goldRow)).toBe("Fine Mist Sprayer");
        expect(inferVariantApplicator({ ...goldRow, applicator: "Metal Roller Ball" })).toBe("Metal Roller Ball");
        expect(inferVariantApplicator({ websiteSku: "GBCyl15Blk", itemName: "Clear Glass Bottle with Black Cap", applicator: null })).toBeNull();
    });
});

describe("30 ml Cylinder spray swatch labels", () => {
    it("reads Shiny Gold beside Silver, not Screw Cap Shiny Gold", () => {
        const previews = getCatalogCardVariantPreviews([goldRow, silverRow], { productTitle: "30 ml Clear Cylinder Perfume Spray Bottle", groupColor: "Clear", primarySku: "GBSpry1ozGl" });
        expect(previews.map(p => p.label).sort()).toEqual(["Shiny Gold", "Silver"]);
    });

    it("keeps a Screw Cap style on a capped bottle", () => {
        const capped = { id: "c", websiteSku: "GBCyl15ScrwBlk", graceSku: "GB-CYL-CLR-15ML-CAP-BLK", applicator: "Cap/Closure", capColor: "Black", capStyle: "Screw Cap", color: "Clear", itemName: "Clear Glass Bottle with Black Screw Cap" };
        const previews = getCatalogCardVariantPreviews([capped], { productTitle: "15 ml Clear Cylinder Bottle", groupColor: "Clear" });
        expect(previews[0]?.label).toBe("Screw Cap Black");
    });
});

const SILVER_PLATE = "https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/plates/cylinder-30ml-clear-18-415/GBSpry1ozSl/4fc9b930f58a2770b7f1e5eba9731b0c754880c3faf98e9994766da58b2f90d1.front-on-1000x1100.webp";
const gold = { id: "gold", label: "Shiny Gold", websiteSku: "GBSpry1ozGl", optionType: "capColor" as const };
const silver = { id: "silver", label: "Silver", websiteSku: "GBSpry1ozSl", optionType: "capColor" as const };

let root: Root;
let container: HTMLDivElement;
function render(catalogHero: CatalogHero, selected: typeof silver | null) {
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    act(() => root.render(createElement(CatalogCardPreview, {
        title: "30 ml Clear Cylinder Perfume Spray Bottle", catalogHero, imageUrl: null,
        href: `/products/${SLUG}`, variants: [gold, silver], family: "Cylinder", slug: SLUG, selected,
        selectedHero: selected ? getCatalogHero(SLUG, [selected], selected.websiteSku) : null,
    })));
}
const srcs = () => [...container.querySelectorAll("img")].map(img => img.getAttribute("src"));
afterEach(() => { act(() => root?.unmount()); container?.remove(); plates.current = {}; });

describe("picking Silver on the 30 ml Cylinder spray card", () => {
    it("has a gold hero and no silver hero", () => {
        const hero = getCatalogHero(SLUG, [gold, silver])!;
        expect(hero.websiteSku).toBe("GBSpry1ozGl");
        expect(getCatalogHero(SLUG, [silver], silver.websiteSku)).toBeNull();
    });

    it("shows the silver plate, and the gold hero again when unpicked", () => {
        const hero = getCatalogHero(SLUG, [gold, silver])!;
        plates.current = { GBSpry1ozSl: { image: SILVER_PLATE, imageCapOff: null, thumb: SILVER_PLATE, thumbCapOff: null } };
        render(hero, silver);
        expect(srcs()).toEqual([SILVER_PLATE]);
        expect(container.querySelector('[data-bb-website-sku="GBSpry1ozSl"]')).not.toBeNull();
        act(() => root.unmount()); container.remove();
        render(hero, null);
        expect(srcs()).toContain(hero.url);
        expect(srcs()).not.toContain(SILVER_PLATE);
    });

    it("keeps the gold hero when the silver pick has no image of its own", () => {
        const hero = getCatalogHero(SLUG, [gold, silver])!;
        render(hero, silver);
        expect(srcs()).toContain(hero.url);
    });
});
