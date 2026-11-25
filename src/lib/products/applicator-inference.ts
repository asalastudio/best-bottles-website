/**
 * Applicators the catalog data leaves empty, inferred in code (no Convex write).
 *
 * Convex imported the 30 ml clear Cylinder sprays (GBSpry1ozGl, GBSpry1ozSl) with `applicator: null`, so the
 * grouping named them "30 ml Clear Cylinder Bottle with Cap" and kept the production slug without its
 * "-finemist" suffix. Each is a fine-mist spray bottle with a metal spray top, overcap and base ring: the item
 * names say "Spray Bottle" and the SKUs start "GBSpry". The proper fix is to set the applicator in Convex; until
 * then these helpers fill the gap only where the stored value is missing, and never override one that is set.
 */

export const INFERRED_SPRAY_APPLICATOR = "Fine Mist Sprayer";

type ApplicatorEvidence = {
    applicator?: string | null;
    itemName?: string | null;
    websiteSku?: string | null;
    graceSku?: string | null;
};

/**
 * Production groups whose SKUs all carry a null applicator although the group is one assembly with a known
 * applicator. Exact slugs only; the card names these groups without seeing a SKU.
 */
const NULL_APPLICATOR_GROUPS: Readonly<Record<string, string>> = {
    "cylinder-30ml-clear-18-415": INFERRED_SPRAY_APPLICATOR,
};

function blank(value: string | null | undefined): boolean {
    const v = value?.trim().toLowerCase();
    return !v || v === "n/a" || v === "none";
}

/** True when the SKU or its item name says it is a spray bottle (the "GBSpry…" line, "…Spray Bottle…"). */
export function hasSprayBottleEvidence(variant: ApplicatorEvidence | null | undefined): boolean {
    if (!variant) return false;
    return /^GBSpry/i.test(variant.websiteSku?.trim() ?? "")
        || /^GB-SPR-/i.test(variant.graceSku?.trim() ?? "")
        || /\bspray bottle\b/i.test(variant.itemName ?? "");
}

/** The stored applicator, or the spray one its SKU and item name prove when the stored value is empty. */
export function inferVariantApplicator(variant: ApplicatorEvidence | null | undefined): string | null {
    if (!variant) return null;
    if (!blank(variant.applicator)) return variant.applicator!.trim();
    return hasSprayBottleEvidence(variant) ? INFERRED_SPRAY_APPLICATOR : null;
}

/** The group's stored applicator types, or the verified one for a listed group whose SKUs carry none. */
export function inferGroupApplicatorTypes(group: { slug?: string | null; applicatorTypes?: string[] | null } | null | undefined): string[] {
    const stored = (group?.applicatorTypes ?? []).filter((value) => !blank(value));
    const inferred = group?.slug ? NULL_APPLICATOR_GROUPS[group.slug] : undefined;
    // A null SKU applicator can surface as an empty list or as the "Cap/Closure" default; neither is the fitment.
    if (!inferred || stored.some((value) => !/^cap\/closure$/i.test(value.trim()))) return stored;
    return [inferred];
}
