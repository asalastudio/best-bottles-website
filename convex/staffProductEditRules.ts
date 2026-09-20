/**
 * What Team Hub staff may change on a catalogue row, and what a valid value is.
 * Pure, so the Convex mutation and the form validate with the same code and cannot disagree.
 *
 * Identity and fitment (SKU, family, capacity, neck, applicator, components, images) are NOT
 * here on purpose: a wrong neck breaks compatibility across the catalogue, the builder and Grace.
 */
export const STOCK_STATUSES = ["In Stock", "Out of Stock", "Available to order", "Discontinued"] as const;
export const PRODUCT_EDIT_FIELDS = ["itemName", "itemDescription", "stockStatus", "caseQuantity", "priceTiers"] as const;
export const GROUP_EDIT_FIELDS = ["displayName", "groupDescription"] as const;
export type ProductEditField = (typeof PRODUCT_EDIT_FIELDS)[number];
export type GroupEditField = (typeof GROUP_EDIT_FIELDS)[number];
export type PriceTier = { minQty: number; unitPrice: number; totalPrice: number };
export type PriceRung = { minQty: number; unitPrice: number };

const cents = (value: number) => Math.round(value * 100) / 100;

/** Staff enter a quantity and a price each; the pack total the storefront prints is derived. */
export function tiersFromRungs(rungs: PriceRung[]): PriceTier[] {
    return rungs.map(rung => ({ minQty: rung.minQty, unitPrice: cents(rung.unitPrice), totalPrice: cents(rung.unitPrice * rung.minQty) }));
}

export function validatePriceRungs(rungs: PriceRung[]): string | null {
    if (rungs.length === 0) return "Add at least the 1-piece price.";
    if (rungs.length > 5) return "A price ladder has at most five quantity breaks.";
    if (rungs[0].minQty !== 1) return "The first rung is the 1-piece price: its quantity must be 1.";
    for (const [index, rung] of rungs.entries()) {
        if (!Number.isInteger(rung.minQty) || rung.minQty < 1) return `Rung ${index + 1}: the quantity must be a whole number of 1 or more.`;
        if (!Number.isFinite(rung.unitPrice) || rung.unitPrice <= 0) return `Rung ${index + 1}: the price must be a positive number.`;
        if (rung.unitPrice > 100000) return `Rung ${index + 1}: that price looks like a typing mistake.`;
        if (index > 0 && rung.minQty <= rungs[index - 1].minQty) return `Rung ${index + 1}: quantities must rise from one rung to the next.`;
        if (index > 0 && rung.unitPrice > rungs[index - 1].unitPrice) return `Rung ${index + 1}: the price each cannot be higher than at a smaller quantity.`;
    }
    return null;
}

export function validateProductPatch(patch: Partial<Record<ProductEditField, unknown>>): string | null {
    for (const field of Object.keys(patch)) if (!(PRODUCT_EDIT_FIELDS as readonly string[]).includes(field)) return `"${field}" cannot be edited here.`;
    if ("itemName" in patch && !(typeof patch.itemName === "string" && patch.itemName.trim().length >= 3)) return "The item name cannot be blank.";
    if ("itemName" in patch && (patch.itemName as string).length > 600) return "The item name is too long (600 characters at most).";
    if ("itemDescription" in patch && patch.itemDescription !== null && (typeof patch.itemDescription !== "string" || patch.itemDescription.length > 4000)) return "The description is too long (4,000 characters at most).";
    if ("stockStatus" in patch && !(STOCK_STATUSES as readonly unknown[]).includes(patch.stockStatus)) return `Stock status must be one of: ${STOCK_STATUSES.join(", ")}.`;
    if ("caseQuantity" in patch && patch.caseQuantity !== null && !(Number.isInteger(patch.caseQuantity) && (patch.caseQuantity as number) > 0)) return "Case quantity must be a whole number above zero.";
    if ("priceTiers" in patch) return validatePriceRungs(patch.priceTiers as PriceRung[]);
    return null;
}

export function validateGroupPatch(patch: Partial<Record<GroupEditField, unknown>>): string | null {
    for (const field of Object.keys(patch)) if (!(GROUP_EDIT_FIELDS as readonly string[]).includes(field)) return `"${field}" cannot be edited here.`;
    if ("displayName" in patch && !(typeof patch.displayName === "string" && patch.displayName.trim().length >= 3)) return "The display name cannot be blank.";
    if ("displayName" in patch && (patch.displayName as string).length > 200) return "The display name is too long (200 characters at most).";
    if ("groupDescription" in patch && patch.groupDescription !== null && (typeof patch.groupDescription !== "string" || patch.groupDescription.length > 6000)) return "The description is too long (6,000 characters at most).";
    return null;
}

/** Columns that mirror rungs of the ladder and must never drift from it. */
export function priceColumnsFromTiers(tiers: PriceTier[]) {
    const at = (qty: number) => tiers.find(tier => tier.minQty === qty)?.unitPrice ?? null;
    return { webPrice1pc: tiers[0].unitPrice, webPrice10pc: at(10), webPrice12pc: at(12) };
}

/** Same value for the purposes of "did someone change this since I opened it". */
export function sameValue(a: unknown, b: unknown): boolean {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
