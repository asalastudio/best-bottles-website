import missingSources from "./missing-hero-sources.json";

// These two legacy 5.5 mL Cylinder groups duplicate the 5 mL presentation.
// Hide only their browse cards; retain the records, SKUs, and direct PDP routes
// until the underlying product-group reconciliation is completed.
const HIDDEN_CATALOG_GROUPS = new Set([
    "cylinder-5.5ml-clear-13-415-finemist",
    "cylinder-5.5ml-clear-13-415",
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

export function isVisibleCatalogGroup(group: { slug: string; variantCount: number }, variants?: readonly unknown[]): boolean {
    return !isHiddenCatalogGroup(group.slug) && !hasCatalogSourceHold(group.slug) && group.variantCount > 0
        && !(group.slug === "lotion-bottle-30ml-clear" && variants?.length === 0);
}
