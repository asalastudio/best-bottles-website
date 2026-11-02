/** Exact source identities from the legacy descriptions, PSDs and September 25
 * registry. Imported color/capColor say Clear; these are colored glass
 * assemblies, not colored caps. Commercial records remain untouched. */
export const RECTANGLE_APPLICATOR_SLUG = "rectangle-9ml-clear-Ground-glassapplicator";
export const RECTANGLE_APPLICATOR_REVIEW_VERSION = "rectangle9-2026-11-01-v1";
const GLASS_BY_SKU: Readonly<Record<string, string>> = {
    GBSQSTClear: "Clear", GBSQSTBlue: "Cobalt Blue", GBSQSTGREEN: "Green",
};
const WEBSITE_BY_GRACE: Readonly<Record<string, string>> = {
    "GB-RCT-CLR-9ML-T-01": "GBSQSTBlue",
    "GB-RCT-CLR-9ML-T-02": "GBSQSTClear",
    "GB-RCT-CLR-9ML-T-03": "GBSQSTGREEN",
};
export function rectangleApplicatorGlass(websiteSku?: string | null): string | null {
    const key = websiteSku ?? "";
    return Object.hasOwn(GLASS_BY_SKU, key) ? GLASS_BY_SKU[key] : null;
}
export function rectangleApplicatorSku(variant: { websiteSku?: string | null; graceSku?: string | null }): string | null {
    if (rectangleApplicatorGlass(variant.websiteSku)) return variant.websiteSku!;
    const key = variant.graceSku ?? "";
    return Object.hasOwn(WEBSITE_BY_GRACE, key) ? WEBSITE_BY_GRACE[key] : null;
}
export function rectangleApplicatorReviewSku(sku?: string | null): string | null {
    return process.env.NODE_ENV === "development" && rectangleApplicatorGlass(sku) ? sku! : null;
}
