// @vitest-environment jsdom
import React, { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { elegant } from "./fixtures/elegant-tier-pricing";

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
// Asset rendering and navigation are outside the pricing flow.
vi.mock("@/components/pdp/PdpStage", () => ({ default: () => null, useIsPdpMobile: () => false }));
vi.mock("@/components/useGrace", () => ({ useGrace: () => ({ openPanel: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({ analytics: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/products/elegant-15ml-clear-rollon", useSearchParams: () => new URLSearchParams(),
}));

// Keep the real navigation lifecycle; stub only the browser's external navigation.
vi.mock("@/lib/checkout", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/checkout")>();
    return { ...actual, redirectToCheckout: (options: Parameters<typeof actual.redirectToCheckout>[0]) =>
        actual.redirectToCheckout({ ...options, navigationTarget: {
            addEventListener: window.addEventListener.bind(window),
            removeEventListener: window.removeEventListener.bind(window),
            location: { assign: vi.fn() },
        } }),
    };
});

import { CartProvider, useCart } from "@/components/CartProvider";
import CartPage from "@/app/cart/page";
import PdpRedesignPage, { type PdpRedesignPayload } from "@/components/pdp/PdpRedesignPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const slug = "elegant-15ml-clear-rollon";
const payload: PdpRedesignPayload = {
    slug, group: {
        _id: "group", slug, displayName: "15 ml Clear Elegant", family: "Elegant", capacity: "15 ml", capacityMl: 15,
        color: "Clear", category: "Glass Bottle", neckThreadSize: "13-415", primaryWebsiteSku: elegant.websiteSku,
        primaryGraceSku: elegant.graceSku, applicatorTypes: ["Metal Roller Ball"], variantCount: 1, heroImageUrl: null,
    },
    variants: [elegant], siblings: [], kitsBySku: {}, platesBySku: {}, descriptions: {}, collection: null, familyHref: "/catalog?family=Elegant",
};
let cart: ReturnType<typeof useCart>;
function ObserveCart() {
    const value = useCart();
    useEffect(() => { cart = value; }, [value]);
    return null;
}
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div"); document.body.append(container);
    Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
});
afterEach(() => { act(() => root?.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function mount() {
    root = createRoot(container);
    await act(async () => root.render(<CartProvider><ObserveCart /><PdpRedesignPage {...payload} /><section data-testid="cart-page"><CartPage /></section></CartProvider>));
}
const $ = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
async function quantity(value: number) {
    const input = $("pdp-qty") as HTMLInputElement;
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, String(value));
        input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
}

describe("Elegant PDP → real cart pricing", () => {
    it("shows the same 60 × $0.88 = $52.80 on the PDP, sticky CTA, order panel and cart", async () => {
        await mount(); await quantity(60);
        expect($("pdp-pack-toggle").textContent).toContain("$0.88/set");
        expect($("pdp-add").textContent).toContain("$52.80");
        expect($("pdp-sticky-bar").textContent).toContain("$52.80");
        await act(async () => $("pdp-pack-toggle").click());
        expect($("pdp-pack-menu").querySelector('[data-tier-min="12"]')?.textContent).toMatch(/\$0.84.*quote/i);
        await act(async () => $("pdp-add").click());
        expect(cart.items[0]).toMatchObject({ quantity: 60, unitPrice: 0.88, websiteSku: elegant.websiteSku });
        expect($("pdp-order-lines").textContent).toContain("$52.80");
        expect($("cart-page").textContent).toContain("$52.80");
        expect($("pdp-order-minimum").textContent).toContain("minimum reached");
    });

    it("keeps merged additions and cart quantity edits on the charged rate across tier breaks", async () => {
        await mount();
        await quantity(6); await act(async () => $("pdp-add").click());
        await quantity(6); await act(async () => $("pdp-add").click());
        expect(cart.items).toHaveLength(1);
        expect(cart.items[0]).toMatchObject({ quantity: 12, unitPrice: 0.88 });
        expect($("pdp-order-lines").textContent).toContain("$10.56");
        for (const [qty, total] of [[11, "$9.68"], [12, "$10.56"], [144, "$126.72"], [60, "$52.80"]] as const) {
            await act(async () => cart.updateQuantity(elegant.graceSku, qty));
            expect($("pdp-order-lines").textContent).toContain(total);
            expect($("cart-page").textContent).toContain(total);
        }
    });

    it("reprices a restored cart under the current checkout policy", async () => {
        localStorage.setItem("bb-grace-cart", JSON.stringify([{
            ...elegant, quantity: 60, unitPrice: 0.84, productGroupSlug: slug, checkoutEligible: true,
        }]));
        await mount();
        expect(cart.items[0].unitPrice).toBe(0.88);
        expect($("pdp-order-lines").textContent).toContain("$52.80");
        expect($("cart-page").textContent).toContain("$52.80");
    });
});


describe("checkout abandonment", () => {
    it("retains the cart after departure and restores it on Back/reload", async () => {
        await mount(); await quantity(60); await act(async () => $("pdp-add").click());
        const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ checkoutUrl: "https://shop.example/checkout" }) });
        vi.stubGlobal("fetch", request);
        await act(async () => cart.checkout());
        expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ items: [{
            sku: elegant.graceSku, websiteSku: elegant.websiteSku, shopifyVariantId: elegant.shopifyVariantId, quantity: 60,
        }] });
        expect(cart.isCheckingOut).toBe(true);
        await act(async () => window.dispatchEvent(new Event("pagehide")));
        expect(JSON.parse(localStorage.getItem("bb-grace-cart")!)[0]).toMatchObject({ quantity: 60, unitPrice: 0.88 });
        await act(async () => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
        expect(cart.isCheckingOut).toBe(false);
        expect(cart.items[0].quantity).toBe(60);
        act(() => root.unmount());
        await mount();
        expect(cart.items[0]).toMatchObject({ quantity: 60, unitPrice: 0.88 });
        expect($("cart-page").textContent).toContain("$52.80");
    });
});
