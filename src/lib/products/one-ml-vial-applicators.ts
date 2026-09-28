/** Exact legacy assemblies for the 1 mL plug vials. These are photographed
 * with the applicator installed; the generic plug plates show it beside the
 * bottle and must not be used for the black/white product option. */
const ASSEMBLED_VIALS = {
  GB1mlAmbVBlk: { color: "Black", image: "/images/pdp/assembled-vials-2026-09-27/GB1mlAmbVBlk.png" },
  GB1mlAmbVialWht: { color: "White", image: "/images/pdp/assembled-vials-2026-09-27/GB1mlAmbVialWht.png" },
  GB1mlVBlk: { color: "Black", image: "/images/pdp/assembled-vials-2026-09-27/GB1mlVBlk.png" },
  GB1mlVWht: { color: "White", image: "/images/pdp/assembled-vials-2026-09-27/GB1mlVWht.png" },
} as const;

export function oneMlVialApplicator(websiteSku: string | null | undefined) {
  return websiteSku && websiteSku in ASSEMBLED_VIALS
    ? ASSEMBLED_VIALS[websiteSku as keyof typeof ASSEMBLED_VIALS]
    : null;
}

export function isOneMlVialGroup(slug: string | null | undefined): boolean {
  return slug === "vial-1ml-amber-Plug" || slug === "vial-1ml-clear-Plug";
}

export function isAssembledOneMlVialImage(url: string | null | undefined): boolean {
  return Boolean(url?.startsWith("/images/pdp/assembled-vials-2026-09-27/"));
}
