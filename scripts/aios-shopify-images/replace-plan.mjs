/**
 * Pure planning helpers for push-shopify-pdp-media.mjs --replace support.
 * Kept dependency-free so the decision logic stays unit-testable in isolation
 * (the main script has env-validation + network side effects on import).
 */

/**
 * Decide how to attach freshly-created media to a target Shopify variant.
 *   "append"  — variant has no variant-level image yet → productVariantAppendMedia
 *   "repoint" — variant already has an image and --replace is set →
 *               productVariantsBulkUpdate onto the new media. A plain append
 *               here is rejected by Shopify ("the given variant already has
 *               attached media"), which is exactly the bug --replace had.
 *   "skip"    — variant already has an image and --replace is NOT set (idempotent)
 *
 * @param {{ image?: { url?: string } | null } | null | undefined} variant
 * @param {boolean} replace
 * @returns {"append" | "repoint" | "skip"}
 */
export function planVariantAction(variant, replace) {
    const hasImage = Boolean(variant?.image?.url);
    if (!hasImage) return "append";
    return replace ? "repoint" : "skip";
}

/**
 * Filename (query string stripped) of a Shopify CDN URL. Used to match a
 * variant's old image to the gallery MediaImage that should be deleted when
 * --delete-old-media is set.
 *
 * @param {string | null | undefined} url
 * @returns {string}
 */
export function mediaFilename(url) {
    return (url || "").split("?")[0].split("/").pop() || "";
}
