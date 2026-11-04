import skus from "./round-sleek-master-skus.json";

/** Local review masters for every Round 78/128 ml and Sleek 30/50/100 ml SKU the register draws (scripts/round-sleek). */
// b33fd5403f60: scaler sizing on every kit (build-kits.mts); closures seated on the shoulder, PSD dip tubes per size and
// fitment fitted to the register tubes' places, 18-415 reducers, complete droppers in EXPLODED, bulb and tassel
// kits fitted to the stage, bulb cap close-ups (seat-and-tubes.py), and the three white rectangle lotion pumps from their PSDs (white-rect-lotion.py).
export const ROUND_SLEEK_MASTER_REVIEW_VERSION = "b33fd5403f60";
const exactSkus = new Map(skus.map(sku => [sku.toLowerCase(), sku]));
export function roundSleekReviewSku(sku: string | null | undefined): string | null {
    return sku ? exactSkus.get(sku.trim().toLowerCase()) ?? null : null;
}
