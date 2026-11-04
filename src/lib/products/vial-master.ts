import skus from "./vial-master-skus.json";

/** Local review masters for the ten Vial SKUs that had no kit, and the 2 ml amber and clear slimmer (scripts/diva-vial/vial-kits.py). */
// 858402a704fa: one glass per size from the master library PSDs (12. Vials): the 1 ml plug vials (the amber outline, the
// clear one redrawn as clear glass), the 4 ml droppers (each colour's own glass, the clear dropper's head and pipette),
// and the 9 ml short cap and glass-rod applicator; catalog-scale sizing; the 1 ml plug seated as the assembled PSDs seat
// it; the approved 2 ml amber and clear 8-425 reshaped: body 10% slimmer, neck, mouth and cap 15% narrower;
// the 3 ml tola (GB3TPlGl) and 3 ml spray bottle (LB3mlClear) from their own PSDs.
// The 9 ml 18-400 black cap and glass applicator rod redrawn with Sunburst at 4x (scripts/diva-vial/vial9-sunburst.py).
export const VIAL_MASTER_REVIEW_VERSION = "858402a704fa";
const exactSkus = new Map(skus.map(sku => [sku.toLowerCase(), sku]));
export function vialReviewSku(sku: string | null | undefined): string | null {
    return sku ? exactSkus.get(sku.trim().toLowerCase()) ?? null : null;
}
