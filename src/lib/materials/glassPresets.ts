import * as THREE from "three";

/**
 * Glass material presets — the production data layer.
 *
 * These are DATA, not JSX. The Material Lab tunes them and the configurator
 * consumes them, so a value that works is never buried inside a component
 * again.
 *
 * WHAT THE BROWSER CAN AND CANNOT DO
 * ----------------------------------
 * `thickness` in three.js is a FIXED SCALAR, not the distance a ray actually
 * travels through the mesh. Cycles integrates the real path, which is why an
 * offline render of a solid body goes dark where the glass is thick and pale
 * at the neck. three.js applies one uniform attenuation everywhere.
 *
 * So `thickness` here is a DIAL that stands in for an average optical path —
 * not a measurement. Two consequences:
 *   - "thicker areas look darker" does not happen for free; it is faked
 *     globally by the thickness/attenuationDistance pair.
 *   - a preset tuned on one body still reads correctly on another, because
 *     nothing depends on that body's real wall.
 *
 * THE PHYSICS THAT DOES TRANSFER
 * ------------------------------
 * The absorption coefficient sigma is renderer-independent:
 *     Blender    sigma = density x (1 - volumeColour)
 *     three.js   sigma = -ln(attenuationColor) / attenuationDistance
 * Amber below was solved that way from a photograph of a real Best Bottles
 * 9 mL amber (IMG_5040): measured transmission R .260 G .143 B .040 through a
 * ray-cast 3.24 mm x2 wall gives sigma = [208, 300, 497] /m.
 */

export type MaterialRole =
  | "bottle_glass"
  | "cap"
  | "closure"
  | "insert";

export type GlassPresetId = "clear" | "amber" | "cobalt" | "frosted";

export type GlassPreset = {
  id: GlassPresetId;
  label: string;
  /** 0..1 — glass is ~1. Lowering this reads as plastic, not as tint. */
  transmission: number;
  /** 0 = optically polished. >0.4 starts to read as frosted/etched. */
  roughness: number;
  /** soda-lime container glass is 1.52; treat drift from it as suspicious. */
  ior: number;
  /** metres. A stand-in for average optical path — see the note above. */
  thickness: number;
  /** what SURVIVES the glass. Keep it bright; a dark value double-darkens. */
  attenuationColor: string;
  /** metres. Distance over which light falls to attenuationColor. */
  attenuationDistance: number;
  /** prismatic edge split. The cheapest single cue that stops glass reading
   *  as tinted plastic. three >= 0.176. */
  dispersion: number;
  /** how hard the studio shows in the surface. */
  envMapIntensity: number;
  /** where the numbers came from, so nobody re-guesses them later. */
  provenance: string;
};

export const GLASS_PRESETS: Record<GlassPresetId, GlassPreset> = {
  clear: {
    id: "clear",
    label: "Clear",
    transmission: 1.0,
    roughness: 0.03,
    ior: 1.52,
    thickness: 0.012,
    attenuationColor: "#eef6f2",
    attenuationDistance: 0.42,
    dispersion: 1.4,
    envMapIntensity: 1.0,
    provenance:
      "Faintly green soda-lime, as flint glass actually is. Long attenuation " +
      "distance so only the thickest sections tint at all.",
  },
  amber: {
    id: "amber",
    label: "Amber",
    transmission: 1.0,
    roughness: 0.04,
    ior: 1.52,
    thickness: 0.014,
    attenuationColor: "#a8571a",
    attenuationDistance: 0.030,
    dispersion: 1.2,
    envMapIntensity: 1.0,
    provenance:
      "APPROVED BY EYE. These are the values that actually look right in the " +
      "browser. A measured alternative exists and was tried: IMG_5040 gives " +
      "sigma [208,300,497]/m -> #8b6a38 at distance 0.014, and it renders DARK " +
      "and murky. Measurement is grounded, but it is not automatically better " +
      "than the eye for APPEARANCE, and rasterized transmission is not the " +
      "path-traced glass those numbers were solved against. Measured detail " +
      "kept for reference: T = .260/.143/.040 over a " +
      "ray-cast 3.24 mm x2 wall -> sigma [208,300,497]/m. attenuationDistance " +
      "is set EQUAL to thickness, which collapses three.js' Beer-Lambert to " +
      "exp(ln(c)) = c — so attenuationColor IS the transmitted colour and can " +
      "be held against the photograph by eye. " +
      "CAUTION — two photographs disagree: the catalogue studio shot " +
      "(GBCylAmb9MtlRollMattSl) measures a PALER amber, sigma [85, 202, 320]/m, " +
      "giving attenuationColor #c88e63. IMG_5040 was shot on a wall with known " +
      "conditions and is the value used here; the catalogue shot is older and " +
      "brighter-lit. If amber reads too dark in the product, #c88e63 is the " +
      "documented alternative, not a guess.",
  },
  cobalt: {
    id: "cobalt",
    label: "Cobalt",
    transmission: 1.0,
    roughness: 0.04,
    ior: 1.52,
    thickness: 0.014,
    attenuationColor: "#123f9e",
    attenuationDistance: 0.026,
    dispersion: 1.2,
    envMapIntensity: 1.0,
    provenance:
      "APPROVED BY EYE — the measured value (#6e77f2 at 0.014) renders " +
      "near-black. Measurement kept for reference: " +
      "T = .156/.185/.884 -> sigma [286, 260, 19]/m. Note how lopsided that " +
      "is — cobalt oxide blocks red and green almost completely and passes a " +
      "narrow deep blue, which is why it must NOT be authored as a blue tint " +
      "with even absorption.",
  },
  frosted: {
    id: "frosted",
    label: "Frosted",
    transmission: 0.98,
    roughness: 0.55,
    ior: 1.50,
    thickness: 0.010,
    attenuationColor: "#f4f6f5",
    attenuationDistance: 0.28,
    dispersion: 0.5,
    envMapIntensity: 0.9,
    provenance:
      "APPROVED BY EYE. The measurement still stands and is the useful " +
      "finding: T = .896/.898/.899 — " +
      "PERFECTLY NEUTRAL, saturation 0.00. That is the finding: frosted glass " +
      "has essentially NO volume absorption. It is the same clear glass with " +
      "an etched SURFACE, so almost all of its character lives in `roughness`, " +
      "not in attenuation. Roughness 0.55 is eye-set and is the one value here " +
      "that a photograph cannot give us — tune it in the Material Lab. " +
      "Dropping transmission instead of raising roughness is what makes " +
      "frosted read as grey plastic.",
  },
};

/**
 * THE PRODUCTION API.
 *
 * The configurator calls this; the lab calls this. One code path, so a preset
 * that looks right in the lab looks identical in the product.
 */
export function applyGlassPreset(
  mesh: THREE.Mesh,
  preset: GlassPreset,
): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, // colour lives in ATTENUATION, never in base colour
    metalness: 0,
    roughness: preset.roughness,
    transmission: preset.transmission,
    ior: preset.ior,
    thickness: preset.thickness,
    attenuationColor: new THREE.Color(preset.attenuationColor),
    attenuationDistance: preset.attenuationDistance,
    dispersion: preset.dispersion,
    envMapIntensity: preset.envMapIntensity,
    transparent: true,
    side: THREE.FrontSide,
  });
  const old = mesh.material;
  mesh.material = m;
  if (old && !Array.isArray(old)) old.dispose();
  return m;
}

/** Mesh name -> semantic role. The GLBs ship with NO materials, so the mesh
 *  name is the only binding we have — this makes that explicit rather than
 *  scattering `startsWith` checks through components. */
export function roleOf(meshName: string): MaterialRole | null {
  if (meshName.startsWith("BB_BTL_")) return "bottle_glass";
  if (meshName.startsWith("BB_CAP_")) return "cap";
  if (meshName.startsWith("BB_ROLL_BALL_")) return "insert";
  if (meshName.startsWith("BB_ROLL_") || meshName.startsWith("BB_SPR_") ||
      meshName.startsWith("BB_PMP_")) return "closure";
  return null;
}

export const isGlassPresetId = (v: string): v is GlassPresetId =>
  v in GLASS_PRESETS;
