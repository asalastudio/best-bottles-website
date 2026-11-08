import seating from "./diva-fitment-seating.json";
import overcapTops from "./diva-overcap-tops.json";

/** The 7 Nov 2026 Diva corrections, applied in approved-component-kits.ts: fitments seated on the shoulder and
 * centred on the neck (diva-fitment-seating.json), and overcaps given back the tops their cut-outs lost
 * (diva-overcap-tops.json). A kit with either is served under this version, and localhost review files never
 * stand in for it. */
export const DIVA_KIT_VERSION = `${seating.version}--${overcapTops.version}`; // no "+": it travels in a query string

export function isCorrectedDivaKit(sku: string | null | undefined): boolean {
    return Boolean(sku) && (Object.hasOwn(seating.rows, sku!) || Object.hasOwn(overcapTops.rows, sku!));
}
