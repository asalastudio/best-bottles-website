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

export type GlassPresetId = "clear" | "amber" | "cobalt" | "frosted" | "swirl";

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
  /** 0..1 — a second, sharp specular lobe on top of the transmission: the
   *  "wet" highlight production glass has and tinted plastic lacks. Pacdora's
   *  three.js glass leans on it heavily (verified in their bundle 2026-08-30;
   *  they also ship dispersion 0). Presets default to 0 so the approved looks
   *  stay bit-identical — tune in the lab (try 1.0 with roughness ~0.05). */
  clearcoat: number;
  /** micro-roughness of the clearcoat lobe only. ~0.05 for polished glass. */
  clearcoatRoughness: number;
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
    roughness: 0.02,
    ior: 1.54,
    thickness: 0.012,
    attenuationColor: "#eef6f2",
    attenuationDistance: 0.42,
    dispersion: 1.4,
    clearcoat: 0.70,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.0,
    provenance:
      "SURFACE ONLY carried over from the approved amber (2026-08-31): ior 1.54, roughness 0.02, clearcoat 0.70/0.02 - one physical glass, so the surface must not differ by colourway. The ABSORPTION below is NOT approved and still needs its own lab session. " +
      "Faintly green soda-lime, as flint glass actually is. Long attenuation " +
      "distance so only the thickest sections tint at all.",
  },
  amber: {
    id: "amber",
    label: "Amber",
    transmission: 1.0,
    roughness: 0.02,
    ior: 1.54,
    thickness: 0.0165,
    attenuationColor: "#8f4a16",
    attenuationDistance: 0.011,
    dispersion: 0.95,
    clearcoat: 0.70,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.0,
    provenance:
      "APPROVED 2026-08-31 BY JORDAN IN THE MATERIAL LAB - 'this is the " +
      "Aesop result that we want', held against public/references/9ml/" +
      "amber-studio.jpg (IMG_5048, the real bottle on a seamless sweep). " +
      "Read back out of the live lab session, not reconstructed. " +
      "THIS PRESET IS ONLY HALF THE LOOK: approved against the 'room' " +
      "studio (studio-room.hdr v8) at exposure 0.91, on the HOLLOW body " +
      "with its baked thicknessMap, through MeshTransmissionMaterial. " +
      "Swap any of those and the glass changes - these values read " +
      "near-black on a solid mesh and as a flat slab without the bake. " +
      "See studioPresets.ts APPROVED_STUDIO and public/models/" +
      "bodies-thickness/. " +
      "WHY SO DARK: measured off the reference, the real bottle transmits " +
      "only .13/.035/.003 of the backdrop through its body - far darker " +
      "than every earlier eye-set amber. attenuationDistance 0.011 against " +
      "thickness 0.0165 lets the baked map thin the walls back out, which " +
      "is what keeps it from going opaque. " +
      "Superseded: eye-set #a8571a at 0.030 (too pale once the body was " +
      "hollow); photographic solves #8b6a38 (IMG_5040 wall shot) and " +
      "#c88e63 (catalogue studio shot).",
  },
  cobalt: {
    id: "cobalt",
    label: "Cobalt",
    transmission: 1.0,
    roughness: 0.02,
    ior: 1.54,
    thickness: 0.014,
    attenuationColor: "#123f9e",
    attenuationDistance: 0.026,
    dispersion: 1.2,
    clearcoat: 0.70,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.0,
    provenance:
      "SURFACE ONLY carried over from the approved amber (2026-08-31): ior 1.54, roughness 0.02, clearcoat 0.70/0.02 - one physical glass, so the surface must not differ by colourway. The ABSORPTION below is NOT approved and still needs its own lab session. " +
      "ART DIRECTION, not measurement. No physical cobalt bottle was " +
      "available to photograph, so this is eye-set against a reference image " +
      "of unknown origin (pure white background, no room in the reflections - " +
      "likely a render or a retouched catalogue asset). " +
      "Treat it as taste until a real bottle can be shot the way clear, " +
      "frosted and amber were. " +
      "A measurement from the OLD catalogue silhouette exists and is " +
      "recorded for reference - sigma [286, 260, 19]/m, #6e77f2 at 0.014 - " +
      "but it rendered near-black and is not what ships.",
  },
  swirl: {
    id: "swirl",
    label: "Swirl",
    transmission: 0.96,
    roughness: 0.30,
    ior: 1.50,
    thickness: 0.011,
    attenuationColor: "#e2d8c6",
    attenuationDistance: 0.16,
    dispersion: 0.9,
    clearcoat: 0.70,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.0,
    provenance:
      "Clearcoat 0.70/0.02 carried over from the approved amber (2026-08-31) - same physical glass surface. Roughness deliberately NOT carried over: it is this finish's identity. Absorption NOT approved. " +
      "ART DIRECTION, not measurement - no physical swirl bottle available. " +
      "IMPORTANT: the swirl is GEOMETRY, not a material. The flutes are a real " +
      "0.970 mm relief on the mesh (catalogue O21 against the plain O20), so " +
      "this preset only supplies the glass; the character comes from the body. " +
      "Every flute adds optical path, so a preset tuned on the smooth cylinder " +
      "reads noticeably heavier here - that is physical, not a bug.",
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
    clearcoat: 0.70,
    clearcoatRoughness: 0.02,
    envMapIntensity: 0.9,
    provenance:
      "Clearcoat 0.70/0.02 carried over from the approved amber (2026-08-31) - same physical glass surface. Roughness deliberately NOT carried over: it is this finish's identity. Absorption NOT approved. " +
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
    clearcoat: preset.clearcoat,
    clearcoatRoughness: preset.clearcoatRoughness,
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
