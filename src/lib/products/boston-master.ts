import skus from "./boston-master-skus.json";

/** Local review masters for the Boston Round SKUs the register cannot draw (scripts/circle-boston). */
// 5c49be633932: the 15 ml (18-400) amber, cobalt and clear droppers and caps from their PSDs, one outline for every colour
// (regenerate-boston15.py, boston15-kits.py).
export const BOSTON_MASTER_REVIEW_VERSION = "5c49be633932";
const exactSkus = new Map(skus.map(sku => [sku.toLowerCase(), sku]));
export function bostonReviewSku(sku: string | null | undefined): string | null {
    return sku ? exactSkus.get(sku.trim().toLowerCase()) ?? null : null;
}
