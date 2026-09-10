// @vitest-environment jsdom
import React, { act, type ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
const addItems = vi.hoisted(() => vi.fn());
vi.mock("mixpanel-browser", () => ({
    default: {
        init: vi.fn(), identify: vi.fn(), reset: vi.fn(), track, people: { set: vi.fn() },
        register: vi.fn(), set_group: vi.fn(), get_group: vi.fn(() => ({ set: vi.fn() })), time_event: vi.fn(),
    },
}));
vi.mock("@/components/CartProvider", () => ({ useCart: () => ({ addItems }) }));
vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    const p = { ...props } as Record<string, unknown>; delete p.fill; delete p.unoptimized; return React.createElement("img", p);
} }));

import CatalogCardPurchase from "@/components/catalog/CatalogCardPurchase";
import type { CatalogPurchaseVariant } from "@/lib/products/catalog-card-purchase";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom ships <dialog> without showModal/close; mirror the browser contract.
beforeAll(() => {
    const proto = HTMLDialogElement.prototype as HTMLDialogElement & { showModal?: () => void; close?: () => void };
    if (typeof proto.showModal !== "function") {
        proto.showModal = function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
        proto.close = function (this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
    }
});

const ladder = [
    { minQty: 1, unitPrice: 0.92 }, { minQty: 12, unitPrice: 0.76 }, { minQty: 48, unitPrice: 0.64 },
    { minQty: 144, unitPrice: 0.56 }, { minQty: 500, unitPrice: 0.53 },
];
const variant: CatalogPurchaseVariant = {
    id: "v-black", graceSku: "CYL5-ROLL-BLK", websiteSku: "GBCyl5RollBlk", itemName: "5 ml Clear Cylinder Roll-On, Black Cap",
    optionLabel: "Black Roller", applicator: "Roll-On", capColor: "Black", stockStatus: "In Stock", caseQuantity: 144,
    webPrice1pc: 0.92, webPrice10pc: null, webPrice12pc: 0.76, priceTiers: ladder,
    shopifyVariantId: "gid://shopify/ProductVariant/1", shopifySellable: true,
};
const context = { family: "Cylinder", capacity: "5 ml", color: "Clear", category: "Bottle", neckThreadSize: "13-415" };
const base = { productId: "cylinder-5ml-clear-roll-on", sku: "GBCyl5RollBlk" };

let root: Root;
let el: HTMLDivElement;
function render(node: React.ReactElement) {
    el = document.createElement("div"); document.body.append(el); root = createRoot(el);
    act(() => root.render(node));
}
function card(overrides: Partial<CatalogPurchaseVariant> | null = {}) {
    render(<CatalogCardPurchase productId="cylinder-5ml-clear-roll-on" title="5 ml Clear Cylinder Roll-On Bottle" href="/products/cylinder-5ml-clear-roll-on"
        variant={overrides === null ? null : { ...variant, ...overrides }} groupStartingPrice={0.53} context={context} imageUrl="/hero.webp" />);
}
const $ = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;
const $$ = (testId: string) => [...el.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`)];
const dialog = () => $("catalog-card-tier-dialog") as HTMLDialogElement;
const click = (target: Element) => act(() => { target.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
function type(input: HTMLInputElement, value: string) {
    act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
    });
}
const events = () => track.mock.calls.map((call) => call[0]);

beforeEach(() => { track.mockClear(); addItems.mockClear(); });
afterEach(() => { act(() => root?.unmount()); el?.remove(); });

describe("tier pricing dialog on the catalog card", () => {
    it("headlines the deepest break and opens the ladder in a modal from a thin-plus trigger", () => {
        card();
        expect($("catalog-card-price").textContent).toBe("From $0.53/ea");
        const toggle = $("catalog-card-tier-toggle");
        expect(toggle.tagName).toBe("BUTTON");
        expect(toggle.getAttribute("aria-haspopup")).toBe("dialog");
        expect(toggle.getAttribute("aria-expanded")).toBe("false");
        expect(toggle.getAttribute("aria-controls")).toBe(dialog().id);
        expect(toggle.textContent).toContain("View tier pricing");
        expect(toggle.querySelector("svg")).not.toBeNull();
        // Reads top-down: quantity → tier pricing → Add to cart.
        const after = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
        expect(after($("catalog-card-qty"), toggle)).toBe(true);
        expect(after(dialog(), $("catalog-card-add"))).toBe(true);
        expect(dialog().hasAttribute("open")).toBe(false);

        click(toggle);
        expect(dialog().hasAttribute("open")).toBe(true);
        expect(toggle.getAttribute("aria-expanded")).toBe("true");
        expect(document.getElementById(dialog().getAttribute("aria-labelledby")!)?.textContent).toBe("5 ml Clear Cylinder Roll-On Bottle");
        expect(dialog().querySelector("img")?.getAttribute("src")).toBe("/hero.webp");
        const rows = $$("catalog-card-tier-row");
        expect(rows.every((row) => dialog().contains(row))).toBe(true);
        expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
            "1–11 units at $0.92 each",
            "12–47 units at $0.76 each, save 17%",
            "48–143 units at $0.64 each, save 30%",
            "144–499 units at $0.56 each, save 39%",
            "500+ units at $0.53 each, save 42%",
        ]);
        expect(rows.map((row) => row.getAttribute("aria-checked"))).toEqual(["true", "false", "false", "false", "false"]);
        expect(document.activeElement).toBe(rows[0]);
        expect(dialog().querySelector('[role="radiogroup"]')).not.toBeNull();
        expect($("catalog-card-tier-footnote").textContent).toBe("Online checkout bills $0.92/ea. 12+ rates are confirmed on a quote.");
        expect(events()).toEqual(["tier_pricing_opened"]);
        expect(track.mock.calls[0][1]).toEqual({ ...base, quantity: 1, tier: "1–11" });

        click($("catalog-card-tier-close"));
        expect(dialog().hasAttribute("open")).toBe(false);
        expect(toggle.getAttribute("aria-expanded")).toBe("false");
        expect(document.activeElement).toBe(toggle);
        expect(events()).toEqual(["tier_pricing_opened", "tier_pricing_closed"]);
    });

    it("prepopulates the quantity from a tier and mirrors it between the dialog and the card", () => {
        card();
        click($("catalog-card-tier-toggle"));
        const cardQty = $("catalog-card-qty") as HTMLInputElement;
        const dialogQty = $("catalog-card-dialog-qty") as HTMLInputElement;
        click($$("catalog-card-tier-row")[3]);
        expect(cardQty.value).toBe("144");
        expect(dialogQty.value).toBe("144");
        expect($$("catalog-card-tier-row").map((row) => row.dataset.tierActive)).toEqual(["false", "false", "false", "true", "false"]);
        for (const live of $$("catalog-card-active-tier")) {
            expect(live.textContent).toBe("$0.56/ea · 144–499Save 39% · Subtotal $80.64");
            expect(live.getAttribute("aria-live")).toBe("polite");
        }
        expect(track.mock.calls.at(-1)).toEqual(["tier_selected", { ...base, quantity: 144, tier: "144–499" }]);

        type(dialogQty, "600");
        expect(cardQty.value).toBe("600");
        expect($$("catalog-card-tier-row").map((row) => row.dataset.tierActive)).toEqual(["false", "false", "false", "false", "true"]);
        expect($("catalog-card-active-tier").textContent).toBe("$0.53/ea · 500+Save 42% · Subtotal $318.00");
        act(() => { dialogQty.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
        expect(track.mock.calls.at(-1)).toEqual(["quantity_changed", { ...base, quantity: 600, tier: "500+", source: "input" }]);

        act(() => { dialog().querySelector('[role="radiogroup"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })); });
        expect(cardQty.value).toBe("144");
        expect(dialog().hasAttribute("open")).toBe(true);
    });

    it("steps with the card's plus/minus controls and validates whole numbers from 1", () => {
        card();
        const qty = $("catalog-card-qty") as HTMLInputElement;
        const [minus, plus] = [...el.querySelectorAll<HTMLButtonElement>('button[aria-label$="crease quantity"]')].slice(0, 2);
        expect(minus.disabled).toBe(true);
        click(plus); click(plus);
        expect(qty.value).toBe("3");
        expect(track.mock.calls.at(-1)).toEqual(["quantity_changed", { ...base, quantity: 3, tier: "1–11", source: "stepper" }]);
        click(minus);
        expect(qty.value).toBe("2");
        expect($("catalog-card-active-tier").textContent).toBe("$0.92/ea · 1–11Subtotal $1.84");

        type(qty, "0");
        expect($("catalog-card-qty-error").textContent).toBe("Enter a quantity of 1 or more.");
        expect(qty.getAttribute("aria-invalid")).toBe("true");
        expect(qty.getAttribute("aria-describedby")).toBe($("catalog-card-qty-error").id);
        expect(($("catalog-card-add") as HTMLButtonElement).disabled).toBe(true);
        type(qty, "12.5");
        expect($("catalog-card-qty-error").textContent).toBe("Use whole numbers only.");
        type(qty, "48");
        expect(el.querySelector('[data-testid="catalog-card-qty-error"]')).toBeNull();
        expect(qty.getAttribute("aria-describedby")).toBe($("catalog-card-active-tier").id);
        expect(el.querySelector('label[for="' + qty.id + '"]')?.textContent).toBe("Quantity");
        expect(($("catalog-card-add") as HTMLButtonElement).disabled).toBe(false);
    });

    it("adds the exact assembly and quantity from the card without navigating", () => {
        card();
        type($("catalog-card-qty") as HTMLInputElement, "200");
        expect(el.querySelector("a[href]")).toBeNull();
        click($("catalog-card-add"));
        expect(addItems).toHaveBeenCalledTimes(1);
        expect(addItems.mock.calls[0][0]).toEqual([expect.objectContaining({
            graceSku: "CYL5-ROLL-BLK", websiteSku: "GBCyl5RollBlk", quantity: 200, unitPrice: 0.92,
            priceTiers: ladder, productGroupSlug: "cylinder-5ml-clear-roll-on", capColor: "Black",
        })]);
        expect(events()).toEqual(["quick_add_clicked", "Cart Item Added", "quick_add_success"]);
        expect(track.mock.calls[2][1]).toEqual({ ...base, quantity: 200, tier: "144–499" });
        expect($("catalog-card-add").textContent).toContain("Added");
        expect($("catalog-card-added").textContent).toContain("Added 200 to your cart.");
    });

    it("adds from inside the dialog and closes it so the card shows the confirmation", () => {
        card();
        click($("catalog-card-tier-toggle"));
        click($$("catalog-card-tier-row")[2]);
        click($("catalog-card-dialog-add"));
        expect(addItems.mock.calls[0][0][0]).toMatchObject({ graceSku: "CYL5-ROLL-BLK", quantity: 48 });
        expect(dialog().hasAttribute("open")).toBe(false);
        expect($("catalog-card-tier-toggle").getAttribute("aria-expanded")).toBe("false");
        expect($("catalog-card-added").textContent).toContain("Added 48 to your cart.");
        expect(events()).toEqual(["tier_pricing_opened", "tier_selected", "quick_add_clicked", "Cart Item Added", "quick_add_success", "tier_pricing_closed"]);
    });

    it("keeps the card usable without a ladder and hides the trigger", () => {
        card({ priceTiers: null, webPrice10pc: null, webPrice12pc: null, webPrice1pc: 0.95 });
        expect($("catalog-card-price").textContent).toBe("From $0.95/ea");
        expect(el.querySelector('[data-testid="catalog-card-tier-toggle"]')).toBeNull();
        expect(el.querySelector("dialog")).toBeNull();
        type($("catalog-card-qty") as HTMLInputElement, "10");
        expect($("catalog-card-active-tier").textContent).toBe("$0.95/eaSubtotal $9.50");
        expect($("catalog-card-add")).not.toBeNull();
    });

    it("routes unsellable assemblies to a quote and unpriced groups to the product page", () => {
        card({ shopifySellable: false });
        expect(el.querySelector('[data-testid="catalog-card-add"]')).toBeNull();
        const quote = $("catalog-card-quote") as HTMLAnchorElement;
        expect(quote.getAttribute("href")).toContain("/request-quote?products=");
        expect(quote.getAttribute("href")).toContain(encodeURIComponent("SKU: CYL5-ROLL-BLK"));
        expect($("catalog-card-tier-toggle")).not.toBeNull();
        expect($("catalog-card-dialog-quote")).not.toBeNull();
        act(() => root.unmount()); el.remove();

        card({ webPrice1pc: null });
        expect($("catalog-card-purchase").dataset.state).toBe("unpriced");
        expect($("catalog-card-price").textContent).toBe("From $0.53/ea");
        expect(el.querySelector("a[href='/products/cylinder-5ml-clear-roll-on']")?.textContent).toBe("View options");
        act(() => root.unmount()); el.remove();

        card(null);
        expect($("catalog-card-purchase").dataset.state).toBe("unpriced");
    });
});
