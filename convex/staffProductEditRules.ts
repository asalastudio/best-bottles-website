/**
 * What Team Hub staff may change on a catalogue row, and what a valid value is.
 * Pure, so the Convex mutation and the form validate with the same code and cannot disagree.
 *
 * Identity and fitment (SKU, family, capacity, neck, applicator, components, images) are NOT
 * here on purpose: a wrong neck breaks compatibility across the catalogue, the builder and Grace.
 */
export const STOCK_STATUSES = ["In Stock", "Out of Stock", "Available to order", "Discontinued"] as const;
// itemName is deliberately absent: it is a legacy description sentence the storefront only falls back to.
export const PRODUCT_EDIT_FIELDS = ["itemDescription", "stockStatus", "caseQuantity", "priceTiers"] as const;
// customName, not displayName: see the note on productGroups.customName in schema.ts.
export const GROUP_EDIT_FIELDS = ["customName", "groupDescription"] as const;
export type ProductEditField = (typeof PRODUCT_EDIT_FIELDS)[number];
export type GroupEditField = (typeof GROUP_EDIT_FIELDS)[number];
export type PriceTier = { minQty: number; unitPrice: number; totalPrice: number };
export type PriceRung = { minQty: number; unitPrice: number };

const cents = (value: number) => Math.round(value * 100 + 1e-9) / 100;

/**
 * Best Bottles' volume discounts, measured on the live catalogue 2026-09-20: 2,468 of 2,470 ladders
 * are exactly this, to the cent. The discount applies to the PACK: total = qty x 1-piece x (1 - d),
 * rounded to cents, and the price each is that total / qty, rounded. So 12 x $3.47 is $41.64 but the
 * pack is $41.61 — the total is the truth and must never be rebuilt from the rounded price each.
 */
export const LADDER_DISCOUNTS = [0, 0.05, 0.10, 0.15, 0.22] as const;

export function standardRung(basePrice: number, minQty: number, index: number): PriceTier {
    const totalPrice = cents(minQty * basePrice * (1 - LADDER_DISCOUNTS[index]));
    return { minQty, totalPrice, unitPrice: index === 0 ? cents(basePrice) : cents(totalPrice / minQty) };
}

/** The standard ladder for a 1-piece price, keeping the SKU's own quantity breaks. */
export function standardLadder(basePrice: number, breaks: number[]): PriceRung[] {
    return breaks.slice(0, LADDER_DISCOUNTS.length).map((minQty, index) => { const rung = standardRung(basePrice, minQty, index); return { minQty: rung.minQty, unitPrice: rung.unitPrice }; });
}

/** Does this ladder follow the standard discounts? (Two live SKUs do not: they are hand-priced.) */
export function isStandardLadder(rungs: PriceRung[]): boolean {
    return rungs.length === LADDER_DISCOUNTS.length && rungs[0].minQty === 1
        && rungs.every((rung, index) => standardRung(rungs[0].unitPrice, rung.minQty, index).unitPrice === cents(rung.unitPrice));
}

/**
 * Staff enter a quantity and a price each; the pack total is derived. Two guarantees:
 *   - a rung the editor did NOT change keeps its stored pack total, to the cent. (A price each can sit on
 *     the schedule by rounding alone — GBSpry3mlClBlk at $0.37 — while its totals were set by hand.)
 *   - a rung that WAS changed takes the schedule's total when the whole ladder follows the schedule, and
 *     price each x quantity when it is hand-priced.
 */
export function tiersFromRungs(rungs: PriceRung[], stored: PriceTier[] = []): PriceTier[] {
    const standard = isStandardLadder(rungs);
    return rungs.map((rung, index) => {
        const kept = stored.find(tier => tier.minQty === rung.minQty && cents(tier.unitPrice) === cents(rung.unitPrice));
        if (kept) return { minQty: kept.minQty, unitPrice: kept.unitPrice, totalPrice: kept.totalPrice };
        return standard ? standardRung(rungs[0].unitPrice, rung.minQty, index)
            : { minQty: rung.minQty, unitPrice: cents(rung.unitPrice), totalPrice: cents(rung.unitPrice * rung.minQty) };
    });
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
    if ("itemDescription" in patch && patch.itemDescription !== null && (typeof patch.itemDescription !== "string" || patch.itemDescription.length > 4000)) return "The description is too long (4,000 characters at most).";
    if ("stockStatus" in patch && !(STOCK_STATUSES as readonly unknown[]).includes(patch.stockStatus)) return `Stock status must be one of: ${STOCK_STATUSES.join(", ")}.`;
    if ("caseQuantity" in patch && patch.caseQuantity !== null && !(Number.isInteger(patch.caseQuantity) && (patch.caseQuantity as number) > 0)) return "Case quantity must be a whole number above zero.";
    if ("priceTiers" in patch) return validatePriceRungs(patch.priceTiers as PriceRung[]);
    return null;
}

export function validateGroupPatch(patch: Partial<Record<GroupEditField, unknown>>): string | null {
    for (const field of Object.keys(patch)) if (!(GROUP_EDIT_FIELDS as readonly string[]).includes(field)) return `"${field}" cannot be edited here.`;
    if ("customName" in patch && patch.customName !== null) {
        const name = patch.customName;
        if (typeof name !== "string" || name.trim().length < 3) return "A custom name needs at least three characters. Clear the field to go back to the generated name.";
        if (name.length > 120) return "The custom name is too long (120 characters at most).";
    }
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
