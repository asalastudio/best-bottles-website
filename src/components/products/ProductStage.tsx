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
import { STUDIO_PRESETS, APPROVED_STUDIO, type StudioPresetId } from "@/lib/materials/studioPresets";
import { StudioEnvironment } from "./StudioEnvironment";
import { GL_COLOR_SETTINGS } from "@/lib/materials/colorManagement";

/** The contact shadow under a product. Named so a surface can weigh it
 *  differently without re-declaring what a shadow is. */
export type StageShadow = { color: string; opacity: number; blur: number; scale: number; far: number };

/** Stage-surface registry — the last inline PBR values, consolidated. */
export const STAGE = {
  backdrop: "#a29383",          // warm taupe vitrine (Jordan-approved stage)
  sweepRoughness: 0.85,
  /** how strongly the sweep answers the studio. The hybrid studio's strip/
   *  overhead emitters pooled on the semi-matte cove as a WHITE HALO hugging
   *  the bottle (Jordan: "very bad") — the stage is scenery, so it takes the
   *  same single environment at a fraction of the intensity and stays an
   *  even ground for the product to pop from. */
  sweepEnvIntensity: 0.35,
  /** only refracted rays that bend past the sweep ever see this */
  offFrameDim: 0.32,
  shadow: { color: "#3a3128", opacity: 0.42, blur: 2.4, scale: 0.35, far: 0.06 } as StageShadow,
  /** Aesop-photo cove: floor radius, fillet radius, wall height (m) */
  cove: { radius: 0.55, fillet: 0.14, wall: 0.7 },
} as const;

/** Infinity-cove sweep — the floor curves up into the backdrop with no
 *  horizon line, like the seamless paper behind an Aesop packshot. One
 *  lathe: flat floor -> quarter-round fillet -> vertical wall, viewed from
 *  inside (BackSide). The studio HDRI's overhead punch lights the floor
 *  and lets the wall fall off naturally toward the top. */
function CoveSweep({ backdrop, envIntensity }: { backdrop: string; envIntensity: number }) {
  const geometry = useMemo(() => {
    const { radius, fillet, wall } = STAGE.cove;
    const pts: THREE.Vector2[] = [new THREE.Vector2(0.001, 0)];
    pts.push(new THREE.Vector2(radius - fillet, 0));
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * (Math.PI / 2);
      pts.push(new THREE.Vector2(
        radius - fillet + fillet * Math.sin(a),
        fillet - fillet * Math.cos(a),
      ));
    }
    pts.push(new THREE.Vector2(radius, wall));
    return new THREE.LatheGeometry(pts, 72);
  }, []);
  return (
    <mesh geometry={geometry} position={[0, -0.0004, 0]}>
      <meshStandardMaterial color={backdrop} roughness={STAGE.sweepRoughness}
                            envMapIntensity={envIntensity}
                            side={THREE.BackSide} />
    </mesh>
  );
}

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
    /* eslint-disable react-hooks/immutability -- R3F's scene is imperative; <Environment> sets these the same way */
    scene.environmentIntensity = 1;
    scene.environmentRotation = new THREE.Euler(0, (rotationDeg * Math.PI) / 180, 0);
    /* eslint-enable react-hooks/immutability */
  }, [scene, rotationDeg]);
  return null;
}

export default function ProductStage({
  envRotationDeg = 0,
  targetY = 0.035,
  backdrop = STAGE.backdrop,
  ground = true,
  studio: studioId = APPROVED_STUDIO,
  cameraZ = 0.22,
  shadow,
  sweep,
  children,
}: {
  envRotationDeg?: number;
  targetY?: number;
  backdrop?: string;
  /** false = the floating presentation: no sweep, no contact shadow */
  ground?: boolean;
  /** override the stage's contact shadow. STAGE.shadow is the approved
   *  packshot value; a lighter ground wants a different weight under the
   *  glass, and that is a look decision, not a new shadow system. */
  shadow?: Partial<StageShadow>;
  /** How brightly the cove answers the studio, and how far the off-frame
   *  surround is dimmed below it. STAGE's values were approved against the
   *  taupe vitrine; a pale ground rendered at them comes out grey, because
   *  0.35 env intensity under ACES is most of a stop down. A surface that
   *  wants its ground to READ as the colour it passed says so here. */
  sweep?: { envIntensity?: number; dim?: number };
  /** dev/lab surfaces may stage a CANDIDATE studio; production always
   *  renders APPROVED_STUDIO (flipped only on Jordan's approval) */
  studio?: StudioPresetId;
  cameraZ?: number;
  children: React.ReactNode;
}) {
  const studio = STUDIO_PRESETS[studioId];
  const tier = useQualityTier();
  const shade = { ...STAGE.shadow, ...shadow };
  const sweepEnv = sweep?.envIntensity ?? STAGE.sweepEnvIntensity;
  const sweepDim = sweep?.dim ?? STAGE.offFrameDim;
  const offFrame = useMemo(
    () => new THREE.Color(backdrop).multiplyScalar(sweepDim),
    [backdrop, sweepDim],
  );

  return (
    <QualityContext.Provider value={tier}>
      <Canvas camera={{ position: [0, targetY, cameraZ], fov: 30, near: 0.01, far: 10 }}
              // colour pipeline is PINNED, never inherited from a
              // library default — see colorManagement.ts
              gl={{ antialias: true, ...GL_COLOR_SETTINGS }}
              dpr={tier === "lite" ? [1, 1.5] : [1, 2]}
              onCreated={(state) => {
                if (process.env.NODE_ENV !== "production")
                  (window as unknown as Record<string, unknown>).__stage = state;
              }}>
        <color attach="background" args={[offFrame]} />
        <Suspense fallback={null}>
          {children}
          {ground ? (
            <group>
              <CoveSweep backdrop={backdrop} envIntensity={sweepEnv} />
              <ContactShadows opacity={shade.opacity} scale={shade.scale}
                              blur={shade.blur} far={shade.far}
                              resolution={tier === "lite" ? 512 : 1024}
                              color={shade.color} />
            </group>
          ) : null}
          {/* ONE environment, mounted once for the whole scene. A hybrid
              preset renders its HDRI + Lightformers into a single cubemap. */}
          {studio.hybrid ? <StudioEnvironment />
            : studio.hdri ? <Environment files={studio.hdri} /> : null}
          <StudioContext rotationDeg={envRotationDeg} />
        </Suspense>
      </Canvas>
    </QualityContext.Provider>
  );
}
