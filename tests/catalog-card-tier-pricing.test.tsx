// @vitest-environment jsdom
import React, { act, type ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
const addItems = vi.hoisted(() => vi.fn());

vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    capture: track,
    setPersonProperties: vi.fn(),
    group: vi.fn(),
  },
}));
vi.mock("@/components/CartProvider", () => ({ useCart: () => ({ addItems }) }));
vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    const p = { ...props } as Record<string, unknown>; delete p.fill; delete p.unoptimized; return React.createElement("img", p);
} }));

import CatalogCardPurchase from "@/components/catalog/CatalogCardPurchase";
import { analytics } from "@/lib/analytics";
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
const base = { productId: "cylinder-5ml-clear-roll-on", sku: "GBCyl5RollBlk" };

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
const menu = () => el.querySelector<HTMLElement>('[data-testid="catalog-card-pack-menu"]');
const click = (target: Element) => act(() => { target.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
function type(input: HTMLInputElement, value: string) {
    act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
    });
}
const events = () => track.mock.calls.map((call) => call[0]);

// posthog-js loads on init (it left the shell bundle); once loaded, calls reach it synchronously.
beforeAll(() => analytics.init("phc_test"));
beforeEach(() => { track.mockClear(); addItems.mockClear(); });
afterEach(() => { act(() => root?.unmount()); el?.remove(); });

describe("Set of menu on the catalog card (design 8a)", () => {
    it("shows the live 1-piece rate and opens the packs in a menu below the button, never a modal", () => {
        card();
        expect($("catalog-card-price").textContent).toBe("$0.92each");
        const toggle = $("catalog-card-pack-toggle");
        expect(toggle.textContent).toBe("Set of 1▾");
        expect(toggle.getAttribute("aria-haspopup")).toBe("listbox");
        expect(toggle.getAttribute("aria-expanded")).toBe("false");
        expect(menu()).toBeNull();
        expect(el.querySelector("dialog")).toBeNull();
        // No quote footnote: the ladder's rates are the prices (Jordan, 2026-09-25).
        expect(el.querySelector('[data-testid="catalog-card-tier-footnote"]')).toBeNull();
        expect($("catalog-card-add").textContent).toBe("Add to cart · $0.92");
        expect($("catalog-card-total-qty").textContent).toBe("Total quantity: 1 pc");

        click(toggle);
        expect(toggle.getAttribute("aria-expanded")).toBe("true");
        expect(menu()?.getAttribute("role")).toBe("listbox");
        expect(toggle.getAttribute("aria-controls")).toBe(menu()?.id);
        const rows = $$("catalog-card-tier-row");
        // The legacy site's menu (Jordan, 2026-11-20): each pack's pieces, its price and its rate per piece.
        const lines = ["Set of 1 – $0.92 each", "Set of 12 – $9.12 ($0.76 each)", "Set of 48 – $30.72 ($0.64 each)", "Set of 144 – $80.64 ($0.56 each)", "Set of 500 – $265.00 ($0.53 each)"];
        expect(rows.map((row) => row.textContent)).toEqual(lines);
        expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual(lines);
        expect(el.textContent).not.toMatch(/quote/i);
        expect(rows.map((row) => row.getAttribute("aria-selected"))).toEqual(["true", "false", "false", "false", "false"]);
        expect(document.activeElement).toBe(rows[0]);
        expect(events()).toEqual(["tier_pricing_opened"]);
        expect(track.mock.calls[0][1]).toEqual({ ...base, quantity: 1, tier: "1–11" });
    });

    it("picking a pack starts at one set of it: Set of 144 × 1 is 144 pieces at the pack's price", () => {
        card();
        click($("catalog-card-pack-toggle"));
        click($$("catalog-card-tier-row")[3]);
        expect(menu()).toBeNull();
        expect(document.activeElement).toBe($("catalog-card-pack-toggle"));
        expect(($("catalog-card-qty") as HTMLInputElement).value).toBe("1");
        expect($("catalog-card-pack-toggle").textContent).toBe("Set of 144▾");
        expect($("catalog-card-price").textContent).toBe("$0.56each · set of 144");
        expect($("catalog-card-total-qty").textContent).toBe("Total quantity: 144 pcs");
        expect($("catalog-card-add").textContent).toBe("Add to cart · $80.64");
        expect($("catalog-card-add").dataset.quote).toBeUndefined();
        expect(el.querySelector('[data-testid="catalog-card-request-quote"]')).toBeNull();
        expect(el.textContent).not.toMatch(/quote/i);
        expect(events()).toEqual(["tier_pricing_opened", "tier_selected", "tier_pricing_closed"]);
        expect(track.mock.calls[1]).toEqual(["tier_selected", { ...base, quantity: 144, tier: "144–499" }]);
    });

    it("closes the menu with Escape and moves focus through the breaks with the arrow keys", () => {
        card();
        click($("catalog-card-pack-toggle"));
        act(() => { menu()!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); });
        expect(document.activeElement).toBe($$("catalog-card-tier-row")[1]);
        act(() => { menu()!.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })); });
        expect(document.activeElement).toBe($$("catalog-card-tier-row")[4]);
        act(() => { menu()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
        expect(menu()).toBeNull();
        expect(document.activeElement).toBe($("catalog-card-pack-toggle"));
        expect(($("catalog-card-qty") as HTMLInputElement).value).toBe("1");
    });

    it("the quantity counts packs: the stepper and a typed number change the packs, never the pack size", () => {
        card();
        const qty = $("catalog-card-qty") as HTMLInputElement;
        const [minus, plus] = [...el.querySelectorAll<HTMLButtonElement>('button[aria-label$="crease quantity"]')];
        expect(minus.disabled).toBe(true);
        click(plus); click(plus);
        expect(qty.value).toBe("3");
        expect(track.mock.calls.at(-1)).toEqual(["quantity_changed", { ...base, quantity: 3, tier: "1–11", source: "stepper" }]);
        click(minus);
        expect(qty.value).toBe("2");
        expect($("catalog-card-add").textContent).toBe("Add to cart · $1.84");

        type(qty, "0");
        expect($("catalog-card-qty-error").textContent).toBe("Enter a quantity of 1 or more.");
        expect(qty.getAttribute("aria-invalid")).toBe("true");
        expect(qty.getAttribute("aria-describedby")).toBe($("catalog-card-qty-error").id);
        expect(($("catalog-card-add") as HTMLButtonElement).disabled).toBe(true);
        type(qty, "12.5");
        expect($("catalog-card-qty-error").textContent).toBe("Use whole numbers only.");

        // 3 packs of 12 = 36 pieces, priced as three packs.
        click($("catalog-card-pack-toggle"));
        click($$("catalog-card-tier-row")[1]);
        click(plus); click(plus);
        expect(qty.value).toBe("3");
        expect($("catalog-card-pack-toggle").textContent).toBe("Set of 12▾");
        expect($("catalog-card-total-qty").textContent).toBe("Total quantity: 36 pcs");
        expect($("catalog-card-add").textContent).toBe("Add to cart · $27.36");
        expect(track.mock.calls.at(-1)).toEqual(["quantity_changed", { ...base, quantity: 36, tier: "12–47", source: "stepper" }]);
        expect(el.querySelector('label[for="' + qty.id + '"]')?.textContent).toBe("Quantity");
        expect(($("catalog-card-add") as HTMLButtonElement).disabled).toBe(false);
    });

    it("adds pack × quantity pieces of the exact assembly without navigating", () => {
        card();
        click($("catalog-card-pack-toggle"));
        click($$("catalog-card-tier-row")[3]);
        type($("catalog-card-qty") as HTMLInputElement, "2");
        // Nothing in the purchase block is a link; Add to cart never navigates.
        expect(el.querySelectorAll("a[href]")).toHaveLength(0);
        track.mockClear();
        click($("catalog-card-add"));
        expect(addItems).toHaveBeenCalledTimes(1);
        expect(addItems.mock.calls[0][0]).toEqual([expect.objectContaining({
            graceSku: "CYL5-ROLL-BLK", websiteSku: "GBCyl5RollBlk", quantity: 288, unitPrice: 0.92,
            priceTiers: ladder, productGroupSlug: "cylinder-5ml-clear-roll-on", capColor: "Black",
        })]);
        expect(events()).toEqual(["quick_add_clicked", "Cart Item Added", "quick_add_success"]);
        expect(track.mock.calls[2][1]).toEqual({ ...base, quantity: 288, tier: "144–499" });
        expect($("catalog-card-add").textContent).toBe("Added ✓");
        expect($("catalog-card-added").textContent).toContain("Added 288 to your cart.");
    });

    it("still adds to the cart and reports success when telemetry throws", () => {
        card();
        type($("catalog-card-qty") as HTMLInputElement, "12");
        track.mockImplementation((event: string) => {
            if (event === "quick_add_clicked" || event === "Cart Item Added") throw new Error("analytics down");
        });
        try {
            click($("catalog-card-add"));
        } finally {
            track.mockReset();
        }
        expect(addItems).toHaveBeenCalledTimes(1);
        expect(addItems.mock.calls[0][0][0]).toMatchObject({ graceSku: "CYL5-ROLL-BLK", quantity: 12 });
        expect($("catalog-card-added").textContent).toContain("Added 12 to your cart.");
    });

    it("keeps the card usable without a ladder and shows no Set of menu", () => {
        card({ priceTiers: null, webPrice10pc: null, webPrice12pc: null, webPrice1pc: 0.95 });
        expect($("catalog-card-price").textContent).toBe("$0.95each");
        expect(el.querySelector('[data-testid="catalog-card-pack-toggle"]')).toBeNull();
        expect(el.querySelector('[data-testid="catalog-card-tier-footnote"]')).toBeNull();
        type($("catalog-card-qty") as HTMLInputElement, "10");
        expect($("catalog-card-add").textContent).toBe("Add to cart · $9.50");
    });

    it("disables Add to cart when Shopify will not checkout, and never offers a quote CTA", () => {
        card({ shopifySellable: false });
        expect(el.querySelector('[data-testid="catalog-card-quote"]')).toBeNull();
        expect($("catalog-card-purchase").dataset.state).toBe("unavailable");
        expect($("catalog-card-add").textContent).toBe("Unavailable");
        expect(($("catalog-card-add") as HTMLButtonElement).disabled).toBe(true);
        expect($("catalog-card-stock").textContent).toMatch(/Unavailable/i);
        click($("catalog-card-add"));
        expect(addItems).not.toHaveBeenCalled();
    });

    it("marks sold-out cards and blocks add to cart", () => {
        card({ stockStatus: "Out of Stock" });
        expect($("catalog-card-purchase").dataset.state).toBe("sold-out");
        expect($("catalog-card-stock").textContent).toMatch(/Out of stock/i);
        expect($("catalog-card-add").textContent).toBe("Out of stock");
        expect(($("catalog-card-add") as HTMLButtonElement).disabled).toBe(true);
        click($("catalog-card-add"));
        expect(addItems).not.toHaveBeenCalled();
    });

    it("routes unpriced groups to the product page", () => {
        card({ webPrice1pc: null });
        expect($("catalog-card-purchase").dataset.state).toBe("unpriced");
        expect($("catalog-card-price").textContent).toBe("From $0.53/pc");
        expect(el.querySelector("a[href='/products/cylinder-5ml-clear-roll-on']")?.textContent).toBe("View options");
        act(() => root.unmount()); el.remove();

        card(null);
        expect($("catalog-card-purchase").dataset.state).toBe("unpriced");
    });
});
