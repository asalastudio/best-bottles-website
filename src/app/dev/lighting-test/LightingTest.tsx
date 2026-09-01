"use client";

/**
 * /dev/lighting-test — the acceptance scene for the single hybrid studio
 * environment (StudioEnvironment.tsx, preset "hybrid-small08").
 *
 * Five objects in a row under the ONE shared environment, orbitable:
 *   gold cap · silver cap · clear bottle · amber bottle · cobalt bottle
 * (real production GLBs: the 17-415 cap and the 9 ml cylinder body).
 *
 * PASS CRITERIA — all five simultaneously, while orbiting:
 *   1. silver reads white-silver, no warm cast
 *   2. gold reads yellow-gold, not muddy brown
 *   3. neither metal shows large dead-black patches at any angle
 *   4. amber glows amber / cobalt glows blue against the backlight —
 *      neither reads near-black
 *   5. clear glass shows two clean vertical edge highlights and a bright
 *      shoulder rim without a blown-out neck
 *
 * Founder approval of this scene is the gate for shipping the environment
 * (flipping APPROVED_STUDIO). Materials here are built ONLY from material
 * recipes — Convex rows when reachable, seed fallback otherwise — with no
 * per-material envMap overrides, so what is judged is exactly the
 * one-environment architecture.
 */

import { useEffect, useMemo, useState } from "react";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import ProductStage from "@/components/products/ProductStage";
import { STUDIO_PRESETS } from "@/lib/materials/studioPresets";
import { roleOf } from "@/lib/materials/glassPresets";
import {
  RECIPE_SEEDS_BY_KEY, type MaterialRecipe,
} from "@/lib/materials/materialRecipes";

const CAP_GLB = "/models/closures/BB_CAP_17415.glb";
const BODY_GLB = "/models/bodies-thickness/Cyl-round-17-415-70x20.glb";

/** ONE MeshPhysicalMaterial per recipe — no envMap override, so every
 *  finish samples the single scene environment. Opaque pipeline like the
 *  proven thin-wall path. FRONT faces only: rendering the hollow shell's
 *  inner wall reads as a second bottle inside the bottle (Jordan) — without
 *  the production thickness bake, the body must render as ONE solid piece. */
function materialFrom(r: MaterialRecipe): THREE.MeshPhysicalMaterial {
  const glass = (r.transmission ?? 0) > 0;
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(r.color),
    metalness: r.metalness,
    roughness: r.roughness,
    ior: r.ior ?? 1.5,
    transmission: r.transmission ?? 0,
    envMapIntensity: r.envMapIntensity,
    transparent: false,
    side: THREE.FrontSide,
  });
  if (glass) {
    m.thickness = r.thickness ?? 0.002;
    if (r.attenuationColor) m.attenuationColor = new THREE.Color(r.attenuationColor);
    if (r.attenuationDistance) m.attenuationDistance = r.attenuationDistance;
  }
  return m;
}

function CapItem({ recipe, x }: { recipe: MaterialRecipe; x: number }) {
  const gltf = useGLTF(CAP_GLB);
  const material = useMemo(() => materialFrom(recipe), [recipe]);
  // caps origin at the NECK RIM (closures contract) — lift so the skirt
  // rests on the floor instead of hanging through it
  const { scene, lift } = useMemo(() => {
    const s = gltf.scene.clone(true);
    s.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.material = material;
    });
    const box = new THREE.Box3().setFromObject(s);
    return { scene: s, lift: -box.min.y };
  }, [gltf.scene, material]);
  return (
    <group position={[x, lift, 0]}>
      <primitive object={scene} />
    </group>
  );
}

function BottleItem({ recipe, x }: { recipe: MaterialRecipe; x: number }) {
  const gltf = useGLTF(BODY_GLB);
  const material = useMemo(() => materialFrom(recipe), [recipe]);
  const glass = useMemo(() => {
    let g: THREE.Mesh | null = null;
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && roleOf(m.name) === "bottle_glass" && !g) g = m;
    });
    return g as THREE.Mesh | null;
  }, [gltf.scene]);
  if (!glass) return null;
  // body GLBs are authored floor-origined (base at y = 0) — render in place
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={glass.geometry} material={material}
            position={glass.position} rotation={glass.rotation}
            scale={glass.scale} />
    </group>
  );
}

/** left→right: gold cap, silver cap, clear, amber, cobalt (handoff order) */
const ROW: { finishKey: string; kind: "cap" | "bottle" }[] = [
  { finishKey: "gold-cap", kind: "cap" },
  { finishKey: "silver-cap", kind: "cap" },
  { finishKey: "clear-glass", kind: "bottle" },
  { finishKey: "amber-glass", kind: "bottle" },
  { finishKey: "cobalt-glass", kind: "bottle" },
];
const SPACING = 0.034; // m between centres — bottles are 20 mm wide

const CRITERIA = [
  "Silver reads white-silver — no warm/colour cast",
  "Gold reads yellow-gold, not muddy brown",
  "No large dead-black patches on either metal at any orbit angle",
  "Amber glows amber, cobalt glows blue — neither near-black",
  "Clear: two clean vertical edge highlights + bright shoulder rim, neck not blown out",
];

export default function LightingTest() {
  // seeds render immediately; Convex rows (founder-tuned values) replace
  // them when the deployment has the materialRecipes module + data
  const [recipes, setRecipes] =
    useState<Record<string, MaterialRecipe>>(RECIPE_SEEDS_BY_KEY);
  const [source, setSource] = useState<"seed fallback" | "Convex">("seed fallback");
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) return;
    const client = new ConvexHttpClient(url);
    const listRef =
      makeFunctionReference<"query", Record<string, never>, MaterialRecipe[]>(
        "materialRecipes:list");
    let dead = false;
    client.query(listRef, {})
      .then((rows) => {
        if (dead || !rows?.length) return;
        setRecipes((prev) => ({
          ...prev,
          ...Object.fromEntries(rows.map((r) => [r.finishKey, r])),
        }));
        setSource("Convex");
      })
      .catch(() => { /* table/module not deployed yet — seeds stand */ });
    return () => { dead = true; };
  }, []);

  // glass TRANSMITS what is behind it — judge on the preset's light
  // backdrop (the lab lesson: a dark viewport makes correct amber read
  // near-black), standing on the cove like the production stage
  const backdrop = STUDIO_PRESETS["hybrid-small08"].backdrop;

  return (
    <div style={{ position: "relative", width: "100%", height: "100dvh",
                  background: "#101014" }}>
      <ProductStage studio="hybrid-small08" backdrop={backdrop} fov={30}
                    targetY={0.035} cameraZ={0.36}>
        {ROW.map(({ finishKey, kind }, i) => {
          const recipe = recipes[finishKey];
          if (!recipe) return null;
          const x = (i - (ROW.length - 1) / 2) * SPACING;
          return kind === "cap"
            ? <CapItem key={finishKey} recipe={recipe} x={x} />
            : <BottleItem key={finishKey} recipe={recipe} x={x} />;
        })}
        <OrbitControls makeDefault target={[0, 0.035, 0]}
                       minDistance={0.08} maxDistance={1.2}
                       enablePan enableZoom />
      </ProductStage>

      <div style={{ position: "absolute", top: 12, left: 12, width: 320,
                    padding: "10px 12px", borderRadius: 6,
                    background: "rgba(16,16,20,0.82)", color: "#e8e8ea",
                    border: "1px solid #33333c", fontSize: 11,
                    lineHeight: 1.5, pointerEvents: "none" }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
          Lighting acceptance — hybrid studio (Small 08 + formers)
        </div>
        <div style={{ opacity: 0.85 }}>
          gold cap · silver cap · clear · amber · cobalt
          &nbsp;—&nbsp; recipes: <b>{source}</b>
        </div>
        <ol style={{ margin: "6px 0 0", paddingLeft: 16 }}>
          {CRITERIA.map((c) => <li key={c}>{c}</li>)}
        </ol>
        <div style={{ marginTop: 6, opacity: 0.65 }}>
          drag = orbit · wheel = zoom · pass = all five while orbiting
        </div>
      </div>
    </div>
  );
}

useGLTF.preload(CAP_GLB);
useGLTF.preload(BODY_GLB);
