"use client";

/**
 * Bottle3DViewer — the PRODUCTION configurator surface.
 *
 * The Material Lab (/dev/material-lab) is where values are tuned; this is
 * where customers meet them. Both consume the same data — GLASS_PRESETS,
 * STUDIO_PRESETS, materials.json — so a look approved in the lab is the
 * look that ships. Nothing visual is authored here.
 *
 * Slots into the PDP's main image slot, with ProductImageGallery dropping
 * to `mode="thumbs-only"` beneath it (the arrangement that component was
 * designed for).
 */

import { Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import {
  OrbitControls, useGLTF, useTexture, useEnvironment,
  MeshTransmissionMaterial, Center,
} from "@react-three/drei";
import ProductStage, { STAGE, useStageQuality } from "./ProductStage";
import { useMetalStudioHdri } from "@/lib/materials/metalStudio";
import {
  loadTokens, getSpec, createMaterial, ensureCylindricalUV, needsCylindricalUV,
  type TokenFile,
} from "@/lib/materials/registry";
import * as THREE from "three";
import {
  GLASS_PRESETS, applyGlassPreset, roleOf,
  type GlassPresetId, type GlassPreset,
} from "@/lib/materials/glassPresets";

export type ClosureMode =
  | "none" | "capped" | "roller" | "rollerCapped"
  | "reducer" | "reducerCapped" | "antique" | "antiqueTassel" | "dropper"
  | "sprayer" | "sprayerCapped" | "pump" | "pumpCapped";

/** cap MOULDINGS — different physical caps sharing one thread (18-415
 *  ships short / tall / leather; leather materials force their moulding) */
export type CapMoulding = "short" | "tall" | "leather";

type MatSpec = {
  color: string; roughness: number; metalness: number;
  clearcoat?: number; ior?: number; transmission?: number;
  envMapIntensity?: number; env?: string; maps?: string | null;
};

/* --------------------------------------------------------------- closure */

function Closure({ mode, neckY, capMat, ballMat, rollerVariant, trimMat, solidBody,
                   finish = "17-415", capMoulding = "short" }: {
  mode: ClosureMode; neckY: number; capMat: string; ballMat: string;
  /** neck finish — selects the closure GLB set (17-415 | 18-415) */
  finish?: "17-415" | "18-415";
  capMoulding?: CapMoulding;
  /** metal (MtlRoll SKUs) or plastic (Roll SKUs) roll-on hardware */
  rollerVariant: "metal" | "plastic";
  /** spray/pump collar+actuator colour (SKU-derived: Blk/Gl/MattSl/ShSl/Tur/Rd) */
  trimMat: string;
  /** true = the glass is a SOLID mesh, so there is no cavity for an interior
   *  part to sit in. A dip tube modelled inside solid glass is refracted
   *  through the whole body and arrives as a bent orange streak — it is not a
   *  shading bug, the tube is geometrically embedded in glass. Interior parts
   *  are dropped rather than drawn wrong. */
  solidBody?: boolean;
}) {
  const housingSteel = useGLTF("/models/closures/BB_ROLL_HOUSING_17415_STEEL.glb");
  const housingPlastic = useGLTF("/models/closures/BB_ROLL_HOUSING_17415_PLASTIC.glb");
  const ballSteel = useGLTF("/models/closures/BB_ROLL_BALL_17415_STEEL.glb");
  const ballPlastic = useGLTF("/models/closures/BB_ROLL_BALL_17415_PLASTIC.glb");
  const fin = finish.replace("-", "");
  const cap = useGLTF(`/models/closures/BB_CAP_${fin}.glb`);
  // moulding variants ship for 18-415 only; hooks must run unconditionally,
  // so other finishes load the base cap under both names (cheap, cached)
  const has1841 = fin === "18415";
  const capTall = useGLTF(has1841
    ? "/models/closures/BB_CAP_18415_TALL.glb" : `/models/closures/BB_CAP_${fin}.glb`);
  const capLeather = useGLTF(has1841
    ? "/models/closures/BB_CAP_18415_LEATHER.glb" : `/models/closures/BB_CAP_${fin}.glb`);
  const capDots = useGLTF("/models/closures/BB_CAP_DOTS_17415.glb");
  // fine-mist sprayer + lotion pump: every part origins at the neck rim
  // per the closures manifest — zero transforms. The whole set exists per
  // finish (17-415 measured from Spry17-415, 18-415 from Spry18-415).
  const collar = useGLTF(`/models/closures/BB_SPR_COLLAR_${fin}.glb`);
  const actuator = useGLTF(`/models/closures/BB_SPR_ACTUATOR_${fin}.glb`);
  const overcap = useGLTF(`/models/closures/BB_SPR_OVERCAP_${fin}.glb`);
  const spout = useGLTF(`/models/closures/BB_PMP_SPOUT_${fin}.glb`);
  const dipTube = useGLTF(`/models/closures/BB_DIP_TUBE_${fin}.glb`);
  const pumpBody = useGLTF(`/models/closures/BB_PMP_BODY_${fin}.glb`);
  const drpCollar = useGLTF(has1841
    ? "/models/closures/BB_DRP_COLLAR_18415.glb" : `/models/closures/BB_CAP_${fin}.glb`);
  const drpBulb = useGLTF(has1841
    ? "/models/closures/BB_DRP_BULB_18415.glb" : `/models/closures/BB_CAP_${fin}.glb`);
  const drpPipette = useGLTF(has1841
    ? "/models/closures/BB_DRP_PIPETTE_18415.glb" : `/models/closures/BB_CAP_${fin}.glb`);
  const anspCollar = useGLTF(has1841
    ? "/models/closures/BB_ANSP_COLLAR_18415.glb" : `/models/closures/BB_CAP_${fin}.glb`);
  const anspBulb = useGLTF(has1841
    ? "/models/closures/BB_ANSP_BULB_18415.glb" : `/models/closures/BB_CAP_${fin}.glb`);
  const anspTassel = useGLTF(has1841
    ? "/models/closures/BB_ANSP_TASSEL_18415.glb" : `/models/closures/BB_CAP_${fin}.glb`);
  const reducer = useGLTF(has1841
    ? "/models/closures/BB_REDUCER_18415.glb"
    : `/models/closures/BB_CAP_${fin}.glb`);
  const nozzle = useGLTF(has1841
    ? "/models/closures/BB_SPR_NOZZLE_18415.glb"
    : `/models/closures/BB_DIP_TUBE_${fin}.glb`);
  // ONE source of truth for every material — see lib/materials/registry.ts
  const [mats, setMats] = useState<TokenFile | null>(null);
  useEffect(() => {
    let dead = false;
    loadTokens().then((t) => { if (!dead) setMats(t); }).catch(() => {});
    return () => { dead = true; };
  }, []);

  // three material classes, three environments — see the glass-material-lab
  // skill: glass mirrors the room, plastics the tent, metals a REAL studio
  // HDRI (Poly Haven monochrome_studio_02): actual softboxes give metals
  // genuine structured reflections; monochrome keeps silver silver.
  const metalEnv = useMetalStudioHdri();
  const plasticEnv = useEnvironment({ files: "/models/studio-browser.hdr" });
  // library matte finish maps (physicallybased): maps:"matte" in the registry
  const matteMaps = useTexture({
    normal: "/models/pbr/matte/normal.png",
    rough: "/models/pbr/matte/roughness.png",
  });
  // leather grain (CC0 ambientCG Leather028) — without it the leather caps
  // wore the generic matte maps and read as painted plastic
  const leatherMaps = useTexture({
    normal: "/models/pbr/leather/normal.png",
    rough: "/models/pbr/leather/roughness.png",
  });
  // matcap for the dip tube: view-dependent core/edge/sheen baked into one
  // image - the only way a translucent-plastic read survives the opaque
  // pass without env flare (matcaps ignore the environment entirely)
  const tubeMatcap = useTexture("/models/matcaps/diptube.png");
  // GLASS parts (dropper pipette) get the glass-rod matcap: bright TIR
  // rim, dark refraction ring, background core — the double-line glass
  // read; the milky diptube matcap stays for PP tubes
  const glassMatcap = useTexture("/models/matcaps/glassrod.png");
  useEffect(() => {
    for (const t of [tubeMatcap, glassMatcap]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    }
  }, [tubeMatcap, glassMatcap]);
  useEffect(() => {
    // normal/roughness are DATA, not colour — NoColorSpace or the lighting
    // is subtly wrong in a way that reads as a bad material
    for (const [set, rpt] of [[matteMaps, 3], [leatherMaps, 2]] as const) {
      for (const t of Object.values(set)) {
        t.colorSpace = THREE.NoColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(rpt as number, 1);
        t.needsUpdate = true;
      }
    }
  }, [matteMaps, leatherMaps]);

  // materials are memoized per registry name and SHARED across every mesh
  // and clone that wears them — 20+ swappable parts per bottle makes
  // per-render reconstruction real cost (audit item C)
  // A material cache, deliberately a useMemo'd Map.
  //
  // useRef reads better for mutable storage and was tried first — it trades
  // one rule for another: react-hooks/refs forbids reading `.current` during
  // render, and build() is called from render, so the single immutability
  // error became 23 refs errors. The memo is the shape that fits; only the
  // write below needs an exemption.
  const matCache = useMemo(() => new Map<string, THREE.MeshPhysicalMaterial>(), []);
  const build = useCallback((gltf: { scene: THREE.Object3D }, name: string) => {
    const scene = gltf.scene.clone(true);
    let mat = matCache.get(name) ?? null;
    if (!mat) {
      const spec = mats ? getSpec(mats, name) : null;
      mat = createMaterial(spec, { metalEnv, plasticEnv,
                                   maps: { matte: matteMaps, leather: leatherMaps } });
      // populating a cache IS a mutation, and that is the point of a cache:
      // the alternative is rebuilding every material on every render.
      // eslint-disable-next-line react-hooks/immutability
      matCache.set(name, mat);
    }
    const uv = needsCylindricalUV(mats ? getSpec(mats, name) : null);
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (uv) ensureCylindricalUV(mesh);     // closure GLBs carry no UVs
      mesh.material = mat as THREE.Material;
    });
    return scene;
  }, [mats, matCache, metalEnv, plasticEnv, matteMaps, leatherMaps]);

  const parts = useMemo(() => {
    if (mode === "none" || !mats) return null;
    const g: THREE.Object3D[] = [];
    if (mode === "capped") {
      // cap straight on the neck — the "Bottle with Cap" SKUs. Leather
      // materials force their moulding; otherwise the moulding prop picks.
      const moulding = capMat.startsWith("LEATHER_") ? "leather" : capMoulding;
      const capGltf = moulding === "leather" ? capLeather
                    : moulding === "tall" ? capTall : cap;
      g.push(build(capGltf, capMat));
      if (capMat.startsWith("CAP_DOTS"))
        g.push(build(capDots, "PART_STUD_CHROME"));
      return g;
    }
    if (mode === "dropper") {
      // glass-pipette dropper: metal collar (trim), white rubber bulb,
      // pipette rendered via the tube matcap (glass-through-glass rule)
      g.push(build(drpCollar, trimMat), build(drpBulb, "PART_DRP_RUBBER"));
      const pip = build(drpPipette, "PART_DIPTUBE_PP");
      pip.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh)
          mesh.material = new THREE.MeshMatcapMaterial({
            matcap: glassMatcap, side: THREE.DoubleSide });
      });
      // the pipette reaches NEAR THE BASE of every bottle, like the dip
      // tube (Jordan: a mid-bottle pipette "is not going to work")
      pip.scale.y = Math.max(0.3, (neckY - 0.007) / 0.0532);
      g.push(pip);
      return g;
    }
    if (mode === "antique" || mode === "antiqueTassel") {
      // COMPOSED, not carved: the fitment is spec-built by closures.py
      // (ansp_collar_builder, the same COLLAR_18415 barrel the sprayer
      // wears) and the SCULPT supplies only the bulb + its ferrule.
      // Hand-editing the sculpt's own collar gave a double-height barrel
      // and a torn joint; this keeps the mechanical part in the pipeline
      // that already works and Jordan's shape where it belongs.
      g.push(build(anspCollar, trimMat));
      const bulb = anspBulb.scene.clone(true);
      bulb.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (!mesh.isMesh) return;
        const slot = (mesh.material as THREE.Material)?.name ?? "";
        if (slot === "SLOT_METAL") {
          // the ferrule wears the SAME approved metal as the fitment
          const donor = build(anspCollar, trimMat);
          let src: THREE.Material | null = null;
          donor.traverse((d) => {
            const dm = d as THREE.Mesh;
            if (!src && dm.isMesh) src = dm.material as THREE.Material;
          });
          if (src) mesh.material = src;
        } else {
          // knit bulb: the baked weave stays, the colourway tints it
          const fab = mats ? getSpec(mats, capMat) : null;
          if (fab) {
            const t = (mesh.material as THREE.MeshStandardMaterial).clone();
            t.color = new THREE.Color(fab.baseColorHex ?? "#ffffff");
            mesh.material = t;
          }
        }
      });
      g.push(bulb);
      // the works inside the bottle: the proven pump body + dip tube
      g.push(build(pumpBody, "PART_ACTUATOR_PP"));
      const at = build(dipTube, "PART_DIPTUBE_PP");   // roller: sits in the neck, not the body
      at.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (mesh.isMesh)
          mesh.material = new THREE.MeshMatcapMaterial({ matcap: tubeMatcap });
      });
      at.scale.y = Math.max(0.3, (neckY - 0.006) / 0.08);
      g.push(at);
      return g;
    }
    if (mode === "reducer" || mode === "reducerCapped") {
      // the pour-reducer seated in the neck; its cap goes over it
      g.push(build(reducer, "PART_ACTUATOR_PP"));
      if (mode === "reducerCapped") {
        const moulding = capMat.startsWith("LEATHER_") ? "leather" : capMoulding;
        g.push(build(moulding === "leather" ? capLeather
                   : moulding === "tall" ? capTall : cap, capMat));
        if (capMat.startsWith("CAP_DOTS"))
          g.push(build(capDots, "PART_STUD_CHROME"));
      }
      return g;
    }
    if (mode === "roller" || mode === "rollerCapped") {
      const metal = rollerVariant === "metal";
      g.push(
        build(metal ? housingSteel : housingPlastic, "PART_HOUSING_PP_NATURAL"),
        build(metal ? ballSteel : ballPlastic,
              metal ? "PART_BALL_STEEL" : "PART_BALL_PLASTIC"),
      );
      if (mode === "rollerCapped") {
        // *Dot caps = the normal shell in the colourway + the stud lattice
        // as a separate chrome part (BB_CAP_DOTS is STUDS ONLY — same
        // shell/jewel split as collar/actuator)
        g.push(build(cap, capMat));
        if (capMat.startsWith("CAP_DOTS"))
          g.push(build(capDots, capMat === "CAP_DOTS_SILVER"
                        ? "PART_STUD_CHROME_BRIGHT" : "PART_STUD_CHROME"));
      }
    } else {
      // material rule differs BY FINISH (PSD truth): 17-415 heads are
      // ALWAYS white PP over a trim collar; 18-415 is MONOCHROME — head
      // and collar both in trim, only the tiny nozzle insert is white
      const headMat = fin === "18415" ? trimMat : "PART_ACTUATOR_PP";
      g.push(build(collar, trimMat), build(actuator, headMat));
      if (fin === "18415") g.push(build(nozzle, "PART_ACTUATOR_PP"));
      // the INTERNAL pump mechanism the tube hangs from — visible
      // through the glass below the collar (professionals model the
      // interior; an unanchored tube reads fake)
      g.push(build(pumpBody, "PART_ACTUATOR_PP"));
      // DIP TUBE on every sprayer/pump — scaled from its nominal length
      // to reach near the bottle base (neckY = rim height in body space)
      if (!solidBody) {
        const tube = build(dipTube, "PART_DIPTUBE_PP");
        tube.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh)
            mesh.material = new THREE.MeshMatcapMaterial({ matcap: tubeMatcap });
        });
        const nominal = fin === "18415" ? 0.08 : 0.062;
        tube.scale.y = Math.max(0.3, (neckY - 0.006) / nominal);
        g.push(tube);
      }
      if (mode === "pump" || mode === "pumpCapped")
        g.push(build(spout, fin === "18415" ? trimMat : "PART_ACTUATOR_PP"));
      if (mode === "sprayerCapped" || mode === "pumpCapped")
        // 18-415 overcaps ship as a KIT in the trim colour (the tall cap
        // beside the bottle in the legacy listings); 17-415's is clear
        // 17-415's overcap ships CLEAR in the catalogue, and that is what this
        // was. Jordan, twice, on the render: "this cap is still not white...
        // it needs to be a solid white, and it's not." The part is FLUTED
        // (measured: 0.16 mm radius variation around the barrel), so a
        // transmissive material shows every rib as a bright/dark pair and the
        // cap reads as a bundle of lines rather than a cap. Opaque white PP
        // shades those same ribs as a soft gradient instead.
        // OPAQUE WHITE PP, and this is the settled answer. Frosted
        // (transmission 0.62) was tried to let the actuator's step read
        // through, and it brought the flute lines back with it — Jordan:
        // "we've lost the nice white cap... we have the lines again."
        // The step is not worth the lines. PART_OVERCAP_FROSTED is kept in
        // materials.json with its range documented, unused, in case the
        // trade is ever wanted the other way round.
        g.push(build(overcap, fin === "18415" ? trimMat : "PART_ACTUATOR_PP"));
    }
    return g;
  }, [mode, mats, build, housingSteel, housingPlastic, ballSteel, ballPlastic,
      cap, capTall, capLeather, capDots, collar, actuator, overcap, spout, dipTube, pumpBody, reducer, drpCollar, drpBulb, drpPipette, glassMatcap, anspCollar, anspBulb, anspTassel, nozzle, tubeMatcap, fin, neckY, solidBody,
      capMat, capMoulding, ballMat,
      rollerVariant, trimMat]);

  if (!parts) return null;
  return (
    <group position={[0, neckY, 0]}>
      {parts.map((p, i) => <primitive key={i} object={p} />)}
    </group>
  );
}

/* ------------------------------------------------------------------ body */

function Bottle({ url, preset, closure, capMat, ballMat, rollerVariant,
                  trimMat, finish, capMoulding, onHeight }: {
  url: string; preset: GlassPreset; closure: ClosureMode;
  capMat: string; ballMat: string; rollerVariant: "metal" | "plastic";
  trimMat: string; finish: "17-415" | "18-415";
  capMoulding?: CapMoulding;
  onHeight: (m: number) => void;
}) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const bakeId = url.split("/").pop()?.replace(".glb", "") ?? "";
  const thicknessTex = useTexture(
    preset.thicknessBake === false
      ? "/models/bodies-thickness/white-1x1.png"
      : `/models/bodies-thickness/${bakeId}.thickness.png`);
  // bodies that HAVE a baked frost mask (threads kept clear). Anything
  // else frosts uniformly via the white fallback — a missing .frost.png
  // must never 404-crash a family that sells frosted (Circle did).
  const hasFrostMask = bakeId === "Cyl-round-17-415-70x20";
  const frostTex = useTexture(
    preset.frostMask && hasFrostMask
      ? `/models/bodies-thickness/${bakeId}.frost.png`
      : "/models/bodies-thickness/white-1x1.png");
  useEffect(() => {
    for (const t of [thicknessTex, frostTex]) {
      t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
    }
  }, [thicknessTex, frostTex]);

  const glass = useMemo(() => {
    let g: THREE.Mesh | null = null;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && roleOf(m.name) === "bottle_glass" && !g) g = m;
    });
    if (g) (g as THREE.Mesh).visible = false;
    return g as THREE.Mesh | null;
  }, [scene]);

  const neckY = useMemo(() => {
    let y = 0;
    scene.traverse((o) => { if (o.name === "BB_ATTACH_NECK") y = o.position.y; });
    return y;
  }, [scene]);

  useEffect(() => {
    if (!glass) return;
    glass.geometry.computeBoundingBox();
    const s = new THREE.Vector3();
    (glass.geometry.boundingBox as THREE.Box3).getSize(s);
    onHeight(s.y);
  }, [glass, onHeight]);

  // thinWall finishes ship on the plain MeshPhysicalMaterial path (the
  // scraped Pacdora recipe); volume finishes use MeshTransmissionMaterial.
  // On the lite tier (coarse pointer / small screen) EVERY glass takes the
  // plain path — transmission is the expensive pipeline.
  const quality = useStageQuality();
  const usePlain = preset.thinWall || quality === "lite";
  useEffect(() => {
    if (!glass || !usePlain) return;
    // three.js objects are MUTABLE BY DESIGN and r3f hands them to you
    // through hooks; assigning to them is the documented way to drive a
    // scene. The React Compiler cannot know that, so the rule is disabled
    // at the site rather than the file — a real immutability bug elsewhere
    // in this component should still fail.
    // eslint-disable-next-line react-hooks/immutability
    glass.visible = true;
    const m = applyGlassPreset(glass, preset);
    if (preset.frostMask) { m.roughnessMap = frostTex; m.needsUpdate = true; }
    return () => { glass.visible = false; };
  }, [glass, preset, frostTex, usePlain]);

  return (
    <group>
      <primitive object={scene} />
      <Closure mode={closure} neckY={neckY} capMat={capMat} ballMat={ballMat}
               rollerVariant={rollerVariant} trimMat={trimMat} finish={finish}
               capMoulding={capMoulding} solidBody={preset.solidBody} />
      {glass && !usePlain ? (
        <mesh geometry={glass.geometry} position={glass.position}
              rotation={glass.rotation} scale={glass.scale}>
          <MeshTransmissionMaterial
            transmission={preset.transmission} thickness={preset.thickness}
            thicknessMap={preset.thicknessBake === false ? null : thicknessTex}
            roughnessMap={preset.frostMask ? frostTex : null}
            // backsideThickness is DELIBERATELY NOT preset.thickness.
            // thickness is now the WALL (0.0015 m); the backside pass is
            // light that crossed the whole BODY, so it needs the body-scale
            // path. Tying them together made the inner cavity wall render
            // almost clear and crisp — Jordan: "another bottle inside it...
            // a double bottle". Same physical quantity, two different paths.
            backside backsideThickness={preset.backsideThickness ?? preset.thickness}
            // backside at 256 aliased the thread helix into a crawling
            // shimmer during auto-rotate ("weird movement in the neck",
            // Jordan) — quality knobs, not look values
            samples={16} resolution={768} backsideResolution={512}
            roughness={preset.roughness} ior={preset.ior}
            chromaticAberration={preset.dispersion * 0.055}
            clearcoat={preset.clearcoat} clearcoatRoughness={preset.clearcoatRoughness}
            anisotropicBlur={preset.anisotropicBlur} distortion={preset.distortion}
            distortionScale={0.5} temporalDistortion={0}
            attenuationDistance={preset.attenuationDistance}
            attenuationColor={preset.attenuationColor}
            color="#ffffff" envMapIntensity={preset.envMapIntensity}
          />
        </mesh>
      ) : null}
    </group>
  );
}

/* -------------------------------------------------------------- entrance */

/** Entrance: the bottle is SET DOWN onto the stage — a decelerating spin
 *  while it eases from slightly above onto the floor, where the contact
 *  shadow catches it. Never rises from below (would clip the cove floor). */
function EntranceGroup({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group | null>(null);
  const t = useRef(0);
  const DURATION = 1.5;
  const DROP = 0.008;                              // 8 mm settle
  useFrame((_, delta) => {
    const g = ref.current;
    if (!g || t.current >= DURATION) return;
    t.current = Math.min(DURATION, t.current + delta);
    const x = t.current / DURATION;
    const e = 1 - Math.pow(1 - x, 3);              // easeOutCubic
    g.rotation.y = (1 - e) * -1.6;
    g.position.y = (1 - e) * DROP;
  });
  return <group ref={ref}>{children}</group>;
}

/* ---------------------------------------------------------------- viewer */

export default function Bottle3DViewer({
  bodyId = "Cyl-round-17-415-70x20",
  finish = "17-415" as const,
  capMoulding = "short" as const,
  glass = "amber", closure = "roller",
  capMat = "CAP_SHINY_BLACK", ballMat = "PART_BALL_STEEL",
  rollerVariant = "metal", trimMat = "CAP_SHINY_BLACK",
  backdrop = STAGE.backdrop, className,
}: {
  bodyId?: string; finish?: "17-415" | "18-415";
  capMoulding?: CapMoulding;
  glass?: GlassPresetId; closure?: ClosureMode;
  capMat?: string; ballMat?: string; rollerVariant?: "metal" | "plastic";
  trimMat?: string; backdrop?: string; className?: string;
}) {
  const preset = GLASS_PRESETS[glass];
  const [h, setH] = useState(0.07);
  // gentle showcase motion until the customer takes over
  const [touched, setTouched] = useState(false);
  const onHeight = useCallback((v: number) => setH(v), []);
  // SOLID vs HOLLOW is a look decision, so it lives in the preset.
  // A hollow body has a real inner surface, and once the glass actually
  // transmits you SEE it — Jordan: "another layer of the bottle inside the
  // bottle... customers are going to think this bottle is smaller than it
  // is." That last part is why this is not a taste call: the inner wall
  // misreports the product's capacity.
  const url = preset.solidBody
    ? `/models/bodies/${bodyId}.glb`
    : `/models/bodies-thickness/${bodyId}.glb`;

  return (
    <div className={className}
         style={{ position: "relative", width: "100%", aspectRatio: "10 / 11",
                  background: backdrop, borderRadius: 4, overflow: "hidden" }}>
      <ProductStage envRotationDeg={preset.envRotationDeg}
                    targetY={h * 0.62} ground
                    backdrop={backdrop}>
        <EntranceGroup>
          <Center disableY>
            <Bottle url={url} preset={preset} closure={closure}
                    capMat={capMat} ballMat={ballMat}
                    rollerVariant={rollerVariant} trimMat={trimMat}
                    finish={finish} capMoulding={capMoulding}
                    onHeight={onHeight} />
          </Center>
        </EntranceGroup>
        {/* rotate-only: tilt LOCKED (min == max polar), no pan — the
            floating bottle turns like a jewellery piece; target sits above
            the bottle's middle so it rides lower in the viewport */}
        {/* NO wheel zoom — wheel capture over a canvas this large made the
            whole page feel stuck when scrolling. The orbit RADIUS scales
            with the measured body height (min==max pins it), so an 87mm
            Elegant frames like the 70mm cylinder instead of filling the
            viewport — 3.15 x h reproduces the approved 9ml framing. */}
        <OrbitControls makeDefault target={[0, h * 0.62, 0]}
                       minDistance={Math.max(0.22, h * 3.15)}
                       maxDistance={Math.max(0.22, h * 3.15)}
                       enablePan={false} enableZoom={false}
                       minPolarAngle={Math.PI / 2.05} maxPolarAngle={Math.PI / 2.05}
                       autoRotate={!touched} autoRotateSpeed={0.9}
                       onStart={() => setTouched(true)} />
      </ProductStage>
      {/* gallery vignette — depth without touching the render */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
                    background: "radial-gradient(120% 90% at 50% 42%, transparent 55%, rgba(20,14,8,0.22) 100%)" }} />
    </div>
  );
}

useGLTF.preload("/models/bodies-thickness/Cyl-round-17-415-70x20.glb");
