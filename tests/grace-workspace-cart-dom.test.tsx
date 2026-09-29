// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CartProvider, type CartItem } from "@/components/CartProvider";
import WorkspaceCart from "@/components/grace-workspace/WorkspaceCart";

const mocks = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: (...args: unknown[]) => mocks.lookup(...args) }));
vi.mock("@/lib/analytics", () => ({ analytics: { cartItemRemoved: vi.fn(), checkoutStarted: vi.fn(), checkoutFailed: vi.fn(), checkoutRedirected: vi.fn() } }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
const bottle: CartItem = { graceSku: "BOTTLE-1", websiteSku: "ExactBottleSKU", itemName: "9 ml Cobalt Cylinder", quantity: 12, unitPrice: 1, checkoutEligible: true, shopifyVariantId: "123", capColor: "Matte Silver", neckThreadSize: "17-415" };
let root: Root;
let container: HTMLDivElement;
function Harness() { const [open, setOpen] = useState(false); return <CartProvider><WorkspaceCart open={open} onOpenChange={setOpen} /></CartProvider>; }
function button(label: string) { return [...document.querySelectorAll<HTMLButtonElement>("button")].find(el => el.getAttribute("aria-label") === label || el.textContent?.trim() === label)!; }
function stored(): CartItem[] { return JSON.parse(localStorage.getItem("bb-grace-cart") ?? "[]"); }
async function openCart(items: CartItem[] = [bottle]) {
    localStorage.setItem("bb-grace-cart", JSON.stringify(items));
    await act(async () => root.render(<Harness />));
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click());
}
async function quantity(value: string) {
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Quantity for 9 ml Cobalt Cylinder"]')!;
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => input.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
}
beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    mocks.lookup.mockReturnValue({ product: { graceSku: bottle.graceSku, websiteSku: bottle.websiteSku, imageUrl: "/exact-bottle.png" }, slug: "cylinder-cobalt" });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); localStorage.clear(); vi.unstubAllGlobals(); });

describe("workspace cart", () => {
    it("shows exact product imagery, pieces, pricing, and a gated minimum", async () => {
        await openCart();
        expect(document.querySelector('[role="dialog"]')?.textContent).toContain("1 product · 12 pieces");
        expect(document.querySelector('img')?.getAttribute("src")).toBe("/exact-bottle.png");
        expect(document.querySelector('a[aria-label="View 9 ml Cobalt Cylinder"]')?.getAttribute("href")).toBe("/products/cylinder-cobalt?sku=ExactBottleSKU");
        expect(document.body.textContent).toContain("$38.00");
        expect(button("Continue to checkout").disabled).toBe(true);
    });
    it("accepts typed whole-piece quantities and updates the live subtotal", async () => {
        await openCart(); await quantity("144");
        expect(stored()[0].quantity).toBe(144);
        expect(document.body.textContent).toContain("$144.00");
        expect(button("Continue to checkout").disabled).toBe(false);
    });
    it.each(["0", "-1", "1.5", "100001", ""]) ("rejects invalid quantity %s without changing the cart", async value => {
        await openCart(); await quantity(value);
        expect(stored()[0].quantity).toBe(12);
        expect(document.querySelector('[role="alert"]')?.textContent).toContain("quantity hasn’t changed");
    });
    it("removes and restores the exact line with Undo", async () => {
        await openCart(); await act(async () => button("Remove 9 ml Cobalt Cylinder").click());
        expect(stored()).toEqual([]); expect(document.body.textContent).toContain("Start with a bottle.");
        await act(async () => button("Undo").click());
        expect(stored()[0]).toMatchObject({ graceSku: bottle.graceSku, websiteSku: bottle.websiteSku, quantity: 12, capColor: "Matte Silver" });
    });
    it("does not count unavailable items toward the minimum or silently omit them at checkout", async () => {
        await openCart([{ ...bottle, quantity: 60 }, { ...bottle, graceSku: "BLOCKED", itemName: "Unavailable bottle", quantity: 100, unitPrice: 10, shopifySellable: false }]);
        expect(document.body.textContent).toContain("Checkout-ready subtotal$60.00");
        expect(document.body.textContent).toContain("1 product needs review");
        expect(button("Continue to checkout").disabled).toBe(true);
    });
    it("never borrows the photo or product page of a mismatched SKU", async () => {
        mocks.lookup.mockReturnValue({ product: { graceSku: "WRONG", websiteSku: "WrongBottle", imageUrl: "/wrong.png" }, slug: "wrong-bottle" });
        await openCart();
        expect(document.querySelector("img")).toBeNull();
        expect(document.querySelector('a[aria-label="View 9 ml Cobalt Cylinder"]')?.getAttribute("href")).toBe("/catalog?search=ExactBottleSKU");
    });
    it("keeps items visible when checkout reports an error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Please check availability and try again." }) }));
        await openCart([{ ...bottle, quantity: 60 }]);
        await act(async () => button("Continue to checkout").click());
        expect(document.querySelector('[role="alert"]')?.textContent).toContain("Please check availability");
        expect(stored()[0].quantity).toBe(60);
        expect(button("Continue to checkout").disabled).toBe(false);
    });
    it("returns focus to the cart trigger when returning to Grace", async () => {
        await openCart(); await act(async () => button("Back to Grace").click());
        await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        expect(document.activeElement?.getAttribute("aria-haspopup")).toBe("dialog");
        expect(stored()[0].quantity).toBe(12);
    });
});
