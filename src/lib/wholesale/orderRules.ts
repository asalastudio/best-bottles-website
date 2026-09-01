/**
 * Wholesale order rules — the $50 floor, in code instead of a prompt.
 *
 * The rule was real but undiscoverable: it lived only in Grace's system
 * prompt (convex/gracePrompt.ts, "Minimum order: $50.00 (excluding
 * shipping)" plus "no unit minimum at all"). Grace stated it, nothing
 * enforced it, and no UI could show progress toward it. Jordan confirmed
 * 2026-08-31: $50 per ORDER, not a per-SKU MOQ — which is why the matrix
 * has no MOQ column.
 *
 * Pricing note: unit price here is always what CHECKOUT WILL CHARGE.
 * src/lib/volumePricing.ts is the authority — while
 * VOLUME_TIERS_HONORED_AT_CHECKOUT is false, Shopify's cart-permalink
 * charges the flat 1pc price, so quoting a 12+ tier in a subtotal would
 * promise something the checkout breaks.
 */

import { resolveChargedUnitPrice, type TierPrices } from "@/lib/volumePricing";

/** Dollars, excluding shipping (gracePrompt.ts is the source of this number). */
export const ORDER_MINIMUM_USD = 50;

export interface ConfigurationLine {
    bottleSku: string;
    componentSku: string | null;
    /** "bottle_only" is an explicit choice, never an unset component (PRD §20) */
    componentMode: "with_component" | "bottle_only";
    quantity: number;
    bottlePrices: TierPrices;
    componentPrices: TierPrices | null;
}

export interface LinePricing {
    bottleUnitPrice: number | null;
    componentUnitPrice: number | null;
    /** per assembled unit — bottle + component when one is attached */
    unitPrice: number | null;
    subtotal: number | null;
}

export function priceLine(line: ConfigurationLine): LinePricing {
    const bottleUnitPrice = resolveChargedUnitPrice(line.quantity, line.bottlePrices);
    const componentUnitPrice =
        line.componentMode === "bottle_only" || !line.componentPrices
            ? null
            : resolveChargedUnitPrice(line.quantity, line.componentPrices);

    if (bottleUnitPrice == null) {
        return { bottleUnitPrice: null, componentUnitPrice, unitPrice: null, subtotal: null };
    }
    const unitPrice = bottleUnitPrice + (componentUnitPrice ?? 0);
    return {
        bottleUnitPrice,
        componentUnitPrice,
        unitPrice,
        subtotal: Math.round(unitPrice * line.quantity * 100) / 100,
    };
}

export interface OrderTotals {
    lineCount: number;
    totalUnits: number;
    /** null when any line is unpriced — never silently treated as $0 */
    subtotal: number | null;
    meetsMinimum: boolean;
    remainingToMinimum: number | null;
}

export function summarizeOrder(lines: ConfigurationLine[]): OrderTotals {
    let subtotal: number | null = 0;
    let totalUnits = 0;

    for (const line of lines) {
        totalUnits += line.quantity;
        const { subtotal: lineSubtotal } = priceLine(line);
        if (lineSubtotal == null) subtotal = null;
        else if (subtotal != null) subtotal += lineSubtotal;
    }

    if (subtotal != null) subtotal = Math.round(subtotal * 100) / 100;
    const meetsMinimum = subtotal != null && subtotal >= ORDER_MINIMUM_USD;

    return {
        lineCount: lines.length,
        totalUnits,
        subtotal,
        meetsMinimum,
        remainingToMinimum:
            subtotal == null || meetsMinimum
                ? null
                : Math.round((ORDER_MINIMUM_USD - subtotal) * 100) / 100,
    };
}

/** Quantity has no per-SKU minimum — only a positive integer is required. */
export function isValidQuantity(quantity: number): boolean {
    return Number.isInteger(quantity) && quantity > 0;
}
