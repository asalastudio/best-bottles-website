import skus from "./diva-master-skus.json";

/** Local review masters for every Diva 30/46/100 ml SKU (scripts/diva-vial). */
// 64251293c4e2: scaler sizing on every kit with Diva's own shoulder landmark (build-kits.mts); closures seated on the
// shoulder, the regenerated Round tubes fitted to the register tubes' places (no Diva PSD has a tube), reducers,
// droppers, bulb and tassel kits fitted to the stage, bulb cap close-ups (seat-and-tubes.py), and the ten 46 ml ring
// bulb sprayers from their PSDs (diva-ring-kits.py).
export const DIVA_MASTER_REVIEW_VERSION = "64251293c4e2";
const exactSkus = new Map(skus.map(sku => [sku.toLowerCase(), sku]));
export function divaReviewSku(sku: string | null | undefined): string | null {
    return sku ? exactSkus.get(sku.trim().toLowerCase()) ?? null : null;
}
