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
  /** false = skip the baked thicknessMap for this finish. The bake encodes
   *  ABSORPTION depth, which colourless glass has none of - all the map does
   *  on clear is modulate the refraction offset, drawing the bake's shoulder
   *  transition as a horizontal band (Jordan, 2026-08-31). Clear keeps the
   *  smooth scalar. Defaults true. */
  thicknessBake?: boolean;
  /** static glass-waviness: MeshTransmissionMaterial's distortion. Real
   *  bottle walls are slightly irregular and the refraction SWIMS - the
   *  strongest single "this is glass" cue a colourless bottle has. Keep it
   *  subtle; zero for finishes whose character comes from elsewhere. */
  distortion: number;
  /** true = this finish is acid-etched on the BODY ONLY, with a clear glass
   *  finish. Real etched bottles mask the neck so the closure seals, and the
   *  reference photograph shows exactly that: clear threads on a frosted
   *  body. Consumes <bodyId>.frost.png as a roughnessMap. */
  frostMask?: boolean;
  /** how far the TRANSMITTED image is smeared. Was a hidden step in the lab
   *  (roughness > 0.4 ? 0.6 : 0.1), which slammed frosted to 0.6 and turned
   *  it into opaque white plastic - etched glass is TRANSLUCENT, you should
   *  still make out the far wall. Now data, per finish. */
  anisotropicBlur: number;
  /** degrees. Per-colourway studio rotation, so the highlights land in a
   *  different place on each finish instead of five identical bottles
   *  (Jordan, 2026-08-31). It rotates the SAME approved room - no new
   *  emitters, so it cannot reintroduce the horizon-line artefact. */
  envRotationDeg: number;
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
    thickness: 0.002,
    attenuationColor: "#eef6f2",
    attenuationDistance: 0.06,
    dispersion: 1.4,
    clearcoat: 0.70,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.15,
    thicknessBake: false,
    distortion: 0.14,
    anisotropicBlur: 0.05,
    envRotationDeg: 62,
    provenance:
      "thickness 0.002 = the WALL, not the vessel: a hollow clear bottle is optically two thin plates. Vessel-scale 0.0165 made MTM refract like a SOLID ROD, smearing the backdrop into milk (Jordan: more frosted than clear). Tinted colourways keep vessel-scale thickness because theirs feeds ABSORPTION via the bake; clear opts out of the bake so its thickness is purely optical. " +
      "CLEAR IS A MIRROR AND A LENS, so its dials are not the tinted ones: envMapIntensity 1.35 (reflection carries most of the read), distortion 0.14 (static wall waviness - the refraction must SWIM), anisotropicBlur 0.05 (crisp). The cyclorama darkens far off-axis specifically so the edge lens has something to compress into the dark silhouette bands every real clear bottle shows. "
      + "THE RATIO METHOD DOES NOT APPLY TO THIS FINISH. Measured 2026-08-31: the reference sits at T = .689/.686/.678 of the backdrop, but sweeping absorption on the live canvas bottoms out at .913 even at attenuationDistance 0.012 - and going further just yields GREY PLASTIC, which is the documented anti-pattern. The gap is not absorption: a near-colourless bottle gets its presence from REFRACTION, EDGES and REFLECTION, and the reference photo was shot in a room with far more to refract than our studio. So this preset keeps absorption minimal by design and is judged STRUCTURALLY (are the edges, the far wall and the shoulder legible?), not by a transmission number. attenuationDistance 0.06 measures .974/.978/.974 - just enough for the thick heel and finish to pick up the faint soda-lime green." +
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
    attenuationDistance: 0.015,
    dispersion: 0.95,
    clearcoat: 0.70,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.0,
    distortion: 0,
    anisotropicBlur: 0.10,
    envRotationDeg: 0,
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
      "attenuationDistance 0.015 SET BY JORDAN 2026-08-31 after the room v9 " +
      "ambient cut, and it is the counter-intuitive one - RAISING it (less " +
      "absorption) made the glass MORE saturated, not less. Measured on the " +
      "live canvas, body mid as a fraction of the backdrop:\n" +
      "    0.011 -> .097/.040/.040   blue/red 0.41\n" +
      "    0.015 -> .194/.049/.045   blue/red 0.23  <- shipping\n" +
      "    real  -> .130/.035/.003   blue/red 0.02\n" +
      "Surface reflection is a FIXED colourless floor; letting more tinted " +
      "light through raises the amber signal above it. So when this glass " +
      "reads washed out, the fix is more transmission or a darker room - " +
      "NOT more absorption, which only crushes it toward black. It ships " +
      "brighter than the reference photograph (red .194 vs .130) by choice: " +
      "the photo has its own exposure, and the luminous read is the Aesop " +
      "one Jordan approved. " +
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
    thickness: 0.017,
    attenuationColor: "#060cc4",
    attenuationDistance: 0.013,
    dispersion: 0.95,
    clearcoat: 0.70,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.0,
    distortion: 0,
    anisotropicBlur: 0.3,
    envRotationDeg: 34,
    provenance:
      "APPROVED 2026-08-31 BY JORDAN ('that cobalt looks really good', then " +
      "hand-tuned and locked). Values pasted from his live session verbatim. " +
      "Base colour #060cc4 was SOLVED by measurement against " +
      "public/references/9ml/cobalt.jpg: sweeping attenuationColor and " +
      "reading the live canvas, #060cc4 measures .000/.035/.592 vs the " +
      "reference .007/.066/.608 - blue within .016. GREEN IS FLOOR-LIMITED " +
      "(.035 for every value #060cc4..#0620c4): that is the neutral " +
      "reflection floor, not the glass - do not chase it. Jordan then " +
      "deepened it: thickness 0.017, attenuationDistance 0.013, and " +
      "anisotropicBlur 0.3 - the SMOKY transmission is a deliberate look " +
      "choice for cobalt (vs amber's 0.1); it softens what shows through " +
      "the blue without frosting the surface. " +
      "Superseded: eye-set #123f9e at 0.026 (measured .017/.043/.288 - " +
      "far too pale and too green).",
  },

  swirl: {
    id: "swirl",
    label: "Swirl",
    transmission: 0.96,
    roughness: 0.30,
    ior: 1.54,
    thickness: 0.0165,
    attenuationColor: "#e2d8c6",
    attenuationDistance: 0.16,
    dispersion: 0.9,
    clearcoat: 0.70,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.0,
    distortion: 0.06,
    anisotropicBlur: 0.15,
    envRotationDeg: 46,
    provenance:
      "THE RATIO METHOD DOES NOT APPLY TO THIS FINISH. Measured 2026-08-31: the reference sits at T = 1.108/1.160/1.208 - BRIGHTER than the backdrop of the backdrop, but sweeping absorption on the live canvas bottoms out at .913 even at attenuationDistance 0.012 - and going further just yields GREY PLASTIC, which is the documented anti-pattern. The gap is not absorption: a near-colourless bottle gets its presence from REFRACTION, EDGES and REFLECTION, and the reference photo was shot in a room with far more to refract than our studio. So this preset keeps absorption minimal by design and is judged STRUCTURALLY (are the edges, the far wall and the shoulder legible?), not by a transmission number. A value above 1.0 cannot come from absorption at all; the flutes CONCENTRATE light, which is geometry doing the work. Roughness 0.30 is kept as this finish\u2019s identity." +
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
    ior: 1.54,
    thickness: 0.0165,
    attenuationColor: "#b6babd",
    attenuationDistance: 0.028,
    dispersion: 0.5,
    clearcoat: 0.70,
    clearcoatRoughness: 0.02,
    envMapIntensity: 0.9,
    frostMask: true,
    distortion: 0.05,
    anisotropicBlur: 0.25,
    envRotationDeg: 18,
    provenance:
      "SOLVED 2026-08-31 by measurement, approved by Jordan ('keep it'). " +
      "The earlier claim that the ratio method cannot apply to frosted was " +
      "WRONG in one respect: the reference measures 27% DARKER than its " +
      "backdrop (T .727/.722/.709), and that loss is SCATTERING, which a " +
      "mild neutral-cool absorption models well. Sweep on the live canvas: " +
      "#b6babd at attenuationDistance 0.028 -> T .725/.736/.742, within " +
      ".004/.014/.033 of the reference. The lossless white (#f4f6f5 at 0.28, " +
      "T .983) was exactly the 'white plastic' Jordan rejected - a frosted " +
      "bottle with no transmission loss reads as plastic. " +
      "frostMask: the reference shows CLEAR THREADS on the etched body - " +
      "real acid-etching masks the finish so the closure seals; " +
      "<bodyId>.frost.png (bake_thickness.py --frost-datum-mm 55) feeds the " +
      "roughnessMap so one mesh carries both surfaces. Roughness 0.55 and " +
      "anisotropicBlur 0.25 remain this finish's surface identity. " +
      "Measured truth kept: the etch itself is neutral (sat 0.00); the " +
      "attenuation here stands in for scatter loss, not colour.",
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
