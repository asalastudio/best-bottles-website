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
 *   view transform  ACES (three's ACESFilmic), NOT Blender's "Standard"
 *   exposure        RENDER_EXPOSURE below
 *   output          sRGB
 * See docs/configurator/RENDER-DESIGN-SYSTEM-PROPOSAL.md §3.
 */

import * as THREE from "three";

/**
 * The shared exposure. 0.91 is not a fresh choice — it is the value
 * APPROVED_STUDIO ("room") was already running in production, so adopting it
 * as the token is byte-identical for every approved look while removing the
 * per-preset drift. Blender must render at the equivalent exposure.
 */
export const RENDER_EXPOSURE = 0.91;

/** Pinned explicitly so no library default can move it. */
export const TONE_MAPPING = THREE.ACESFilmicToneMapping;
export const OUTPUT_COLOR_SPACE = THREE.SRGBColorSpace;

/** Spread into <Canvas gl={...}>. One call site, one contract. */
export const GL_COLOR_SETTINGS = {
  toneMapping: TONE_MAPPING,
  outputColorSpace: OUTPUT_COLOR_SPACE,
  toneMappingExposure: RENDER_EXPOSURE,
} as const;
