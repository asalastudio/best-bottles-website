// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartItem } from "@/components/CartProvider";

const mocks = vi.hoisted(() => ({
    pathname: "/catalog", search: "category=Component", checkout: vi.fn(),
    items: [] as CartItem[], hydrated: true, checkingOut: false,
}));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname, useSearchParams: () => new URLSearchParams(mocks.search) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/useGrace", () => ({ useGrace: () => ({ openPanel: vi.fn() }) }));
vi.mock("@/components/CartProvider", () => ({ useCart: () => ({
    items: mocks.items, itemCount: mocks.items.reduce((count, item) => count + item.quantity, 0),
    isCartHydrated: mocks.hydrated, checkout: mocks.checkout, isCheckingOut: mocks.checkingOut,
    removeItem: vi.fn(), updateQuantity: vi.fn(), checkoutError: "",
}) }));
// Keep real dialog effects/focus behavior; remove animation timing from these DOM assertions.
vi.mock("framer-motion", () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: { div: ({ children, initial, animate, exit, transition, ...props }: React.ComponentProps<"div"> & Record<string, unknown>) => {
        void initial; void animate; void exit; void transition;
        return <div {...props}>{children}</div>;
    } },
}));

import CartPage from "@/app/cart/page";
import CartDrawer from "@/components/CartDrawer";
import { CartShoppingTracker } from "@/components/CartShoppingContext";
import { CART_SHOPPING_RETURN_KEY } from "@/lib/cartShoppingReturn";
import { RegionProvider } from "@/components/RegionProvider";

let root: Root;
let container: HTMLDivElement;
const line = (price: number, extra: Partial<CartItem> = {}): CartItem => ({
    graceSku: "READY", itemName: "Eligible bottle", quantity: 1, unitPrice: price,
    shopifyVariantId: "123", ...extra,
});
function buttons() { return [...container.querySelectorAll<HTMLButtonElement>("button")]; }
function checkout() { return container.querySelector<HTMLButtonElement>('[data-testid$="checkout-button"], [data-testid="checkout-start-button"]')!; }
async function render(surface: "page" | "drawer", market = "US") {
    await act(async () => root.render(<RegionProvider initialMarketCode={market}>{surface === "page" ? <CartPage /> : <CartDrawer isOpen onClose={vi.fn()} />}</RegionProvider>));
}
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0; });
    mocks.items = [line(49.99)]; mocks.hydrated = true; mocks.checkingOut = false;
    mocks.pathname = "/catalog"; mocks.search = "category=Component"; mocks.checkout.mockClear();
    sessionStorage.clear(); container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); sessionStorage.clear(); });

describe.each(["page", "drawer"] as const)("%s minimum clarity", surface => {
    it("explains the 49.99 boundary beside disabled checkout and enables exactly 50", async () => {
        await render(surface);
        expect(checkout().disabled).toBe(true);
        const notice = document.getElementById(checkout().getAttribute("aria-describedby")!)!;
        expect(notice.textContent).toContain("Add $0.01 more to check out.");
        expect(notice.textContent).toContain("Checkout requires a $50.00 minimum.");
        expect(notice.getAttribute("role")).toBe("status");
        expect(checkout().parentElement?.contains(notice)).toBe(true);
        await act(async () => checkout().click()); expect(mocks.checkout).not.toHaveBeenCalled();
        mocks.items = [line(50)]; await render(surface);
        expect(checkout().disabled).toBe(false);
        expect(notice.textContent).toContain("$50.00 order minimum met.");
        expect(checkout().className).toContain("bg-obsidian");
        await act(async () => checkout().click()); expect(mocks.checkout).toHaveBeenCalledOnce();
        mocks.checkingOut = true; await render(surface); expect(checkout().disabled).toBe(true);
    });
    it("counts only eligible value even when the displayed cart total exceeds 50", async () => {
        mocks.items = [line(49.99), line(100, { graceSku: "QUOTE", checkoutEligible: false })];
        await render(surface);
        expect(checkout().disabled).toBe(true);
        const notice = document.getElementById(checkout().getAttribute("aria-describedby")!)!;
        expect(notice.textContent).toContain("Checkout-ready subtotal: $49.99.");
        expect(notice.textContent).toContain("Quote-only items do not count");
        mocks.items = [line(100, { checkoutEligible: false })]; await render(surface);
        expect(checkout().disabled).toBe(true);
        expect(notice.textContent).toContain("Add $50.00 more");
    });
    it("offers shopping without a checkout button for an empty cart", async () => {
        mocks.items = []; await render(surface);
        expect(checkout()).toBeNull(); expect(container.textContent).toContain("Your cart is empty");
        expect(container.textContent).toContain("Continue shopping");
        expect(container.textContent).not.toContain("Continue building");
    });
    it("uses the existing currency conversion while retaining the USD gate", async () => {
        await render(surface, "GB");
        const notice = document.getElementById(checkout().getAttribute("aria-describedby")!)!;
        expect(notice.textContent).toContain("Add £0.01 more");
        expect(notice.textContent).toContain("£39.00 minimum");
        expect(notice.textContent).toContain("the minimum is $50 USD");
        expect(checkout().disabled).toBe(true);
    });
});

describe("context navigation", () => {
    it("tracks SPA query changes and preserves the last browse path across cart/reload", async () => {
        await act(async () => root.render(<CartShoppingTracker />));
        expect(sessionStorage.getItem(CART_SHOPPING_RETURN_KEY)).toBe("/catalog?category=Component");
        mocks.pathname = "/es/products/elegant"; mocks.search = "cap=silver";
        await act(async () => root.render(<CartShoppingTracker />));
        mocks.pathname = "/cart"; mocks.search = "";
        await act(async () => root.render(<><CartShoppingTracker /><CartPage /></>));
        const links = [...container.querySelectorAll("a")];
        expect(links.filter(link => link.textContent === "Continue shopping").every(link => link.getAttribute("href") === "/es/products/elegant?cap=silver")).toBe(true);
        await render("page");
        expect(container.querySelector("a")?.getAttribute("href")).toBe("/es/products/elegant?cap=silver");
    });
    it("sanitizes old stored data on the cart and never records hash-only context", async () => {
        sessionStorage.setItem(CART_SHOPPING_RETURN_KEY, "/es/products/elegant?cap=silver&token=private#secret");
        mocks.pathname = "/cart"; mocks.search = "";
        await act(async () => root.render(<><CartShoppingTracker /><CartPage /></>));
        expect(sessionStorage.getItem(CART_SHOPPING_RETURN_KEY)).toBe("/es/products/elegant?cap=silver");
        expect(container.querySelector("a")?.getAttribute("href")).toBe("/es/products/elegant?cap=silver");
        mocks.pathname = "/catalog"; mocks.search = "category=Component&email=buyer%40example.test";
        window.history.replaceState(null, "", "/catalog#token=private");
        await act(async () => root.render(<CartShoppingTracker />));
        expect(sessionStorage.getItem(CART_SHOPPING_RETURN_KEY)).toBe("/catalog?category=Component");
        await act(async () => { window.history.replaceState(null, "", "/catalog#another-private-fragment"); window.dispatchEvent(new HashChangeEvent("hashchange")); });
        expect(sessionStorage.getItem(CART_SHOPPING_RETURN_KEY)).toBe("/catalog?category=Component");
        window.history.replaceState(null, "", "/");
    });
    it("returns to a recorded BYB context only, with catalog as the safe fallback", async () => {
        sessionStorage.setItem(CART_SHOPPING_RETURN_KEY, "/es/matrix?family=Elegant");
        await render("page");
        expect(container.querySelector("a")?.textContent).toBe("Continue building");
        expect(container.querySelector("a")?.getAttribute("href")).toBe("/es/matrix?family=Elegant");
        sessionStorage.setItem(CART_SHOPPING_RETURN_KEY, "//evil.example"); await render("page");
        expect(container.querySelector("a")?.getAttribute("href")).toBe("/catalog");
    });
    it("falls back safely when storage is unavailable", async () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
        await render("page"); expect(container.querySelector("a")?.getAttribute("href")).toBe("/catalog");
    });
    it.each(["Continue shopping", "Escape"])("closes the drawer with %s and restores focus without navigation", async action => {
        function Harness() {
            const [open, setOpen] = useState(false);
            return <><button onClick={() => setOpen(true)}>Open cart</button><CartDrawer isOpen={open} onClose={() => setOpen(false)} /></>;
        }
        await act(async () => root.render(<Harness />));
        const trigger = buttons()[0]; trigger.focus();
        await act(async () => trigger.click());
        expect(document.activeElement?.getAttribute("aria-label")).toBe("Close cart");
        expect(document.body.style.overflow).toBe("hidden");
        const url = window.location.href;
        await act(async () => action === "Escape" ? window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })) : buttons().find(button => button.textContent === action)!.click());
        expect(container.querySelector('[role="dialog"]')).toBeNull();
        expect(document.activeElement).toBe(trigger);
        expect(document.body.style.overflow).toBe(""); expect(window.location.href).toBe(url);
    });
    it("labels drawer return from the current page, not an older builder visit", async () => {
        sessionStorage.setItem(CART_SHOPPING_RETURN_KEY, "/matrix"); await render("drawer");
        expect(container.textContent).not.toContain("Continue building");
        mocks.pathname = "/es/matrix"; await render("drawer");
        expect(container.textContent).toContain("Continue building");
        expect(container.querySelector('a[href="/matrix"]')).toBeNull();
    });
});
