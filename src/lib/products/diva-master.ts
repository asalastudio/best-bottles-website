import skus from "./diva-master-skus.json";

/** Local review masters for every Diva 30/46/100 ml SKU (scripts/diva-vial). */
// 32a89f9270c0: every exploded tube bowed slightly (foot 2.5 mm off the axis, BEND_MM). 95a3e5dfdee6: the sprayer and bulb dip tubes 2 mm wide (were 3 mm, "too thick"); the lotion tube stays 3 mm.
// fb12d0496a9a: scaler sizing on every kit with Diva's own shoulder landmark (build-kits.mts); closures seated on the
// shoulder, Diva's own Sunburst dip tubes in EXPLODED only, hung from the collar and cut to the
// bowl's floor (diva-exploded-tubes.py; no Diva PSD has a tube), reducers,
// droppers, bulb and tassel kits fitted to the stage, bulb cap close-ups (seat-and-tubes.py), and the ten 46 ml ring
// bulb sprayers from their PSDs (diva-ring-kits.py); the spray and lotion kits on Diva's own short-collar PSD heads and overcaps (diva-psd-heads.py); no glass pipette inside the
// dropper glass.
export const DIVA_MASTER_REVIEW_VERSION = "6bfad681b5a7";
const exactSkus = new Map(skus.map(sku => [sku.toLowerCase(), sku]));
export function divaReviewSku(sku: string | null | undefined): string | null {
    return sku ? exactSkus.get(sku.trim().toLowerCase()) ?? null : null;
}
