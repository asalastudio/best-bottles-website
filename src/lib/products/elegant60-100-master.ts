import skus from "./elegant60-100-master-skus.json";

/** Local review masters for every 60 ml and 100 ml Elegant SKU the register can draw. */
// 7b4fde8185e1: bulb and tassel kits carry a capCloseUp from the master library's component photographs (cap-close-ups.py).
// ce5bd9ab53a0: 60 ml droppers lift the complete 18-415 dropper (Sunburst glass pipette, one scale) in EXPLODED (frosted pipette hidden seated); the 60 ml
// gold tassel sprayer no longer carries its PSD's dip tube (it showed on the frosted glass).
// 3757ac206469: the 60 ml clear master is a Sunburst regeneration of the register plate (the candidate's body was
// filled white; regenerate-clear.py), and the bulb and tassel tube keeps the PSD path at a lighter tone.
// 24c6c9cbf092: the 60 ml tassel sprayers are their own PSDs (tassel on the floor, not 20 mm under the foot;
// tassel-sprayers-60.py) and every tassel kit stands its glass right of centre (glassSizing.axisPct) so the
// hose and tassel stay on the stage; clear lotion overcaps are seated as their empty cover, multiplied.
// a4febf8f33d6: the 100 ml reducer kits get the 60 ml kits' 18-415 reducer (insert seated, plug in EXPLODED),
// scaled by px/mm, so their pages offer cap off and exploded again.
// 57ff9da981e4: an overcap moves with its sprayer or pump (seated apart, the clear lotion overcaps printed the pump
// twice); the white treatment pump's overcap is its empty cover seated and parked; each tube shares its
// head's component, so EXPLODED keeps them one unit.
// 4419f1584e4b: adds the four white treatment pumps with clear overcap (LBElg60/Frst60/100/Frst100WhtClOvrCp) from
// their PSDs, with a Sunburst empty square cover for the parked overcap (white-lotion-kits-60-100.py);
// closures rest where the rounded shoulder is as wide as the collar.
// dddaa13e7fc0: every closure seated on its glass's shoulder (the frosted ones had sunk 15-18 px); the dip
// tubes are the PSD tubes of each size and fitment (spray, lotion, atomizer), regenerated with Sunburst and
// placed by the PSD's bottle-to-tube geometry, multiplying into the glass (psd-tubes-60-100.py).
// 442e8553e83f: frosted bodies are the Sunburst r2 regenerations, registered onto the register plates
// (IoU 0.974 / 0.969, row widths within 0.6%) and cut with their alpha (regenerate-frosted.py).
// b2e520a7c344: one body per size and glass on the stage datum (clear: the new candidates, IoU 0.980 / 0.986
// to the plates; frosted: the approved photo bodies), the reducer kits' r5 bodies replaced and their
// caps seated on the shoulder (scripts/elegant-masters/build-60-100-kits.mts); one Cylinder dip tube
// per size under each fitment's own pump body, frosted in EXPLODED only (universal-dip-tube-60-100.py).
export const ELEGANT60_100_MASTER_REVIEW_VERSION = "ce5bd9ab53a0";
const exactSkus = new Map(skus.map(sku => [sku.toLowerCase(), sku]));
export function elegant60100ReviewSku(sku: string | null | undefined): string | null {
    return sku ? exactSkus.get(sku.trim().toLowerCase()) ?? null : null;
}
