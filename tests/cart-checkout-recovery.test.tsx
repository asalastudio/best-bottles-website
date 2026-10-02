// @vitest-environment jsdom
import React, { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";


vi.mock("@/lib/analytics", () => ({ analytics: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/cart", useSearchParams: () => new URLSearchParams(),
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
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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
    await act(async () => root.render(<CartProvider><ObserveCart /></CartProvider>));
}

const item = { graceSku: "test-cart-item", itemName: "Test cart item", websiteSku: "test-website-sku", shopifyVariantId: "gid://shopify/ProductVariant/123", quantity: 60, unitPrice: 1, webPrice1pc: 1, checkoutEligible: true };
describe("checkout abandonment", () => {
    it("retains the cart after departure and restores it on Back/reload", async () => {
        await mount();
        await act(async () => cart.addItems([item]));
        const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ checkoutUrl: "https://shop.example/checkout" }) });
        vi.stubGlobal("fetch", request);
        await act(async () => cart.checkout());
        expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ items: [{
            sku: item.graceSku, websiteSku: item.websiteSku, shopifyVariantId: item.shopifyVariantId, quantity: 60,
        }] });
        expect(cart.isCheckingOut).toBe(true);
        await act(async () => window.dispatchEvent(new Event("pagehide")));
        expect(JSON.parse(localStorage.getItem("bb-grace-cart")!)[0]).toMatchObject({ quantity: 60, unitPrice: 1 });
        await act(async () => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
        expect(cart.isCheckingOut).toBe(false);
        expect(cart.items[0].quantity).toBe(60);
        act(() => root.unmount());
        await mount();
        expect(cart.items[0]).toMatchObject({ quantity: 60, unitPrice: 1 });
    });
});
