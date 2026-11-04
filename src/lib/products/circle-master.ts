import skus from "./circle-master-skus.json";

/** Catalog cards drawn from the local Circle review kits (scripts/circle-boston): the 15 ml roll-ons, whose
 * standard 13-415 rollers the static heroes do not show. The other Circle cards keep their heroes for now (a
 * kit-drawn bulb sprayer card clips its bulb). */
// f624cd137ca4: scaler sizing on every kit (build-circle-kits.mts); closures seated on the shoulder, PSD dip tubes per size
// and fitment, 18-415 reducers, 50 ml complete droppers in EXPLODED, tassel kits fitted to the stage, bulb cap
// close-ups, and the 15 ml roll-ons on the standard 13-415 metal and plastic rollers (seat-and-tubes.py).
export const CIRCLE_MASTER_REVIEW_VERSION = "e099a396bb18";
const exactSkus = new Map(skus.map(sku => [sku.toLowerCase(), sku]));
export function circleReviewSku(sku: string | null | undefined): string | null {
    return sku ? exactSkus.get(sku.trim().toLowerCase()) ?? null : null;
}
