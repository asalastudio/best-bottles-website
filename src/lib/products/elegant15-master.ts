import skus from "./elegant15-master-skus.json";

/** The 15 ml Elegant product-page recipes are currently a localhost review. */
export const ELEGANT15_MASTER_REVIEW_VERSION = "a32f0bd37923";
const exactSkus = new Map(skus.map(sku => [sku.toLowerCase(), sku]));
export function elegant15ReviewSku(sku: string | null | undefined): string | null {
    return sku ? exactSkus.get(sku.trim().toLowerCase()) ?? null : null;
}
