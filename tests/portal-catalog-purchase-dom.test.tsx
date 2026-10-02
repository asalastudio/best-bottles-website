// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PortalCatalogPurchase from "../src/components/portal/PortalCatalogPurchase";
import { resolveCatalogCardPurchaseVariant } from "../src/lib/products/catalog-card-purchase";
import type { CatalogLineItem } from "../src/lib/products/catalog-line-items";
const variant = resolveCatalogCardPurchaseVariant([{ id: "fixture", graceSku: "FIXTURE", websiteSku: "FIXTURE-WEB", itemName: "Fixture bottle", webPrice1pc: .88,
    priceTiers: [{ minQty: 1, unitPrice: .88 }, { minQty: 12, unitPrice: .84 }, { minQty: 144, unitPrice: .79 }, { minQty: 288, unitPrice: .75 }],
    stockStatus: "In Stock", shopifySellable: true }], { productTitle: "Fixture bottle" })!;
const item: CatalogLineItem = { groupId: "fixture", slug: "fixture", displayName: "Fixture bottle", category: "Glass", family: null,
    skuLabel: "FIXTURE-WEB", orderableSku: "FIXTURE-WEB", graceSku: "FIXTURE", capacity: null, color: null,
    neckThreadSize: null, variantCount: 1, priceFrom: .10, thumbnailUrl: null, purchaseVariant: variant };
let root: Root, container: HTMLDivElement;
const add = vi.fn();
function Harness({ pending = false, twice = false }: { pending?: boolean; twice?: boolean }) {
    const [quantityText, setQuantityText] = useState("1");
    const control = <PortalCatalogPurchase item={item} quantityText={quantityText} onQuantityChange={setQuantityText} pending={pending} justAdded={false} onAdd={add} />;
    return <>{control}{twice && control}</>;
}
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
function render(props = {}) { act(() => root.render(<Harness {...props} />)); }
function type(value: string) {
    const input = container.querySelector("input")!;
    act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
describe("portal quantity-tier menu interaction", () => {
    it("selects a break, updates quantity/unit/total, and adds only that quantity", () => {
        render(); const select = container.querySelector("select")!;
        act(() => { select.value = "288"; select.dispatchEvent(new Event("change", { bubbles: true })); });
        expect(container.querySelector("input")?.value).toBe("288"); expect(container.textContent).toContain("$0.75 / ea");
        const button = [...container.querySelectorAll("button")].find(node => node.textContent === "Add · $216.00")!;
        act(() => button.click()); expect(add).toHaveBeenCalledWith(288);
    });
    it("typing 60 selects its tier and exposes the same $50.40 total", () => {
        render(); type("60"); expect(container.querySelector("select")?.value).toBe("12");
        expect(container.textContent).toContain("$0.84 / ea"); expect(container.textContent).toContain("Add · $50.40");
    });
    it("keeps invalid quantity visible and blocks adding instead of rounding it", () => {
        render(); type("1.5"); expect(container.querySelector("input")?.value).toBe("1.5");
        expect(container.querySelector('[role="alert"]')?.textContent).toBe("Use whole numbers only.");
        expect([...container.querySelectorAll("button")].find(node => node.textContent === "Add")?.disabled).toBe(true);
        expect(add).not.toHaveBeenCalled();
    });
    it("keeps mobile/desktop presentations on the same selected quantity", () => {
        render({ twice: true }); type("144");
        expect([...container.querySelectorAll("input")].map(input => input.value)).toEqual(["144", "144"]);
        expect([...container.querySelectorAll("select")].map(select => select.value)).toEqual(["144", "144"]);
    });
    it("disables the menu, quantity editor and Add while a request is pending", () => {
        render({ pending: true });
        for (const control of container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("input, select, button")) expect(control.disabled).toBe(true);
    });
});
