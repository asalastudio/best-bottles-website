/*
 * Build Your Bottle's quantity, counted in sets as the catalog card and the product page count it
 * (Jordan, 25 Nov 2026: "the same quantity picker that we have, the set of 12, set of 144"): a set size, a number
 * of sets, and the total in pieces. The builder's selection still holds pieces; this only reads and writes it.
 *
 * The builder's data carries the 1, 10 and 12 piece prices and no published per-set totals, so a set here is a
 * quantity and the price beside it is whatever the cart will charge for that many pieces.
 */
import { MAX_QUANTITY } from "./model";

export const BUILDER_SET_SIZES = [1, 12, 144] as const;

export type BuilderSet = { size: number; label: string; isCase: boolean };

/** The set sizes a bottle offers: 1, 12, 144, and its case when the case is a different quantity. */
export function builderSets(caseQuantity: number | null | undefined): BuilderSet[] {
    const sets: BuilderSet[] = BUILDER_SET_SIZES.map(size => ({ size, label: size.toLocaleString("en-US"), isCase: false }));
    if (!caseQuantity || caseQuantity <= 1 || !Number.isSafeInteger(caseQuantity)) return sets;
    const same = sets.find(set => set.size === caseQuantity);
    if (same) { same.isCase = true; same.label = `${same.label} (case)`; return sets; }
    return [...sets, { size: caseQuantity, label: `Case of ${caseQuantity.toLocaleString("en-US")}`, isCase: true }];
}

/**
 * A quantity in pieces read back as sets. The current set size is kept while the quantity is whole sets of it
 * (12 sets of 12 stays 12 x 12, not 1 x 144); otherwise the largest set that divides the quantity, down to singles.
 */
export function readSets(sets: readonly BuilderSet[], quantity: number, currentSize?: number): { size: number; count: number } {
    const valid = Number.isSafeInteger(quantity) && quantity >= 1;
    if (!valid) return { size: currentSize && sets.some(set => set.size === currentSize) ? currentSize : 1, count: NaN };
    if (currentSize && sets.some(set => set.size === currentSize) && quantity % currentSize === 0) return { size: currentSize, count: quantity / currentSize };
    const fit = [...sets].sort((a, b) => b.size - a.size).find(set => set.size > 1 && quantity % set.size === 0);
    return fit ? { size: fit.size, count: quantity / fit.size } : { size: 1, count: quantity };
}

/** Pieces for a number of sets, kept within what the builder accepts. NaN (an emptied field) passes through. */
export function piecesFor(size: number, count: number): number {
    if (!Number.isFinite(count)) return NaN;
    const most = Math.max(1, Math.floor(MAX_QUANTITY / size));
    return Math.min(Math.max(1, Math.round(count)), most) * size;
}
