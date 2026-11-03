import skus from "./elegant30-master-skus.json";

/** Source-aligned candidate recipes, available only for local visual review. */
// 7642cc0f9f2d: the clear kits draw the Sunburst regeneration of the register plate (scripts/elegant-masters/regenerate-clear.py 30,
// scripts/elegant30/swap-clear-master.py): the candidate's body was filled white, a faint white square in the glass.
// 3c9275cbeda7: one universal dip tube for every 30 ml sprayer kit, the approved 9 ml Cylinder fine-mist
// tube resampled once to the 30 ml proportion (no SVG letterbox gap under the collar) (scripts/elegant30/universal-dip-tube.py); frosted kits draw it in EXPLODED only.
// 5a314cd5bf2e: adds GBElg30SpryShGl, GBElg30SpryShnSl and GBElg30SpryBlk from their own
// capped PSDs (scripts/elegant30/build-clear-sprayer-kits.py).
// 2405f8c59863: each kit carries the elegant-30ml-15-415 scaler (shoulder-to-foot 43%,
// foot on 91%) measured at the candidate's own neck base; before, no glassSizing,
// so the product page and builder fit the plate and the bottle drew oversized.
export const ELEGANT30_MASTER_REVIEW_VERSION = "7642cc0f9f2d";
const exactSkus = new Map(skus.map(sku => [sku.toLowerCase(), sku]));
export function elegant30ReviewSku(sku: string | null | undefined): string | null {
    return sku ? exactSkus.get(sku.trim().toLowerCase()) ?? null : null;
}
