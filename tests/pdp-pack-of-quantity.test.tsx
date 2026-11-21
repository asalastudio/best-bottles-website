// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/useGrace", () => ({ useGrace: () => ({ openPanel: vi.fn() }) }));

import PdpBuyBox, { type PdpBuyBoxProps } from "@/components/pdp/PdpBuyBox";
import { tiersFor } from "@/lib/products/pdp-redesign/model";
import type { ProductVariant } from "@/app/products/[slug]/ProductDetailClient";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * GBCyl5RollBlkDot's published ladder, as bestbottles.com lists it. The 4,320
 * pack's rate rounds to $0.47, so only its published total ($2,021.76) prices
 * the pack exactly: the menu must read `totalPrice`, not minQty × unitPrice.
 */
const ladder = [
    { minQty: 1, unitPrice: 0.6, totalPrice: 0.6 },
    { minQty: 12, unitPrice: 0.57, totalPrice: 6.84 },
    { minQty: 144, unitPrice: 0.54, totalPrice: 77.76 },
    { minQty: 864, unitPrice: 0.51, totalPrice: 440.64 },
    { minQty: 4320, unitPrice: 0.47, totalPrice: 2021.76 },
];
const tiers = tiersFor({ webPrice1pc: 0.6, priceTiers: ladder } as unknown as ProductVariant);
const formatPrice = (usd: number) => `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

let host: HTMLDivElement | null = null;
let root: Root | null = null;
afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    host = null;
    root = null;
});

/** The page's side of the contract: it keeps the total piece count and prices it at the active break. */
function Harness({ onQty, caseQuantity }: { onQty: PdpBuyBoxProps["onQty"]; caseQuantity: number | null }) {
    const [qty, setQty] = useState(1);
    const rate = [...tiers].reverse().find((tier) => qty >= tier.minQty)?.unitPrice ?? 0.6;
    return createElement(PdpBuyBox, {
        swatchStyle: {}, selectionName: "Clear glass · Black Dot cap",
        rollers: [], activeRoller: null, rollerImages: {}, onRoller: vi.fn(),
        tiers, qty,
        onQty: (next, source) => { onQty(next, source); setQty(next); },
        unitPrice: rate, lineTotal: rate * qty,
        addState: "add", onAdd: vi.fn(), addedQty: null, caseQuantity, formatPrice,
    });
}

function render(caseQuantity: number | null = 845) {
    const onQty = vi.fn();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => root!.render(createElement(Harness, { onQty, caseQuantity })));
    return onQty;
}

const $ = (id: string) => host!.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const click = (element: Element) => act(() => { (element as HTMLElement).click(); });
const qtyInput = () => $("pdp-qty") as HTMLInputElement;
const options = () => [...host!.querySelectorAll<HTMLButtonElement>("[data-testid='pdp-pack-menu'] [role='option']")];
const plus = () => host!.querySelector<HTMLButtonElement>("button[aria-label='Increase quantity']")!;

describe("product-page Set of × quantity (legacy format, 20 Nov 2026)", () => {
    it("lists each pack as the legacy menu does, from the published pack totals", () => {
        render();
        expect($("pdp-pack-toggle").textContent).toContain("Set of 1 · $0.60 each");
        expect($("pdp-total-qty").textContent).toBe("Total quantity: 1 pc");
        click($("pdp-pack-toggle"));
        expect(options().map((option) => option.firstElementChild?.textContent)).toEqual([
            "Set of 1 – $0.60 each",
            "Set of 12 – $6.84 ($0.57 each)",
            "Set of 144 – $77.76 ($0.54 each)",
            "Set of 864 – $440.64 ($0.51 each)",
            "Set of 4,320 – $2,021.76 ($0.47 each)",
        ]);
    });

    it("picking 144 starts at one pack: 144 pieces to the page, qty 1, priced at the pack", () => {
        const onQty = render();
        click($("pdp-pack-toggle"));
        click(options()[2]);
        expect(onQty).toHaveBeenLastCalledWith(144, "tier");
        expect(qtyInput().value).toBe("1");
        expect($("pdp-pack-toggle").textContent).toContain("Set of 144 · $0.54 each");
        expect($("pdp-total-qty").textContent).toBe("Total quantity: 144 pcs");
        expect($("pdp-add").textContent).toBe("Add to cart · $77.76");

        // + adds a whole pack, not a piece.
        click(plus());
        expect(onQty).toHaveBeenLastCalledWith(288, "stepper");
        expect(qtyInput().value).toBe("2");
        expect($("pdp-total-qty").textContent).toBe("Total quantity: 288 pcs");
        expect($("pdp-add").textContent).toBe("Add to cart · $155.52");
    });

    it("prices the 4,320 pack at its published total, not 4,320 × the rounded rate", () => {
        render();
        click($("pdp-pack-toggle"));
        click(options()[4]);
        expect($("pdp-add").textContent).toBe("Add to cart · $2,021.76");
    });

    it("the case link sets a total that is not a pack: Set of 1 × 845", () => {
        const onQty = render(845);
        click($("pdp-pack-toggle"));
        click(options()[2]);
        click($("pdp-add-case"));
        // From one set of 144, a case adds 845 more pieces.
        expect(onQty).toHaveBeenLastCalledWith(989, "case");
        expect($("pdp-pack-toggle").textContent).toContain("Set of 1");
        expect(qtyInput().value).toBe("989");
        expect($("pdp-total-qty").textContent).toBe("Total quantity: 989 pcs");
    });

    it("the case link from one piece reads back as Set of 1 with qty 845", () => {
        const onQty = render(845);
        click($("pdp-add-case"));
        expect(onQty).toHaveBeenLastCalledWith(845, "case");
        expect($("pdp-pack-toggle").textContent).toContain("Set of 1");
        expect(qtyInput().value).toBe("845");
        expect($("pdp-total-qty").textContent).toBe("Total quantity: 845 pcs");
    });
});
