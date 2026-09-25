import missingSources from "./missing-hero-sources.json";

// These two legacy 5.5 mL Cylinder groups duplicate the 5 mL presentation.
// Hide only their browse cards; retain the records, SKUs, and direct PDP routes
// until the underlying product-group reconciliation is completed.
const HIDDEN_CATALOG_GROUPS = new Set([
    "cylinder-5.5ml-clear-13-415-finemist",
    "cylinder-5.5ml-clear-13-415",
    // LBMetalSilver1oz: a silver metal-shell bottle the legacy site lists as no
    // longer available (Jordan, 2026-09-25: take it off the new catalog).
    "lotion-bottle-30ml-clear-18mm",
]);

// Groups that stay listed only while they still hold variants. The webhook-made
// atomizer-5ml-slim group empties when its three SKUs move back into
// atomizer-5ml, but its stored variantCount does not recount.
const HIDDEN_WHEN_EMPTY_GROUPS = new Set([
    "lotion-bottle-30ml-clear",
    "atomizer-5ml-slim",
    // The Minaret dab-on caps were filed here as sprayers / a separate closure;
    // they moved into their families' cap groups on 2026-09-25.
    "rectangle-10ml-clear-13-415-finemist",
    "elegant-15ml-clear-13-415-capclosure",
]);

export function isHiddenCatalogGroup(slug: string): boolean {
    return HIDDEN_CATALOG_GROUPS.has(slug);
}

const missingWebsiteSkus = new Set(missingSources.flatMap(row => row.websiteSku ? [row.websiteSku] : []));
const missingGraceSkus = new Set(missingSources.flatMap(row => row.graceSku ? [row.graceSku] : []));

/** Exact source backlog only. Blank identifiers must never match other products. */
export function isMissingHeroSource(variant: { websiteSku?: string | null; graceSku?: string | null }): boolean {
    return Boolean((variant.websiteSku && missingWebsiteSkus.has(variant.websiteSku))
        || (variant.graceSku && missingGraceSkus.has(variant.graceSku)));
}

export function hasCatalogSourceHold(slug: string): boolean {
    return new Set([
        "unknown-0ml-clear", "cap-closure-13-425", "cap-closure-22-400",
        "cap-closure-24-400", "cap-closure-Press-Fit", "cap-closure-Specialty",
        "dropper-17-415", "roll-on-fitment",
    ]).has(slug);
}

// Test and internal records ("Internal") are never listed, whatever their slug.
const HIDDEN_CATEGORIES = new Set(["Internal"]);

export function isVisibleCatalogGroup(group: { slug: string; variantCount: number; category?: string | null }, variants?: readonly unknown[]): boolean {
    return !isHiddenCatalogGroup(group.slug) && !hasCatalogSourceHold(group.slug) && group.variantCount > 0
        && !HIDDEN_CATEGORIES.has(group.category ?? "")
        && !(HIDDEN_WHEN_EMPTY_GROUPS.has(group.slug) && variants?.length === 0);
}
