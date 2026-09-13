import policy from "./closure-presentation-policy.json";

/** Jordan's assembled-top rule: use catalog applicator identity, never SKU spelling.
 * The photographed pipette may remain within the glass. Keep the complete
 * assembly together on finish changes; do not synthesize an exposed stem.
 */
export function requiresAssembledClosure(applicator?: string | null, websiteSku?: string | null): boolean {
    // Explicit catalog/source exception: the recorded description is “15ml,
    // 1/2 oz Clear glass bottle with a black dropper”, but applicator is N/A.
    // Exact identity lookup only; do not generalize from the SKU spelling.
    if (websiteSku && policy.assembledExactSkus.includes(websiteSku)) return true;
    return policy.assembledApplicators.some(value => value.toLowerCase() === applicator?.trim().toLowerCase());
}

/** Boston roller inserts are cropped where they seat into the glass.
 * Cap-off is supported; a floating insert would expose an unfinished edge.
 */
export function allowsExplodedClosure(applicator?: string | null, family?: string | null, websiteSku?: string | null): boolean {
    if (requiresAssembledClosure(applicator, websiteSku)) return false;
    return !(family === "Boston Round" && ["Metal Roller Ball", "Plastic Roller Ball"].includes(applicator ?? ""));
}
