import { COMPONENT_CATEGORIES, COMPONENT_FAMILIES } from "@/lib/catalogFilters";
import { focusedProductPresentation } from "@/lib/products/focused-product-presentation";

export type AssembledPdpSignals = {
    category?: string | null;
    family?: string | null;
    assemblyType?: string | null;
    applicator?: string | null;
    itemName?: string | null;
    websiteSku?: string | null;
    graceSku?: string | null;
};

function isBottleMerchandise(signals: AssembledPdpSignals): boolean {
    const category = signals.category?.trim() ?? "";
    const family = signals.family?.trim() ?? "";
    if (category && COMPONENT_CATEGORIES.has(category)) return false;
    if (family && COMPONENT_FAMILIES.includes(family)) return false;
    return focusedProductPresentation(signals.category, signals.family).kind === "bottle";
}

function isExplicitBottleOnly(signals: AssembledPdpSignals): boolean {
    const haystack = `${signals.applicator ?? ""} ${signals.itemName ?? ""}`;
    return /bottle\s*only/i.test(haystack);
}

/**
 * Assembled bottle PDPs sell a bottle+cap or bottle+applicator kit.
 * Components are bought on Build Your Bottle or component-only pages, never
 * as add-ons here (ASA-193).
 */
export function isAssembledBottlePdp(signals: AssembledPdpSignals): boolean {
    if (!isBottleMerchandise(signals)) return false;
    if (isExplicitBottleOnly(signals)) return false;
    return true;
}

/** Interim: hide sizes / specs / volume / fulfillment / component rails. */
export function shouldHideAssembledPdpLowerStack(signals: AssembledPdpSignals): boolean {
    return isAssembledBottlePdp(signals);
}
