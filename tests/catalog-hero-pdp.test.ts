// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { getProductHero } from "@/lib/products/catalog-heroes";
import MobileProductHero from "@/components/products/mobile/MobileProductHero";

vi.mock("convex/react", () => ({ useQuery: () => [] }));
vi.mock("@react-three/drei", () => ({ useGLTF: () => ({}) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
function setup() {
    container = document.createElement("div"); document.body.append(container);
    root = createRoot(container); sessionStorage.removeItem("bb:pdp-stage");
}
afterEach(async () => { await act(async () => root?.unmount()); container?.remove(); });

it("swaps desktop heroes by exact selected SKU and preserves the existing photo for a held SKU", async () => {
    const { default: ConfiguratorPdp } = await import("@/components/products/ConfiguratorPdp");
    setup();
    const common = { currentSlug: "atomizer", groupTitle: "Atomizer", capacityLabel: "10 mL", qty: 1, priceEach: 2,
        plateImage: "/existing.webp", plateImageCapOff: "/existing-off.webp" };
    for (const sku of ["GBAtom10Gl", "GBAtom10Blk", "GBAtom5Red"]) {
        await act(async () => root.render(createElement(ConfiguratorPdp, { ...common, websiteSku: sku })));
        const hero = getProductHero(sku);
        const shown = container.querySelector('[data-bb-studio-hero="true"]');
        if (hero) {
            expect(shown?.getAttribute("data-bb-website-sku")).toBe(sku);
            expect(shown?.querySelector("img")?.getAttribute("src")).toBe(hero.url);
            expect(container.querySelector('[aria-label="Cap on or off"]')).toBeNull();
        } else {
            expect(shown).toBeNull();
            expect(container.querySelector('img[src="/existing-off.webp"]')).not.toBeNull();
        }
        expect(container.querySelector('[data-bb-hero-state="filled"]')).toBeNull();
    }
});

it("falls back to the configured mobile plate on a hero load failure and can show the next SKU", async () => {
    setup();
    const common = { plateUrl: "/exact-plate.webp", kitParts: null, fallbackImageUrl: null, alt: "Atomizer",
        backHref: "/catalog", cartCount: 0, onOpenCart: () => {} };
    const gold = getProductHero("GBAtom10Gl")!;
    await act(async () => root.render(createElement(MobileProductHero, { ...common, catalogHero: gold })));
    expect(container.querySelector('[data-bb-studio-hero]')?.getAttribute("data-bb-website-sku")).toBe(gold.websiteSku);
    await act(async () => container.querySelector('img')!.dispatchEvent(new Event("error")));
    expect(container.querySelector('[data-bb-studio-hero]')).toBeNull();
    expect(container.querySelector('img[src="/exact-plate.webp"]')).not.toBeNull();
    const black = getProductHero("GBAtom10Blk")!;
    await act(async () => root.render(createElement(MobileProductHero, { ...common, catalogHero: black })));
    expect(container.querySelector('[data-bb-studio-hero]')?.getAttribute("data-bb-website-sku")).toBe(black.websiteSku);
    expect(container.querySelectorAll('img')).toHaveLength(1);
});
