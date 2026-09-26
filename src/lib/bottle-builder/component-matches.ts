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
    GBCyl9SpryRd: { family: "Cylinder", capacityMl: 9, color: "Clear", neck: "17-415", applicator: "Fine Mist Sprayer", componentSku: "Spry17-415Red",
        evidence: "2026-09-22 exact legacy product describes red trim and clear overcap; the cap color field names the clear cover, not the red actuator collar." },
    GBCrcl30GlCap: { family: "Circle", capacityMl: 30, color: "Clear", neck: "15-415", applicator: null, componentSku: "CP15-415ShnGl" },
    GBCrcl30SlCap: { family: "Circle", capacityMl: 30, color: "Clear", neck: "15-415", applicator: null, componentSku: "CP15-415ShnSl" },
    LBCyl50LtnMtSl: { family: "Cylinder", capacityMl: 50, color: "Clear", neck: "18-415", applicator: "Lotion Pump", componentSku: "Ltn18-415MtSl" },
    LBCyl100LtnMtSl: { family: "Cylinder", capacityMl: 100, color: "Clear", neck: "18-415", applicator: "Lotion Pump", componentSku: "Ltn18-415MtSl" },
    // Boston Round 15 ml cap-only bottles (2026-09-14, Jordan: "no clear boston
    // option" → GBBstn15BlkCapSht). Two listed black 18-400 caps fit the phrase
    // "with short black cap": the plain closure and the glass-rod applicator cap.
    // The bottle's description names no applicator, so only the plain closure
    // fits — the same join the generator made for the 30/60 ml twins.
    GBBstn15BlkCapSht: { family: "Boston Round", capacityMl: 15, color: "Clear", neck: "18-400", applicator: null, componentSku: "18-400CpShortBlk",
        evidence: "bottle: \"with short black cap\" (legacy description, no applicator); component 18-400CpShortBlk: \"Black lid or closure for glass bottle, Thread size 18-400\"; 18-400CpAppBlk excluded: \"Black cap with glass rod applicator\"" },
    GBBstnAmb15mlBlkCapSht: { family: "Boston Round", capacityMl: 15, color: "Amber", neck: "18-400", applicator: null, componentSku: "18-400CpShortBlk",
        evidence: "bottle: \"with short black cap\" (legacy description, no applicator); component 18-400CpShortBlk: \"Black lid or closure for glass bottle, Thread size 18-400\"; 18-400CpAppBlk excluded: \"Black cap with glass rod applicator\"" },
    GBBstnBlu15BlkCapSht: { family: "Boston Round", capacityMl: 15, color: "Cobalt Blue", neck: "18-400", applicator: null, componentSku: "18-400CpShortBlk",
        evidence: "bottle: \"with short black cap\" (legacy description, no applicator); component 18-400CpShortBlk: \"Black lid or closure for glass bottle, Thread size 18-400\"; 18-400CpAppBlk excluded: \"Black cap with glass rod applicator\"" },
};

let merged: Record<string, ExactComponentMatch> | undefined;

/** Generated joins (scripts/asset-ledger/build-exact-component-matches.ts):
 * each one names the bottle's own legacy description and the component's
 * catalogue name as evidence, and exists only where the finish-label rule
 * cannot decide. Regenerate rather than edit.
 *
 * Merged on first use, not at import: a top-level spread made this module look
 * side-effectful to webpack, so every client bundle that imports model.ts (the
 * builder's page chunk) carried the whole 76 KB table although only the
 * server-side catalogue resolver reads it. */
export function exactComponentMatch(websiteSku: string): ExactComponentMatch | undefined {
    merged ??= { ...(generated as Record<string, ExactComponentMatch>), ...reviewed };
    return Object.prototype.hasOwnProperty.call(merged, websiteSku) ? merged[websiteSku] : undefined;
}
