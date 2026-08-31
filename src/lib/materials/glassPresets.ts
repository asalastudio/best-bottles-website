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
  /** false = colourway exists in the lab but is NOT offered to customers
   *  yet (swirl: its fluted body has no bake and would render as a smooth
   *  cylinder). The configurator filters on this. */
  configuratorReady?: boolean;
  /** true = render as THIN-WALL glass: no backside pass, near-zero optical
   *  path. MeshTransmissionMaterial's backside machinery is built for SOLID
   *  volumes; on a hollow shell its "backside" is the INTERIOR surfaces, so
   *  it literally draws the cavity's bore-to-wall transition into the glass
   *  (the stubborn line below the shoulder) and fogs the body. Thin clear
   *  glass barely refracts - Pacdora's clear passes the background through
   *  almost undistorted. Tinted colourways MUST stay volume-mode: absorption
   *  is their identity. */
  thinWall?: boolean;
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

/**
 * THE canonical glass — measured soda-lime from the absorbed library
 * (data/materials/physicallybased-library.json, glass.glass; CC0 from
 * physicallybased.info). Every colourway is THIS glass: clear ships it
 * almost verbatim; the tinted colourways change ONLY absorption (their
 * identity) and carry their Jordan-approved deviations explicitly.
 * material_lock.py verifies clear stays anchored to these values.
 */
export const GLASS_BASE = {
  transmission: 1.0,
  roughness: 0,
  ior: 1.52,
  dispersion: 0.31,
  attenuationColor: "#fdfefe",   // library linear [0.984, 0.995, 0.995]
  attenuationDistance: 1.0,
} as const;

export const GLASS_PRESETS: Record<GlassPresetId, GlassPreset> = {
  clear: {
    id: "clear",
    label: "Clear",
    transmission: 1.0,
    roughness: 0,
    ior: 1.52,
    thickness: 0.0095,
    attenuationColor: "#fdfefe",
    attenuationDistance: 1.0,
    dispersion: 0.31,
    clearcoat: 0,
    clearcoatRoughness: 0,
    envMapIntensity: 1.2,
    thicknessBake: false,
    thinWall: true,
    distortion: 0.05,
    anisotropicBlur: 0.05,
    envRotationDeg: 62,
    provenance:
      "APPROVED 2026-08-31 BY JORDAN (pasted from his lab session verbatim: thickness 0.0095, up from 0.004 - more refractive presence through the thin-wall path). Held on the PDP taupe stage at envRotationDeg 62. " +
      "ADOPTED 2026-08-31 from the physicallybased.info measured glass (data/materials/physicallybased-library.json, glass.glass — the showcase ball Jordan pointed at): roughness 0, ior 1.52, dispersion 0.31, near-white attenuation @ 1.0m. Kept from our architecture: thinWall + DoubleSide + wall-scale thickness (their ball is a solid sphere; our bottle is a hollow shell). " +
      "Jordan 2026-08-31: the rough-0.1 recipe read as frosted-lite, so it moved to the FROSTED preset; clear sharpens to roughness 0.04 with envMapIntensity 1.2 (Pacdora themselves run the same recipe at two points - 0.1 on the spray model, 0.06 on the 550911 bottle). Stage on the umber/grey ground: on bone, colourless glass is white-on-white. " +
      "PACDORA'S EXACT RECIPE, scraped 2026-08-31 from their model API " +
      "(api/v2/models/details, mockup 510470, part '主体'/body): stock " +
      "MeshPhysicalMaterial - transmission 1, thickness ABSENT (0: zero " +
      "refraction offset, background passes straight through), roughness " +
      "0.1 (NOT polished 0.02 - this IS their soft visible sheen), ior 1.5, " +
      "clearcoat 0, side DOUBLE (both shell walls render - back wall and " +
      "doubled edges for free, no backside machinery), transparent true. " +
      "No thicknessMap, no attenuation, no dispersion. thinWall mode " +
      "renders this preset through the plain MeshPhysicalMaterial path " +
      "with DoubleSide. Their parts list also confirms the content " +
      "principle: dip tube, liquid filler mesh and label are separate " +
      "meshes behind the glass.",
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
    configuratorReady: false,
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
    roughness: 0.45,
    ior: 1.54,
    thickness: 0.0165,
    attenuationColor: "#b6babd",
    attenuationDistance: 0.048,
    dispersion: 0.5,
    clearcoat: 0.70,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.15,
    frostMask: true,
    distortion: 0.05,
    anisotropicBlur: 0.12,
    envRotationDeg: 18,
    provenance:
      "PDP STAGE ADJUSTMENT 2026-08-31: the measured scatter loss (#b6babd @ 0.028) was solved against the lab\u2019s BONE backdrop; on the PDP\u2019s warm taupe vitrine it rendered too dark with a heavy top gradient (Jordan: not accurate). attenuationDistance eased to 0.048 and envMapIntensity lifted to 1.15 so the white surface scatter carries more of the read. Re-verify against frosted.jpg if the stage changes again. " +
      "BACK ON THE MTM PATH 2026-08-31 after the thin-wall detour: native transmission couples its screen-space blur to surface roughness, so the frosted body SMEARED the gold cap downward into the glass on pan (Jordan: colour pours into the bottle). MeshTransmissionMaterial decouples them - roughness 0.45 keeps the etch, anisotropicBlur 0.12 keeps the transmission calm. Measured scatter values restored: #b6babd @ 0.028 (T .725/.736/.742 vs reference .727/.722/.709). " +
      "REBASED 2026-08-31 onto the Pacdora thin-wall recipe (Jordan: the rough-0.1 DoubleSide clear registered as frosted - so frosted claims it): thinWall + DoubleSide + thickness 0.0002, roughness 0.45 for the etch. NOTE the measured scatter-loss attenuation (#b6babd @ 0.028) cannot act at thin-wall thickness - the slight darkening now comes from the material colour path; re-tune by eye against frosted.jpg. " +
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
    side: preset.thinWall ? THREE.DoubleSide : THREE.FrontSide,
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
