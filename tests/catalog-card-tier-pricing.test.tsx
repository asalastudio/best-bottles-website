// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
const addItems = vi.hoisted(() => vi.fn());
vi.mock("mixpanel-browser", () => ({
    default: {
        init: vi.fn(), identify: vi.fn(), reset: vi.fn(), track, people: { set: vi.fn() },
        register: vi.fn(), set_group: vi.fn(), get_group: vi.fn(() => ({ set: vi.fn() })), time_event: vi.fn(),
    },
}));
vi.mock("@/components/CartProvider", () => ({ useCart: () => ({ addItems }) }));

import CatalogCardPurchase, { useCatalogTierPanels } from "@/components/catalog/CatalogCardPurchase";
import type { CatalogPurchaseVariant } from "@/lib/products/catalog-card-purchase";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

let root: Root;
let el: HTMLDivElement;
function render(node: React.ReactElement) {
    el = document.createElement("div"); document.body.append(el); root = createRoot(el);
    act(() => root.render(node));
}
function card(overrides: Partial<CatalogPurchaseVariant> | null = {}) {
    render(<CatalogCardPurchase productId="cylinder-5ml-clear-roll-on" title="5 ml Clear Cylinder Roll-On Bottle" href="/products/cylinder-5ml-clear-roll-on"
        variant={overrides === null ? null : { ...variant, ...overrides }} groupStartingPrice={0.53} context={context} />);
}
const $ = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;
const $$ = (testId: string) => [...el.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`)];
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

describe("collapsible tier pricing on the catalog card", () => {
    it("starts collapsed, headlines the deepest break, and opens an accessible five-row ladder", () => {
        card();
        expect($("catalog-card-price").textContent).toBe("From $0.53/ea");
        const toggle = $("catalog-card-tier-toggle");
        const panel = $("catalog-card-tier-panel");
        expect(toggle.tagName).toBe("BUTTON");
        expect(toggle.getAttribute("aria-expanded")).toBe("false");
        expect(toggle.getAttribute("aria-controls")).toBe(panel.id);
        expect(toggle.textContent).toContain("View tier pricing");
        expect(panel.hasAttribute("inert")).toBe(true);
        expect(panel.getAttribute("aria-hidden")).toBe("true");

        click(toggle);
        expect(toggle.getAttribute("aria-expanded")).toBe("true");
        expect(toggle.textContent).toContain("Hide tier pricing");
        expect(panel.hasAttribute("inert")).toBe(false);
        const rows = $$("catalog-card-tier-row");
        expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
            "1–11 units at $0.92 each",
            "12–47 units at $0.76 each, save 17%",
            "48–143 units at $0.64 each, save 30%",
            "144–499 units at $0.56 each, save 39%",
            "500+ units at $0.53 each, save 42%",
        ]);
        expect(rows.map((row) => row.getAttribute("aria-checked"))).toEqual(["true", "false", "false", "false", "false"]);
        expect(el.querySelector('[role="radiogroup"]')).not.toBeNull();
        expect($("catalog-card-tier-footnote").textContent).toBe("Online checkout bills $0.92/ea. 12+ rates are confirmed on a quote.");
        expect(events()).toEqual(["tier_pricing_opened"]);
        expect(track.mock.calls[0][1]).toEqual({ productId: "cylinder-5ml-clear-roll-on", sku: "GBCyl5RollBlk", quantity: 1, tier: "1–11" });

        click(toggle);
        expect(toggle.getAttribute("aria-expanded")).toBe("false");
        expect(events()).toEqual(["tier_pricing_opened", "tier_pricing_closed"]);
    });

    it("prepopulates the quantity from a tier and follows typed quantities back to the right tier", () => {
        card();
        click($("catalog-card-tier-toggle"));
        const qty = $("catalog-card-qty") as HTMLInputElement;
        click($$("catalog-card-tier-row")[3]);
        expect(qty.value).toBe("144");
        expect($$("catalog-card-tier-row").map((row) => row.dataset.tierActive)).toEqual(["false", "false", "false", "true", "false"]);
        expect($("catalog-card-active-tier").textContent).toBe("$0.56/ea · 144–499Save 39% · Subtotal $80.64");
        expect($("catalog-card-active-tier").getAttribute("aria-live")).toBe("polite");
        expect(track.mock.calls.at(-1)).toEqual(["tier_selected", { productId: "cylinder-5ml-clear-roll-on", sku: "GBCyl5RollBlk", quantity: 144, tier: "144–499" }]);

        type(qty, "600");
        expect($$("catalog-card-tier-row").map((row) => row.dataset.tierActive)).toEqual(["false", "false", "false", "false", "true"]);
        expect($("catalog-card-active-tier").textContent).toBe("$0.53/ea · 500+Save 42% · Subtotal $318.00");
        act(() => { qty.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
        expect(track.mock.calls.at(-1)).toEqual(["quantity_changed", { productId: "cylinder-5ml-clear-roll-on", sku: "GBCyl5RollBlk", quantity: 600, tier: "500+", source: "input" }]);

        act(() => { el.querySelector('[role="radiogroup"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })); });
        expect(qty.value).toBe("144");
    });

    it("steps with the plus/minus controls and validates whole numbers from 1", () => {
        card();
        const qty = $("catalog-card-qty") as HTMLInputElement;
        const [minus, plus] = [...el.querySelectorAll<HTMLButtonElement>('button[aria-label$="crease quantity"]')];
        expect(minus.disabled).toBe(true);
        click(plus); click(plus);
        expect(qty.value).toBe("3");
        expect(track.mock.calls.at(-1)).toEqual(["quantity_changed", { productId: "cylinder-5ml-clear-roll-on", sku: "GBCyl5RollBlk", quantity: 3, tier: "1–11", source: "stepper" }]);
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

    it("adds the exact assembly and quantity to the cart without navigating", () => {
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
        expect(track.mock.calls[2][1]).toEqual({ productId: "cylinder-5ml-clear-roll-on", sku: "GBCyl5RollBlk", quantity: 200, tier: "144–499" });
        expect($("catalog-card-add").textContent).toContain("Added");
        expect($("catalog-card-added").textContent).toContain("Added 200 to your cart.");
    });

    it("keeps the card usable without a ladder and hides the toggle", () => {
        card({ priceTiers: null, webPrice10pc: null, webPrice12pc: null, webPrice1pc: 0.95 });
        expect($("catalog-card-price").textContent).toBe("From $0.95/ea");
        expect(el.querySelector('[data-testid="catalog-card-tier-toggle"]')).toBeNull();
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

describe("useCatalogTierPanels", () => {
    function Harness() {
        const panels = useCatalogTierPanels();
        return <>
            <output data-testid="open">{["a", "b"].filter((id) => panels.isOpen(id)).join(",")}</output>
            <button data-testid="open-a" onClick={() => panels.toggle("a", true)} />
            <button data-testid="open-b" onClick={() => panels.toggle("b", true)} />
            <button data-testid="close-a" onClick={() => panels.toggle("a", false)} />
        </>;
    }

    it("lets several cards stay open on the multi-column grid but only one on the single-column grid", () => {
        const matches = vi.fn<(query: string) => boolean>(() => false);
        vi.stubGlobal("matchMedia", (query: string) => ({ matches: matches(query), media: query }));
        try {
            render(<Harness />);
            click($("open-a")); click($("open-b"));
            expect($("open").textContent).toBe("a,b");
            click($("close-a"));
            expect($("open").textContent).toBe("b");

            matches.mockReturnValue(true);
            click($("open-a"));
            expect($("open").textContent).toBe("a");
            expect(matches).toHaveBeenLastCalledWith("(max-width: 639px)");
        } finally { vi.unstubAllGlobals(); }
    });
});
