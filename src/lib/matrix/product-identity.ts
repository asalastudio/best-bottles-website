export type MatrixProductIdentity = {
    productGroupSlug?: string | null;
    websiteSku?: string | null;
    graceSku?: string | null;
};

/**
 * A matrix row can link only when its server-resolved product group and exact
 * variant identity both exist. PDP selection accepts either canonical SKU.
 */
export function matrixProductHref(identity: MatrixProductIdentity): string | null {
    const slug = identity.productGroupSlug?.trim();
    const sku = identity.websiteSku?.trim() || identity.graceSku?.trim();
    if (!slug || !sku) return null;
    return `/products/${encodeURIComponent(slug)}?sku=${encodeURIComponent(sku)}`;
}
