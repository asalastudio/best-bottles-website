/**
 * The one write gate for storefront image truth. Every importer-facing
 * mutation (product images, plates, kits) verifies the same secret, so a
 * script that can write one can write all — and nothing without it can
 * write any.
 */
export function verifyWriteToken(writeToken: string) {
    const expected = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!expected) {
        throw new Error("product_image_write_token_not_configured");
    }
    if (writeToken !== expected) {
        throw new Error("unauthorized_product_image_write");
    }
}
