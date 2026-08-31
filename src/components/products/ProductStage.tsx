"use client";

/**
 * ProductStage — THE scene wrapper. Premium lighting as one reusable unit.
 *
 * Everything about how a Best Bottles product is staged lives here — canvas
 * config, tone mapping, the off-frame room, the taupe sweep, contact
 * shadows, the approved studio environment and its per-colourway rotation,
 * and the quality tier — so the PDP viewer, future hero renderers, and any
 * new surface stage products identically. Product meshes render as children.
 *
 * Sources of truth: STUDIO_PRESETS/APPROVED_STUDIO for the environment,
 * STAGE for every stage-surface value (no inline PBR), materials.lock.json
 * for drift detection.
 */

import { Suspense, createContext, useContext, useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { STUDIO_PRESETS, APPROVED_STUDIO } from "@/lib/materials/studioPresets";

/** Stage-surface registry — the last inline PBR values, consolidated. */
export const STAGE = {
  backdrop: "#a29383",          // warm taupe vitrine (Jordan-approved stage)
  sweepRoughness: 0.85,
  /** only refracted rays that bend past the sweep ever see this */
  offFrameDim: 0.32,
  shadow: { color: "#3a3128", opacity: 0.42, blur: 2.4, scale: 0.35, far: 0.06 },
} as const;

/** Quality tier: "lite" (coarse pointers / small screens) drops the heavy
 *  transmission pipeline per the perf constraint — consumers read this via
 *  useStageQuality() and choose their material path. */
const QualityContext = createContext<"high" | "lite">("high");
export const useStageQuality = () => useContext(QualityContext);

function useQualityTier(): "high" | "lite" {
  const [tier, setTier] = useState<"high" | "lite">("high");
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const small = window.matchMedia("(max-width: 640px)");
    const decide = () => setTier(coarse.matches || small.matches ? "lite" : "high");
    decide();
    coarse.addEventListener("change", decide);
    small.addEventListener("change", decide);
    return () => {
      coarse.removeEventListener("change", decide);
      small.removeEventListener("change", decide);
    };
  }, []);
  return tier;
}

/** Each colourway is approved at its own studio rotation — the material
 *  without its context is half the look. */
function StudioContext({ rotationDeg }: { rotationDeg: number }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.environmentIntensity = 1;
    scene.environmentRotation = new THREE.Euler(0, (rotationDeg * Math.PI) / 180, 0);
  }, [scene, rotationDeg]);
  return null;
}

export default function ProductStage({
  envRotationDeg = 0,
  targetY = 0.035,
  backdrop = STAGE.backdrop,
  children,
}: {
  envRotationDeg?: number;
  targetY?: number;
  backdrop?: string;
  children: React.ReactNode;
}) {
  const studio = STUDIO_PRESETS[APPROVED_STUDIO];
  const tier = useQualityTier();
  const offFrame = useMemo(
    () => new THREE.Color(backdrop).multiplyScalar(STAGE.offFrameDim),
    [backdrop],
  );

  return (
    <QualityContext.Provider value={tier}>
      <Canvas camera={{ position: [0, targetY, 0.22], fov: 30, near: 0.01, far: 10 }}
              gl={{ antialias: true, toneMappingExposure: studio.toneMappingExposure }}
              dpr={tier === "lite" ? [1, 1.5] : [1, 2]}>
        <color attach="background" args={[offFrame]} />
        <Suspense fallback={null}>
          {children}
          <group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.0002, 0]}>
              <planeGeometry args={[1.2, 1.2]} />
              <meshStandardMaterial color={backdrop} roughness={STAGE.sweepRoughness} />
            </mesh>
            <ContactShadows opacity={STAGE.shadow.opacity} scale={STAGE.shadow.scale}
                            blur={STAGE.shadow.blur} far={STAGE.shadow.far}
                            resolution={tier === "lite" ? 512 : 1024}
                            color={STAGE.shadow.color} />
          </group>
          {studio.hdri ? <Environment files={studio.hdri} /> : null}
          <StudioContext rotationDeg={envRotationDeg} />
        </Suspense>
      </Canvas>
    </QualityContext.Provider>
  );
}
