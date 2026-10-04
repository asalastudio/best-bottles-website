/** Preserve the published unit precision through multiplication and summation.
 * Currency formatting rounds presentation only; never round a unit rate to cents
 * before multiplying (0.845 × 60 is 50.70, not 51.00).
 */
export function draftLineTotal(unitPrice: number, quantity: number): number {
    return unitPrice * quantity;
}

export function draftOrderTotal(lines: readonly { unitPrice?: number | null; quantity: number }[]): number {
    return lines.reduce((sum, line) => sum + draftLineTotal(line.unitPrice ?? 0, line.quantity), 0);
}
