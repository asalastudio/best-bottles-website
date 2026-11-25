/** Stills for the 1 mL plug vials, applicator installed: the generic plug plates show it beside the bottle and must
 * not be used for the black/white product option. Since 25 Nov 2026 these are flat composites of the approved kits
 * (small-glass body and plug layers; scripts/diva-vial/one-ml-composites.mts), framed exactly as the catalog card's
 * master draws them on the bone stage, with transparent surroundings. They replace the 27 Sep assembled photographs
 * (old glass, on white), so the card's first paint, product page fallbacks, Line items and previews show the same
 * bottle as the master. Being framed already, they need no blend or scale treatment. */
const ASSEMBLED_VIALS = {
  GB1mlAmbVBlk: { color: "Black", image: "/images/pdp/one-ml-small-glass-2026-11-25/GB1mlAmbVBlk.6327a5a8c55d.png" },
  GB1mlAmbVialWht: { color: "White", image: "/images/pdp/one-ml-small-glass-2026-11-25/GB1mlAmbVialWht.8c1cde8c18b4.png" },
  GB1mlVBlk: { color: "Black", image: "/images/pdp/one-ml-small-glass-2026-11-25/GB1mlVBlk.743e5baf1cf9.png" },
  GB1mlVWht: { color: "White", image: "/images/pdp/one-ml-small-glass-2026-11-25/GB1mlVWht.1516aff1fcbd.png" },
} as const;

/** websiteSku -> still, for the exact-SKU image map (reconciled-sku-images.ts). */
export const ONE_ML_VIAL_STILLS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(ASSEMBLED_VIALS).map(([sku, { image }]) => [sku, image]));

export function oneMlVialApplicator(websiteSku: string | null | undefined) {
  return websiteSku && websiteSku in ASSEMBLED_VIALS
    ? ASSEMBLED_VIALS[websiteSku as keyof typeof ASSEMBLED_VIALS]
    : null;
}

export function isOneMlVialGroup(slug: string | null | undefined): boolean {
  return slug === "vial-1ml-amber-Plug" || slug === "vial-1ml-clear-Plug";
}

/** The retired 27 Sep photographs (white ground, loosely framed): drawn multiplied and scaled down if a stale URL
 * (an old Convex imageUrl) still reaches a surface. The composites above are not matched. */
export function isAssembledOneMlVialImage(url: string | null | undefined): boolean {
  return Boolean(url?.startsWith("/images/pdp/assembled-vials-2026-09-27/"));
}

/** A 1 mL kit composite: transparent around the bottle, its glass composited on bone, so a surface that shows it as
 * a photo gives it the bone stage (#f5f3ef) it was drawn on. */
export function isOneMlVialStill(url: string | null | undefined): boolean {
  return Boolean(url?.startsWith("/images/pdp/one-ml-small-glass-2026-11-25/"));
}
