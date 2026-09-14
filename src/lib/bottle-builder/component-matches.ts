/** Exact, source-reviewed assembly-to-component joins. These only disambiguate
 * components already listed for the bottle; they never establish thread-wide
 * compatibility or make an unavailable/retired record eligible.
 * Evidence: docs/reviews/builder-compatibility-2026-09-08/sku-reconciliation.md */
import generated from "./component-matches.generated.json";

export type ExactComponentMatch = {
    family: string; capacityMl: number; color: string; neck: string;
    applicator: string | null; componentSku: string; evidence?: string;
};

/** Reviewed by hand, 2026-09-08. These win over the generated joins below. */
const reviewed: Record<string, ExactComponentMatch> = {
    GBCrcl30GlCap: { family: "Circle", capacityMl: 30, color: "Clear", neck: "15-415", applicator: null, componentSku: "CP15-415ShnGl" },
    GBCrcl30SlCap: { family: "Circle", capacityMl: 30, color: "Clear", neck: "15-415", applicator: null, componentSku: "CP15-415ShnSl" },
    LBCyl50LtnMtSl: { family: "Cylinder", capacityMl: 50, color: "Clear", neck: "18-415", applicator: "Lotion Pump", componentSku: "Ltn18-415MtSl" },
    LBCyl100LtnMtSl: { family: "Cylinder", capacityMl: 100, color: "Clear", neck: "18-415", applicator: "Lotion Pump", componentSku: "Ltn18-415MtSl" },
};

/** Generated joins (scripts/asset-ledger/build-exact-component-matches.ts):
 * each one names the bottle's own legacy description and the component's
 * catalogue name as evidence, and exists only where the finish-label rule
 * cannot decide. Regenerate rather than edit. */
export const exactComponentMatches: Record<string, ExactComponentMatch> = {
    ...(generated as Record<string, ExactComponentMatch>),
    ...reviewed,
};
