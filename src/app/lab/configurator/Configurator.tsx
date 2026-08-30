"use client";

/**
 * A throwaway product page for the 17-415 family.
 *
 * Deliberately NOT wired to the real Best Bottles PDP: this exists to see how
 * the 3D behaves in a product layout — swatches, shape switching, closures —
 * without any risk to the storefront. Every asset here is the same GLB the
 * pipeline ships, and every material is assigned in-browser by mesh name, so
 * what you see is what the real configurator would render.
 *
 * The 17-415 family is the one worth prototyping on: it has all three body
 * shapes including the swirl, and the only closure set that is complete.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Lightformer,
  Center,
  useGLTF,
  ContactShadows,
} from "@react-three/drei";
import * as THREE from "three";

type Body = {
  bodyId: string; family: string; heightMm: number;
  diameterMm: number | null; skuCount: number; representativeSku: string;
  url: string;
};
type ClosurePart = {
  file: string; mesh: string; finish: string; part: string; variant: string | null;
};
type ClosureManifest = {
  parts: ClosurePart[];
  assemblies: { finish: string; kind: string; stack: string[] }[];
};

/* ------------------------------------------------------------------ glass */

const GLASS = {
  clear:   { label: "Clear",   swatch: "#dfe7ea",
             roughness: 0.03, transmission: 1.0, thickness: 0.012, ior: 1.52,
             atten: 0.42, attenColor: "#eef6f2", dispersion: 1.4 },
  frosted: { label: "Frosted", swatch: "#e8eae9",
             roughness: 0.55, transmission: 0.98, thickness: 0.010, ior: 1.50,
             atten: 0.28, attenColor: "#f4f6f5", dispersion: 0.5 },
  amber:   { label: "Amber",   swatch: "#a8571a",
             roughness: 0.04, transmission: 1.0, thickness: 0.014, ior: 1.52,
             atten: 0.030, attenColor: "#a8571a", dispersion: 1.2 },
  cobalt:  { label: "Cobalt",  swatch: "#123f9e",
             roughness: 0.04, transmission: 1.0, thickness: 0.014, ior: 1.52,
             atten: 0.026, attenColor: "#123f9e", dispersion: 1.2 },
  green:   { label: "Green",   swatch: "#1f6b3a",
             roughness: 0.04, transmission: 1.0, thickness: 0.014, ior: 1.52,
             atten: 0.028, attenColor: "#1f6b3a", dispersion: 1.2 },
} as const;
type GlassKey = keyof typeof GLASS;

/* --------------------------------------------------------------- closures */
// Colours MEASURED from the isolated cap layers in
// "20. Closures .../12. 17-415 Roll on" — the ten PSDs are the ten swatches
// the live site shows. `plated` marks vacuum-metallized finishes; the rest are
// pigmented phenolic, which is a DIELECTRIC and must not be metalness 1.
const FINISHES = {
  "shiny-silver": { label: "Shiny silver", color: "#828282", plated: true,  rough: 0.10 },
  "matte-silver": { label: "Matte silver", color: "#c0c0c0", plated: true,  rough: 0.48 },
  "shiny-gold":   { label: "Shiny gold",   color: "#9b9062", plated: true,  rough: 0.13 },
  "matte-gold":   { label: "Matte gold",   color: "#c5b375", plated: true,  rough: 0.44 },
  copper:         { label: "Copper",       color: "#975a42", plated: true,  rough: 0.28 },
  "shiny-black":  { label: "Shiny black",  color: "#292929", plated: false, rough: 0.09 },
  white:          { label: "White",        color: "#f1f1f1", plated: false, rough: 0.42 },
} as const;
type FinishKey = keyof typeof FINISHES;

function isShell(mesh: string) {
  if (mesh.includes("CAP_DOTS")) return false;   // studs stay silver always
  return mesh.includes("CAP_") || mesh.includes("SPR_COLLAR");
}

function partMaterial(mesh: string, finish: FinishKey) {
  const plastic = (color: string, roughness: number) =>
    new THREE.MeshStandardMaterial({ color, metalness: 0, roughness });
  if (isShell(mesh)) {
    const f = FINISHES[finish];
    const brushed = f.plated && f.rough > 0.35;
    return new THREE.MeshPhysicalMaterial({
      color: f.color,
      metalness: f.plated ? 1 : 0,
      roughness: f.rough,
      clearcoat: f.plated ? 0.35 : 0.9,
      clearcoatRoughness: f.plated ? 0.1 : 0.06,
      anisotropy: brushed ? 0.65 : 0,
      anisotropyRotation: Math.PI / 2,
      envMapIntensity: 1.35,
    });
  }
  if (mesh.includes("CAP_DOTS"))
    return new THREE.MeshPhysicalMaterial({
      color: "#d9dcdf", metalness: 1, roughness: 0.1, clearcoat: 0.4 });
  if (mesh.includes("ROLL_BALL"))
    return mesh.includes("STEEL")
      ? new THREE.MeshStandardMaterial({ color: "#cfd2d6", metalness: 1, roughness: 0.18 })
      : plastic("#eeece4", 0.45);
  if (mesh.includes("ROLL_HOUSING")) return plastic("#e8e6dd", 0.4);
  if (mesh.includes("SPR_ACTUATOR") || mesh.includes("PMP_SPOUT"))
    return plastic("#f4f4f2", 0.38);
  if (mesh.includes("SPR_OVERCAP"))
    return new THREE.MeshPhysicalMaterial({
      color: "#ffffff", roughness: 0.12, metalness: 0, transmission: 0.94,
      thickness: 0.0006, ior: 1.49 });
  return plastic("#cccccc", 0.4);
}

/* ----------------------------------------------------------------- scene */

function Bottle({ url, glass, onAttach }: {
  url: string; glass: GlassKey; onAttach: (y: number | null) => void;
}) {
  const gltf = useGLTF(url);
  const root = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const { geometry, attachY } = useMemo(() => {
    let geometry: THREE.BufferGeometry | null = null;
    let attachY: number | null = null;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !geometry) geometry = m.geometry;
      // Y-up: the glTF is exported Y-up, so a datum's height is .y.
      if (o.name === "BB_ATTACH_NECK") attachY = o.position.y;
    });
    return { geometry, attachY };
  }, [root]);

  useEffect(() => { onAttach(attachY); }, [attachY, onAttach]);

  const g = GLASS[glass];
  if (!geometry) return null;
  return (
    <mesh geometry={geometry as THREE.BufferGeometry}>
      <meshPhysicalMaterial
        color="#ffffff"
        roughness={g.roughness}
        metalness={0}
        transmission={g.transmission}
        thickness={g.thickness}
        ior={g.ior}
        attenuationDistance={g.atten}
        attenuationColor={new THREE.Color(g.attenColor)}
        dispersion={g.dispersion}
        transparent
        side={THREE.DoubleSide}
        envMapIntensity={1.5}
      />
    </mesh>
  );
}

function Part({ file, mesh, y, finish }: {
  file: string; mesh: string; y: number; finish: FinishKey;
}) {
  const gltf = useGLTF(`/models/closures/${file}`);
  const root = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  useEffect(() => {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = partMaterial(mesh, finish);
    });
  }, [root, mesh, finish]);
  return <primitive object={root} position={[0, y, 0]} />;
}

/**
 * The Best Bottles bone cyc, matching build-master-scene.build_sweep():
 * flat floor -> radius -> vertical wall, no horizon line.
 *
 * BONE_HEX #B29878 is the house colour (Jordan, 2026-08-08), and it replaced a
 * paler #EFE9DE specifically because a MIDTONE reads glass better — which is
 * exactly the problem we have been fighting. Clear glass against white has no
 * contrast to refract and goes invisible; against near-black it goes smoky. A
 * warm midtone gives it something with tone to bend, and it is what the render
 * pipeline already shoots against, so the browser matches the stills.
 */
const BONE = "#B29878";

function BoneSweep() {
  const geometry = useMemo(() => {
    // metres — the scene is metres, the same contract the GLBs are built to
    const FLOOR_BACK = 0.10, RADIUS = 0.13, WALL_TOP = 0.5, WIDTH = 1.3;
    const FLOOR_FRONT = -0.45;
    const prof: [number, number][] = [[FLOOR_FRONT, 0], [FLOOR_BACK, 0]];
    for (let i = 1; i <= 24; i++) {
      const a = (Math.PI / 2) * (i / 24);
      prof.push([FLOOR_BACK + RADIUS * Math.sin(a), RADIUS * (1 - Math.cos(a))]);
    }
    prof.push([FLOOR_BACK + RADIUS, WALL_TOP]);

    const pos: number[] = [];
    const idx: number[] = [];
    prof.forEach(([z, y]) => {
      pos.push(-WIDTH / 2, y, -z);
      pos.push(WIDTH / 2, y, -z);
    });
    for (let i = 0; i < prof.length - 1; i++) {
      const a = 2 * i;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geometry} position={[0, -0.045, 0]} receiveShadow>
      {/* Slightly darker than the flat BONE so the sweep reads as a lit
          surface with falloff rather than a flood of one colour — and so the
          glass has a tonal RANGE to refract, not a single value. */}
      <meshStandardMaterial color="#9d8368" roughness={0.95} metalness={0} />
    </mesh>
  );
}

function Studio() {
  return (
    <Environment resolution={1024}>
      <Lightformer form="rect" intensity={8} position={[0, 1.6, 0.9]}
                   rotation={[-Math.PI / 3, 0, 0]} scale={[3.5, 2.6, 1]} />
      <Lightformer form="rect" intensity={3.4} color="#eef2f6"
                   position={[-1.9, 0.5, 0.5]} rotation={[0, Math.PI / 2.4, 0]}
                   scale={[2.2, 3.2, 1]} />
      <Lightformer form="rect" intensity={2.6} color="#f6f2ee"
                   position={[1.9, 0.4, 0.4]} rotation={[0, -Math.PI / 2.4, 0]}
                   scale={[2, 3, 1]} />
      {/* the rim pair — the bright outline that says "this is transparent" */}
      <Lightformer form="rect" intensity={30} position={[-1.1, 0.7, -1.5]}
                   rotation={[0, Math.PI / 4, 0]} scale={[0.35, 3, 1]} />
      <Lightformer form="rect" intensity={26} position={[1.1, 0.7, -1.5]}
                   rotation={[0, -Math.PI / 4, 0]} scale={[0.35, 3, 1]} />
      <Lightformer form="rect" intensity={1.8} position={[0, -1.4, 0.2]}
                   rotation={[Math.PI / 2, 0, 0]} scale={[4, 4, 1]} />
      <Lightformer form="ring" intensity={1.3} position={[0, 2.4, -0.6]}
                   scale={[4, 4, 1]} />
    </Environment>
  );
}

/* ------------------------------------------------------------------- page */

export default function Configurator({ bodies, closures }: {
  bodies: Body[]; closures: ClosureManifest;
}) {
  const [bodyIdx, setBodyIdx] = useState(0);
  const [glass, setGlass] = useState<GlassKey>("clear");
  const [kind, setKind] = useState("roller-steel");
  const [finish, setFinish] = useState<FinishKey>("shiny-black");
  const [attachY, setAttachY] = useState<number | null>(null);

  const body = bodies[bodyIdx];
  const url = `/models/bodies-threaded/${body.bodyId}.glb`;
  const kinds = useMemo(
    () => closures.assemblies.filter((a) => a.finish === "17-415").map((a) => a.kind),
    [closures.assemblies],
  );
  const stack =
    closures.assemblies.find((a) => a.finish === "17-415" && a.kind === kind)?.stack ?? [];
  const byMesh = useMemo(() => {
    const m = new Map<string, ClosurePart>();
    for (const p of closures.parts) m.set(p.mesh, p);
    return m;
  }, [closures.parts]);

  const swatch = (bg: string, on: boolean) => ({
    width: 34, height: 34, borderRadius: "50%", cursor: "pointer",
    background: bg, border: on ? "2px solid #111" : "1px solid #d4d4d8",
    outline: on ? "2px solid #fff" : "none", outlineOffset: -4,
  });

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fff",
                  color: "#18181b",
                  fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      {/* viewer */}
      <div style={{ flex: "1 1 60%", background: "#B29878" }}>
        <Canvas dpr={[1, 2]} camera={{ position: [0.12, 0.055, 0.17], fov: 30 }}
                gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping,
                      toneMappingExposure: 0.92 }}>
          <color attach="background" args={["#B29878"]} />
          <Suspense fallback={null}>
            <BoneSweep />
            <Center key={body.bodyId + kind}>
              <Bottle url={url} glass={glass} onAttach={setAttachY} />
              {attachY != null &&
                stack.map((meshName) => {
                  const p = byMesh.get(meshName);
                  return p ? (
                    <Part key={meshName} file={p.file} mesh={p.mesh}
                          y={attachY} finish={finish} />
                  ) : null;
                })}
            </Center>
            <Studio />
            {/* Contact shadow only — NOT AccumulativeShadows, which renders
                transmissive glass OPAQUE WHITE in its offscreen pass. */}
            <ContactShadows position={[0, -0.045, 0]} opacity={0.32}
                            scale={0.4} blur={2.4} far={0.12} />
          </Suspense>
          <ambientLight intensity={0.35} />
          <OrbitControls makeDefault enablePan={false} target={[0, 0, 0]}
                         minDistance={0.07} maxDistance={0.45}
                         minPolarAngle={0.5} maxPolarAngle={2.2} />
        </Canvas>
      </div>

      {/* product panel */}
      <aside style={{ flex: "0 0 400px", padding: "56px 44px", borderLeft: "1px solid #e8e8ec" }}>
        <div style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase",
                      color: "#71717a", marginBottom: 10 }}>
          Neck finish 17/415
        </div>
        <h1 style={{ fontSize: 30, lineHeight: 1.15, margin: "0 0 6px", fontWeight: 600 }}>
          {body.family === "CylSwrl" ? "Swirl Cylinder" : "Cylinder"} {" "}
          {Math.round(body.heightMm)}&nbsp;mm
        </h1>
        <div style={{ color: "#52525b", marginBottom: 4 }}>
          {body.heightMm} × Ø{body.diameterMm} mm · {body.skuCount} variants
        </div>
        <div style={{ fontSize: 12, color: "#a1a1aa", marginBottom: 30 }}>
          {body.representativeSku}
        </div>

        <Section title="Bottle">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {bodies.map((b, i) => (
              <button key={b.bodyId} onClick={() => setBodyIdx(i)}
                style={{ padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                         fontSize: 13, background: i === bodyIdx ? "#18181b" : "#fff",
                         color: i === bodyIdx ? "#fff" : "#3f3f46",
                         border: "1px solid " + (i === bodyIdx ? "#18181b" : "#d4d4d8") }}>
                {b.family === "CylSwrl" ? "Swirl" : `${Math.round(b.heightMm)} mm`}
              </button>
            ))}
          </div>
        </Section>

        <Section title={`Glass — ${GLASS[glass].label}`}>
          <div style={{ display: "flex", gap: 10 }}>
            {(Object.keys(GLASS) as GlassKey[]).map((k) => (
              <button key={k} title={GLASS[k].label} onClick={() => setGlass(k)}
                      style={swatch(GLASS[k].swatch, glass === k)} />
            ))}
          </div>
        </Section>

        <Section title="Closure">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {kinds.map((k) => (
              <button key={k} onClick={() => setKind(k)}
                style={{ padding: "7px 11px", borderRadius: 8, cursor: "pointer",
                         fontSize: 12.5, background: k === kind ? "#18181b" : "#fff",
                         color: k === kind ? "#fff" : "#3f3f46",
                         border: "1px solid " + (k === kind ? "#18181b" : "#d4d4d8") }}>
                {k.replace(/-/g, " ")}
              </button>
            ))}
          </div>
        </Section>

        <Section title={`Closure finish — ${FINISHES[finish].label}`}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {(Object.keys(FINISHES) as FinishKey[]).map((k) => (
              <button key={k} title={FINISHES[k].label} onClick={() => setFinish(k)}
                      style={swatch(FINISHES[k].color, finish === k)} />
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#a1a1aa", marginTop: 10, lineHeight: 1.5 }}>
            Applied to the shell only — the actuator stays plastic and a steel
            ball stays steel, as on the real product.
          </div>
        </Section>

        <div style={{ marginTop: 34, paddingTop: 18, borderTop: "1px solid #e8e8ec",
                      fontSize: 12, color: "#a1a1aa", lineHeight: 1.6 }}>
          Geometry is the shipped GLB — no materials in the file. Glass, metal
          and plastic are all assigned in the browser by mesh name, so every
          swatch here is a state change rather than a new asset.
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".06em",
                    textTransform: "uppercase", color: "#71717a", marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}
