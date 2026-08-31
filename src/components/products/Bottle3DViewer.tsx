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
import * as THREE from "three";
import {
  GLASS_PRESETS, applyGlassPreset, roleOf,
  type GlassPresetId, type GlassPreset,
} from "@/lib/materials/glassPresets";

export type ClosureMode =
  | "none" | "roller" | "rollerCapped"
  | "sprayer" | "sprayerCapped" | "pump" | "pumpCapped";

type MatSpec = {
  color: string; roughness: number; metalness: number;
  clearcoat?: number; ior?: number; transmission?: number;
  envMapIntensity?: number; env?: string; maps?: string | null;
};

/* --------------------------------------------------------------- closure */

function Closure({ mode, neckY, capMat, ballMat, rollerVariant, trimMat }: {
  mode: ClosureMode; neckY: number; capMat: string; ballMat: string;
  /** metal (MtlRoll SKUs) or plastic (Roll SKUs) roll-on hardware */
  rollerVariant: "metal" | "plastic";
  /** spray/pump collar+actuator colour (SKU-derived: Blk/Gl/MattSl/ShSl/Tur/Rd) */
  trimMat: string;
}) {
  const housingSteel = useGLTF("/models/closures/BB_ROLL_HOUSING_17415_STEEL.glb");
  const housingPlastic = useGLTF("/models/closures/BB_ROLL_HOUSING_17415_PLASTIC.glb");
  const ballSteel = useGLTF("/models/closures/BB_ROLL_BALL_17415_STEEL.glb");
  const ballPlastic = useGLTF("/models/closures/BB_ROLL_BALL_17415_PLASTIC.glb");
  const cap = useGLTF("/models/closures/BB_CAP_17415.glb");
  const capDots = useGLTF("/models/closures/BB_CAP_DOTS_17415.glb");
  // fine-mist sprayer + lotion pump (Spry17-415 / Ltn17-415): every part
  // origins at the neck rim per the closures manifest — zero transforms
  const collar = useGLTF("/models/closures/BB_SPR_COLLAR_17415.glb");
  const actuator = useGLTF("/models/closures/BB_SPR_ACTUATOR_17415.glb");
  const overcap = useGLTF("/models/closures/BB_SPR_OVERCAP_17415.glb");
  const spout = useGLTF("/models/closures/BB_PMP_SPOUT_17415.glb");
  const [mats, setMats] = useState<Record<string, MatSpec> | null>(null);
  useEffect(() => {
    let dead = false;
    fetch("/models/materials.json").then((r) => r.json())
      .then((j) => { if (!dead) setMats(j.materials); }).catch(() => {});
    return () => { dead = true; };
  }, []);

  // three material classes, three environments — see the glass-material-lab
  // skill: glass mirrors the room, plastics the tent, metals the studio
  const metalEnv = useEnvironment({ files: "/models/studio-universal.hdr" });
  const plasticEnv = useEnvironment({ files: "/models/studio-browser.hdr" });

  // materials are memoized per registry name and SHARED across every mesh
  // and clone that wears them — 20+ swappable parts per bottle makes
  // per-render reconstruction real cost (audit item C)
  const matCache = useMemo(() => new Map<string, THREE.MeshPhysicalMaterial>(), []);
  const build = useCallback((gltf: { scene: THREE.Object3D }, name: string) => {
    const scene = gltf.scene.clone(true);
    const m = mats?.[name];
    const cached = matCache.get(name);
    if (cached) {
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.material = cached;
      });
      return scene;
    }
    let firstMat: THREE.MeshPhysicalMaterial | null = null;
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (firstMat) { mesh.material = firstMat; return; }
      const mat = new THREE.MeshPhysicalMaterial(m ? {
        color: new THREE.Color(m.color), roughness: m.roughness,
        metalness: m.metalness, clearcoat: m.clearcoat ?? 0,
        ior: m.ior ?? 1.5, transmission: m.transmission ?? 0,
      } : { color: 0x999999, roughness: 0.4, metalness: 0.4 });
      if ((m?.transmission ?? 0) > 0) mat.thickness = 0.002;
      const glossy = (m?.metalness ?? 0) >= 0.85 || (m?.roughness ?? 1) <= 0.3;
      mat.envMap = m?.env === "tent" ? plasticEnv
                 : m?.env === "metal" ? metalEnv
                 : glossy ? metalEnv : plasticEnv;
      mat.envMapIntensity = m?.envMapIntensity ?? (glossy ? 1.15 : 0.9);
      mesh.material = mat;
      firstMat = mat;
      matCache.set(name, mat);
    });
    return scene;
  }, [mats, matCache, metalEnv, plasticEnv]);

  const parts = useMemo(() => {
    if (mode === "none" || !mats) return null;
    const g: THREE.Object3D[] = [];
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
          g.push(build(capDots, "PART_STUD_CHROME"));
      }
    } else {
      // the actuator is ALWAYS white PP; only the collar wears the trim
      // colour (PSD reference, all six colourways)
      g.push(build(collar, trimMat), build(actuator, "PART_ACTUATOR_PP"));
      if (mode === "pump" || mode === "pumpCapped")
        g.push(build(spout, "PART_ACTUATOR_PP"));
      if (mode === "sprayerCapped" || mode === "pumpCapped")
        g.push(build(overcap, "PART_OVERCAP_CLEAR"));
    }
    return g;
  }, [mode, mats, build, housingSteel, housingPlastic, ballSteel, ballPlastic,
      cap, capDots, collar, actuator, overcap, spout, capMat, ballMat,
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
                  trimMat, onHeight }: {
  url: string; preset: GlassPreset; closure: ClosureMode;
  capMat: string; ballMat: string; rollerVariant: "metal" | "plastic";
  trimMat: string; onHeight: (m: number) => void;
}) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const bakeId = url.split("/").pop()?.replace(".glb", "") ?? "";
  const thicknessTex = useTexture(
    preset.thicknessBake === false
      ? "/models/bodies-thickness/white-1x1.png"
      : `/models/bodies-thickness/${bakeId}.thickness.png`);
  const frostTex = useTexture(
    preset.frostMask
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
    glass.visible = true;
    const m = applyGlassPreset(glass, preset);
    if (preset.frostMask) { m.roughnessMap = frostTex; m.needsUpdate = true; }
    return () => { glass.visible = false; };
  }, [glass, preset, frostTex, usePlain]);

  return (
    <group>
      <primitive object={scene} />
      <Closure mode={closure} neckY={neckY} capMat={capMat} ballMat={ballMat}
               rollerVariant={rollerVariant} trimMat={trimMat} />
      {glass && !usePlain ? (
        <mesh geometry={glass.geometry} position={glass.position}
              rotation={glass.rotation} scale={glass.scale}>
          <MeshTransmissionMaterial
            transmission={preset.transmission} thickness={preset.thickness}
            thicknessMap={preset.thicknessBake === false ? null : thicknessTex}
            roughnessMap={preset.frostMask ? frostTex : null}
            backside backsideThickness={preset.thickness}
            samples={16} resolution={512} backsideResolution={256}
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
  glass = "amber", closure = "roller",
  capMat = "CAP_SHINY_BLACK", ballMat = "PART_BALL_STEEL",
  rollerVariant = "metal", trimMat = "CAP_SHINY_BLACK",
  backdrop = STAGE.backdrop, className,
}: {
  bodyId?: string; glass?: GlassPresetId; closure?: ClosureMode;
  capMat?: string; ballMat?: string; rollerVariant?: "metal" | "plastic";
  trimMat?: string; backdrop?: string; className?: string;
}) {
  const preset = GLASS_PRESETS[glass];
  const [h, setH] = useState(0.07);
  // gentle showcase motion until the customer takes over
  const [touched, setTouched] = useState(false);
  const onHeight = useCallback((v: number) => setH(v), []);
  const url = `/models/bodies-thickness/${bodyId}.glb`;

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
                    onHeight={onHeight} />
          </Center>
        </EntranceGroup>
        {/* rotate-only: tilt LOCKED (min == max polar), no pan — the
            floating bottle turns like a jewellery piece; target sits above
            the bottle's middle so it rides lower in the viewport */}
        {/* NO wheel zoom — wheel capture over a canvas this large made the
            whole page feel stuck when scrolling */}
        <OrbitControls makeDefault target={[0, h * 0.62, 0]}
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
