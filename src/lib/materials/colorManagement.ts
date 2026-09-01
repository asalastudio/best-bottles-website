/* ─────────────────────────────────────────────────────────────────────────
 * GLOBAL — THIS FILE RETUNES EVERY GLASS FINISH AT ONCE.
 *
 * Clear, amber, cobalt, frosted and swirl all read through the values here.
 * A change that improves one WILL move the other four, and they will move
 * without anyone noticing, because the obvious place to look after an edit
 * is the bottle you were already looking at.
 *
 * That is not hypothetical. On 2026-09-01 tone mapping, exposure, an
 * environment rotation and two emitter edits all landed while judging a
 * single amber bottle; four finishes drifted and it took three days and a
 * founder's eye to catch. Jordan: "we keep falling back to the same
 * bullshit again and again."
 *
 * BEFORE AND AFTER any edit here:
 *     npm run look:sheet      # all five finishes, side by side
 *     npm run look:verify     # the lock — also enforced in CI
 *
 * Per-finish work does NOT belong in this file:
 *     one glass finish  -> src/lib/materials/glassPresets.ts
 *     one part/material -> public/models/materials.json (+ npm run materials:port)
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * Colour management — the single place both lanes agree on.
 *
 * WHY THIS FILE EXISTS
 * Before it, the web took React Three Fiber's DEFAULT tone mapping. A default
 * is a value nobody chose and a library upgrade can change underneath you, and
 * it was silently the thing every approved material had been tuned against:
 * CAP_SHINY_GOLD's own note records dropping envMapIntensity so its hue would
 * "survive the tone curve". That curve was never written down. Now it is.
 *
 * Exposure was also drifting — four studio presets each carried their own
 * (1.05 / 0.91 / 0.95 / 1.05) and production silently used whichever preset
 * APPROVED_STUDIO happened to point at. The brief requires ONE exposure shared
 * with Blender, so it becomes a token here.
 *
 * BLENDER PARITY CONTRACT — the hero lane must match these exactly:
 *   view transform  Khronos PBR Neutral (three's NeutralToneMapping)
 *   exposure        RENDER_EXPOSURE below
 *   output          sRGB
 * See docs/configurator/RENDER-DESIGN-SYSTEM-PROPOSAL.md §3.
 *
 * NOTE the parity target CHANGED with the tone mapper (see below). Blender has
 * no built-in PBR Neutral view transform, so hero-lane parity now needs the
 * Khronos OCIO config or a matching OCIO/LUT step. Until that is set up, hero
 * stills and the web render are NOT byte-comparable — do not treat a
 * side-by-side as a material discrepancy.
 */

import * as THREE from "three";

/**
 * The shared exposure. Was 0.91, inherited from the "room" preset so that
 * adopting the token was byte-identical for every approved look. Moved to 1.0
 * with the switch to Neutral: the two curves have different response, so 0.91
 * was an ACES-specific anchor and carrying it over would have measured the
 * wrong thing. 1.0 is the audit's Neutral baseline — tune environment energy
 * first and only then touch global exposure.
 */
export const RENDER_EXPOSURE = 1.0;

/**
 * Khronos PBR Neutral, not ACES.
 *
 * ACES is a FILM view transform. Its highlight rolloff desaturates as it
 * compresses, so a bright saturated value is pushed toward white — which is
 * fine for cinema and wrong for merchandising, where the job is to show the
 * customer the colour of the actual product. Khronos published PBR Neutral
 * specifically for e-commerce PBR: it preserves hue and saturation through the
 * highlights and only compresses what would otherwise clip.
 *
 * This matters for the pale silhouette rim Jordan flagged. Six causes were
 * tested and excluded — the rear emitter, the HDRI's silhouette peak (rotated
 * 98% away), the amber's clearcoat, the cove sweep, the transmission backside
 * pass, and the baked thickness map. The rim survived all six, which is the
 * signature of a POST-PROCESS effect: a tone curve runs after every one of
 * them, so nothing upstream can move it. ACES lifting a bright grazing
 * reflection to white fits that evidence where no material cause did.
 *
 * Adopted on Jordan's reference (khronos.org PBR Neutral announcement) and the
 * 2026-09-01 studio audit, which makes it the merchandising baseline.
 */
export const TONE_MAPPING = THREE.NeutralToneMapping;
export const OUTPUT_COLOR_SPACE = THREE.SRGBColorSpace;

/** Spread into <Canvas gl={...}>. One call site, one contract. */
export const GL_COLOR_SETTINGS = {
  toneMapping: TONE_MAPPING,
  outputColorSpace: OUTPUT_COLOR_SPACE,
  toneMappingExposure: RENDER_EXPOSURE,
} as const;
