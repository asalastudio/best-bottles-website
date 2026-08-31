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

import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls, Environment, useGLTF, useTexture, useEnvironment,
  MeshTransmissionMaterial, ContactShadows, Center,
} from "@react-three/drei";
import * as THREE from "three";
import {
  GLASS_PRESETS, applyGlassPreset, roleOf,
  type GlassPresetId, type GlassPreset,
} from "@/lib/materials/glassPresets";
import { STUDIO_PRESETS, APPROVED_STUDIO } from "@/lib/materials/studioPresets";

export type ClosureMode = "none" | "roller" | "rollerCapped";

type MatSpec = {
  color: string; roughness: number; metalness: number;
  clearcoat?: number; ior?: number; transmission?: number;
  envMapIntensity?: number; env?: string; maps?: string | null;
};

/* --------------------------------------------------------------- closure */

function Closure({ mode, neckY, capMat, ballMat }: {
  mode: ClosureMode; neckY: number; capMat: string; ballMat: string;
}) {
  const housing = useGLTF("/models/closures/BB_ROLL_HOUSING_17415_STEEL.glb");
  const ball = useGLTF("/models/closures/BB_ROLL_BALL_17415_STEEL.glb");
  const cap = useGLTF("/models/closures/BB_CAP_17415.glb");
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

  const build = useCallback((gltf: { scene: THREE.Object3D }, name: string) => {
    const scene = gltf.scene.clone(true);
    const m = mats?.[name];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
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
    });
    return scene;
  }, [mats, metalEnv, plasticEnv]);

  const parts = useMemo(() => {
    if (mode === "none" || !mats) return null;
    const g = [build(housing, "PART_HOUSING_PP_NATURAL"), build(ball, ballMat)];
    if (mode === "rollerCapped") g.push(build(cap, capMat));
    return g;
  }, [mode, mats, build, housing, ball, cap, capMat, ballMat]);

  if (!parts) return null;
  return (
    <group position={[0, neckY, 0]}>
      {parts.map((p, i) => <primitive key={i} object={p} />)}
    </group>
  );
}

/* ------------------------------------------------------------------ body */

function Bottle({ url, preset, closure, capMat, ballMat, onHeight }: {
  url: string; preset: GlassPreset; closure: ClosureMode;
  capMat: string; ballMat: string; onHeight: (m: number) => void;
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
  // scraped Pacdora recipe); volume finishes use MeshTransmissionMaterial
  useEffect(() => {
    if (!glass || !preset.thinWall) return;
    glass.visible = true;
    const m = applyGlassPreset(glass, preset);
    if (preset.frostMask) { m.roughnessMap = frostTex; m.needsUpdate = true; }
    return () => { glass.visible = false; };
  }, [glass, preset, frostTex]);

  return (
    <group>
      <primitive object={scene} />
      <Closure mode={closure} neckY={neckY} capMat={capMat} ballMat={ballMat} />
      {glass && !preset.thinWall ? (
        <mesh geometry={glass.geometry} position={glass.position}
              rotation={glass.rotation} scale={glass.scale}>
          <MeshTransmissionMaterial
            transmission={preset.transmission} thickness={preset.thickness}
            thicknessMap={preset.thicknessBake === false ? null : thicknessTex}
            roughnessMap={preset.frostMask ? frostTex : null}
            backside backsideThickness={preset.thickness}
            samples={16} resolution={1024} backsideResolution={512}
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

/* ---------------------------------------------------------------- viewer */

export default function Bottle3DViewer({
  bodyId = "Cyl-round-17-415-70x20",
  glass = "amber", closure = "roller",
  capMat = "CAP_SHINY_BLACK", ballMat = "PART_BALL_STEEL",
  backdrop = "#e9e6e0", className,
}: {
  bodyId?: string; glass?: GlassPresetId; closure?: ClosureMode;
  capMat?: string; ballMat?: string; backdrop?: string; className?: string;
}) {
  const preset = GLASS_PRESETS[glass];
  const studio = STUDIO_PRESETS[APPROVED_STUDIO];
  const [h, setH] = useState(0.07);
  const onHeight = useCallback((v: number) => setH(v), []);
  const url = `/models/bodies-thickness/${bodyId}.glb`;

  return (
    <div className={className}
         style={{ position: "relative", width: "100%", aspectRatio: "10 / 11",
                  background: backdrop, borderRadius: 4, overflow: "hidden" }}>
      <Canvas camera={{ position: [0, h / 2, 0.22], fov: 30, near: 0.01, far: 10 }}
              gl={{ antialias: true, toneMappingExposure: studio.toneMappingExposure }}
              dpr={[1, 2]}>
        <color attach="background" args={[new THREE.Color(backdrop).multiplyScalar(0.32)]} />
        <Suspense fallback={null}>
          <Center disableY>
            <Bottle url={url} preset={preset} closure={closure}
                    capMat={capMat} ballMat={ballMat} onHeight={onHeight} />
          </Center>
          <group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.0002, 0]}>
              <planeGeometry args={[1.2, 1.2]} />
              <meshStandardMaterial color={backdrop} roughness={0.85} />
            </mesh>
            <ContactShadows opacity={0.42} scale={0.35} blur={2.4}
                            far={0.06} resolution={1024} color="#3a3128" />
          </group>
          {studio.hdri ? <Environment files={studio.hdri} /> : null}
        </Suspense>
        <OrbitControls makeDefault target={[0, h / 2, 0]}
                       enablePan={false} minDistance={0.12} maxDistance={0.45}
                       minPolarAngle={Math.PI / 3.2} maxPolarAngle={Math.PI / 1.9}
                       autoRotate={false} />
      </Canvas>
      <div style={{ position: "absolute", bottom: 8, left: 0, right: 0,
                    textAlign: "center", fontSize: 11, letterSpacing: ".04em",
                    color: "#8a8378", pointerEvents: "none" }}>
        drag to rotate
      </div>
    </div>
  );
}

useGLTF.preload("/models/bodies-thickness/Cyl-round-17-415-70x20.glb");
