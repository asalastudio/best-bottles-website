/** Exact-SKU legacy photo corrections, pending repair of the source kit.
 * The 5 mL cobalt metal-roller kit omits the visible steel ball.
 * Source: https://www.bestbottles.com/images/store/enlarged_pics/GBCylBlu5MtlRollSlMatt.gif
 * Verified visually on 2026-09-05. Never reuse this across roller materials.
 */
export function verifiedCapOffPhoto(websiteSku: string | null | undefined): string | null {
    return websiteSku === "GBCylBlu5MtlRollSlMatt"
        ? "/images/products/verified/GBCylBlu5MtlRollSlMatt-cap-off.png"
        : null;
}
