"use client";

/**
 * Bottle body viewer - the delivery-contract proof for the 3D lane.
 *
 * What this is testing, and why it exists BEFORE any closures are modelled:
 *
 *   units      the GLBs are metres, Y-up. A 70 mm bottle must measure 0.070.
 *   naming     the mesh is BB_BTL_<body_id> and carries NO material, so the
 *              browser assigns glass/frost by NAME. That is the whole reason
 *              Blender never touches materials in this pipeline.
 *   datum      BB_ATTACH_NECK is a real node at the rim. Closures will
 *              parent-and-zero to it, so if it is misplaced every cap in the
 *              configurator sits wrong. The marker makes it visible.
 *   budget     each body is ~474 KB uncompressed; the readout shows it.
 *
 * No CDN assets: the environment is built from Lightformers in-scene, so the
 * page works offline and under a strict CSP.
 *
 * Do NOT add drei's <AccumulativeShadows> here. It re-renders the scene into an
 * offscreen buffer, and that pass draws the transmissive body OPAQUE WHITE -
 * the material stays correct (transmission 1) while the glass simply vanishes,
 * which reads like a material bug and is not one.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Lightformer,
  Center,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";

type Body = {
  bodyId: string;
  family: string;
  shape: "round" | "boxy";
  neckFinish: string | null;
  heightMm: number;
  diameterMm: number | null;
  widthMm: number | null;
  depthMm: number | null;
  skuCount: number;
  representativeSku: string;
  url: string;
  bytes: number;
};

type Measured = {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  verts: number;
  attachYmm: number | null;
  shoulderYmm: number | null;
  meshName: string;
  materials: number;
};

/**
 * Glass presets. `thickness` and `attenuationDistance` are in WORLD UNITS, and
 * this scene is METRES - the same contract the GLBs are built to. Writing
 * `thickness: 1.6` here reads as 1.6 METRES of glass across a 70 mm bottle,
 * which absorbs everything and renders the body opaque white. Real container
 * glass is 2-3 mm, so these are ~0.002.
 */
const GLASS = {
  clear:   { color: "#ffffff", roughness: 0.05, transmission: 1.0,  thickness: 0.0025, ior: 1.52, atten: 0.35, attenColor: "#eaf3ef" },
  frosted: { color: "#ffffff", roughness: 0.62, transmission: 0.95, thickness: 0.0030, ior: 1.50, atten: 0.18, attenColor: "#f2f2f2" },
  amber:   { color: "#ffffff", roughness: 0.06, transmission: 1.0,  thickness: 0.0030, ior: 1.52, atten: 0.020, attenColor: "#b8641a" },
  cobalt:  { color: "#ffffff", roughness: 0.06, transmission: 1.0,  thickness: 0.0030, ior: 1.52, atten: 0.018, attenColor: "#12379c" },
  swirl:   { color: "#ffffff", roughness: 0.40, transmission: 0.92, thickness: 0.0035, ior: 1.50, atten: 0.10, attenColor: "#ded4c2" },
} as const;

type GlassKey = keyof typeof GLASS;

function Bottle({
  url,
  glass,
  showDatum,
  neckRadiusM,
  onMeasure,
}: {
  url: string;
  glass: GlassKey;
  showDatum: boolean;
  neckRadiusM: number;
  onMeasure: (m: Measured) => void;
}) {
  const gltf = useGLTF(url);
  const scene = gltf.scene;
  // what the FILE declares, not what three.js defaulted in:
  const fileMaterials: number =
    (gltf as unknown as { parser?: { json?: { materials?: unknown[] } } })
      .parser?.json?.materials?.length ?? 0;
  const root = useMemo(() => scene.clone(true), [scene]);

  const { attach, shoulder } = useMemo(() => {
    let attach: THREE.Object3D | null = null;
    let shoulder: THREE.Object3D | null = null;
    root.traverse((o) => {
      if (o.name === "BB_ATTACH_NECK") attach = o;
      if (o.name === "BB_REF_SHOULDER") shoulder = o;
    });
    return { attach, shoulder };
  }, [root]);

  // Materials are assigned HERE, by mesh name - never baked into the GLB.
  useEffect(() => {
    const g = GLASS[glass];
    let mesh: THREE.Mesh | null = null;
    root.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      const m = o as THREE.Mesh;
      if (m.name.startsWith("BB_BTL_")) {
        mesh = m;
        m.material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(g.color),
          roughness: g.roughness,
          metalness: 0,
          transmission: g.transmission,
          thickness: g.thickness,
          ior: g.ior,
          // colour comes from ATTENUATION over distance, which is how real
          // amber/cobalt glass works: thin walls stay pale, thick bases go deep.
          attenuationDistance: g.atten,
          attenuationColor: new THREE.Color(g.attenColor),
          transparent: true,
          side: THREE.DoubleSide,
          envMapIntensity: 1.3,
        });
        m.castShadow = true;
      }
    });
    if (!mesh) return;
    const m = mesh as THREE.Mesh;
    // Measure the GEOMETRY, not the object subtree. setFromObject walks
    // children, and the datum ring is parented to BB_ATTACH_NECK inside this
    // mesh - so it was adding its own tube radius to the bottle and reporting
    // 0.61 mm of drift that does not exist in the asset.
    m.geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    (m.geometry.boundingBox as THREE.Box3).getSize(size);
    const pos = m.geometry.getAttribute("position");
    onMeasure({
      // GLB is Y-up in metres: y is the bottle's height.
      widthMm: size.x * 1000,
      depthMm: size.z * 1000,
      heightMm: size.y * 1000,
      verts: pos ? pos.count : 0,
      // Y-UP: export_yup rotates Blender's Z-up into glTF's Y-up, so the
      // datum height lives in .y here. Reading .z gave 0.00 mm for every body
      // and made a correct attach point look broken.
      attachYmm: attach ? (attach as THREE.Object3D).position.y * 1000 : null,
      shoulderYmm: shoulder ? (shoulder as THREE.Object3D).position.y * 1000 : null,
      meshName: m.name,
      materials: fileMaterials,
    });
  }, [root, glass, attach, shoulder, onMeasure, fileMaterials]);

  useDatumRing(attach as THREE.Object3D | null, showDatum, neckRadiusM);

  return <primitive object={root} />;
}

/**
 * A ring at BB_ATTACH_NECK - where every closure will parent-and-zero.
 *
 * It is ADDED AS A CHILD of the datum node rather than positioned from a world
 * vector: <Center> offsets the whole model, so copying a world position into a
 * local one counted that offset twice and drew the ring at mid-body. Parenting
 * it means the ring is placed by exactly the transform a real closure will
 * inherit - which is the thing this marker is supposed to prove.
 */
function useDatumRing(target: THREE.Object3D | null, visible: boolean, radius: number) {
  useEffect(() => {
    if (!target) return;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, radius * 0.05, 8, 64),
      new THREE.MeshBasicMaterial({ color: "#ff4d4d", toneMapped: false, depthTest: false }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.renderOrder = 999;
    ring.visible = visible;
    target.add(ring);
    return () => {
      target.remove(ring);
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
    };
  }, [target, visible, radius]);
}

export default function BottleViewer({ bodies }: { bodies: Body[] }) {
  const [i, setI] = useState(0);
  const [glass, setGlass] = useState<GlassKey>("clear");
  const [showDatum, setShowDatum] = useState(true);
  const [m, setM] = useState<Measured | null>(null);
  const body = bodies[i];

  // 18-415 / 17-415 / 13-415 outside diameters, in metres.
  const neckRadiusM = useMemo(() => {
    const od: Record<string, number> = {
      "18-415": 0.0245, "17-415": 0.0197, "15-415": 0.0205,
      "13-415": 0.0175, "13-425": 0.0175, "8-425": 0.0125, "20-410": 0.0265,
      "18-400": 0.0245,
    };
    return (od[body.neckFinish ?? ""] ?? 0.02) / 2;
  }, [body.neckFinish]);

  useEffect(() => setM(null), [i]);

  const expected =
    body.shape === "round"
      ? `${body.heightMm} x Ø${body.diameterMm}`
      : `${body.heightMm} x ${body.widthMm} x ${body.depthMm}`;

  const drift: number | null = m
    ? Math.max(
        Math.abs(m.heightMm - body.heightMm),
        Math.abs(m.widthMm - (body.widthMm ?? body.diameterMm ?? 0)),
      )
    : null;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#101014", color: "#e8e8ea",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
      <aside style={{ width: 300, padding: 16, overflowY: "auto", borderRight: "1px solid #26262c" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Bottle bodies</div>
        <div style={{ color: "#8b8b96", marginBottom: 14 }}>
          {bodies.length} bodies · geometry only
        </div>

        <label style={{ color: "#8b8b96" }}>glass (assigned in-browser)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "6px 0 14px" }}>
          {(Object.keys(GLASS) as GlassKey[]).map((k) => (
            <button key={k} onClick={() => setGlass(k)}
              style={{ padding: "4px 8px", cursor: "pointer", borderRadius: 4, fontSize: 11,
                       border: "1px solid " + (glass === k ? "#6a6af0" : "#33333c"),
                       background: glass === k ? "#23234a" : "#1a1a20", color: "#e8e8ea" }}>
              {k}
            </button>
          ))}
        </div>

        <label style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={showDatum} onChange={(e) => setShowDatum(e.target.checked)} />
          <span>show BB_ATTACH_NECK</span>
        </label>

        <div style={{ borderTop: "1px solid #26262c", paddingTop: 10 }}>
          {bodies.map((b, idx) => (
            <button key={b.bodyId} onClick={() => setI(idx)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "5px 6px",
                       marginBottom: 2, borderRadius: 4, cursor: "pointer", fontSize: 11,
                       border: "1px solid " + (idx === i ? "#6a6af0" : "transparent"),
                       background: idx === i ? "#23234a" : "transparent", color: "#d2d2d8" }}>
              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {b.bodyId}
              </div>
              <div style={{ color: "#7d7d88" }}>{b.shape} · {b.skuCount} SKUs</div>
            </button>
          ))}
        </div>
      </aside>

      <main style={{ flex: 1, position: "relative" }}>
        <Canvas dpr={[1, 2]} camera={{ position: [0.16, 0.09, 0.19], fov: 32 }}>
          <color attach="background" args={["#101014"]} />
          <Suspense fallback={null}>
            <Center key={body.bodyId}>
              <Bottle url={body.url} glass={glass} showDatum={showDatum}
                      neckRadiusM={neckRadiusM} onMeasure={setM} />
            </Center>
            {/* Environment built in-scene: no CDN fetch, CSP-safe. */}
            {/* Transmission samples the ENVIRONMENT, not the lights, so a dim
                env renders glass black however many lights are added. */}
            <Environment resolution={512}>
              <Lightformer intensity={14} position={[0, 1.2, 0.8]} scale={[2, 2, 1]} />
              <Lightformer intensity={8} position={[-1.4, 0.6, 0.4]} scale={[1.4, 2.4, 1]} />
              <Lightformer intensity={6} position={[1.4, 0.4, -0.6]} scale={[1.6, 1.6, 1]} />
              <Lightformer intensity={5} form="ring" position={[0, -1.0, 0.4]} scale={[2, 2, 1]} />
            </Environment>
            <ambientLight intensity={0.5} />
            <directionalLight position={[0.2, 0.5, 0.3]} intensity={1.4} castShadow />
          </Suspense>
          <OrbitControls makeDefault enablePan target={[0, 0, 0]}
                         minDistance={0.06} maxDistance={0.8} />
        </Canvas>

        <div style={{ position: "absolute", top: 14, left: 14, padding: "10px 12px",
                      background: "rgba(16,16,20,.86)", border: "1px solid #26262c",
                      borderRadius: 6, lineHeight: 1.55, minWidth: 290 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{body.bodyId}</div>
          <Row k="family / shape" v={`${body.family} · ${body.shape}`} />
          <Row k="neck finish" v={body.neckFinish ?? "not published"} />
          <Row k="covers" v={`${body.skuCount} SKUs (rep ${body.representativeSku})`} />
          <Row k="catalogue mm" v={expected} />
          {m ? (
            <>
              <Row k="measured mm"
                   v={`${m.heightMm.toFixed(1)} x ${m.widthMm.toFixed(1)} x ${m.depthMm.toFixed(1)}`} />
              <Row k="mesh" v={m.meshName} />
              <Row k="materials in file" v={`${m.materials} (glass set in browser)`}
                   good={m.materials === 0} />
              <Row k="BB_ATTACH_NECK"
                   v={m.attachYmm === null ? "MISSING" : `y = ${m.attachYmm.toFixed(2)} mm`}
                   good={m.attachYmm !== null &&
                         Math.abs(m.attachYmm - body.heightMm) < 0.51} />
              <Row k="BB_REF_SHOULDER"
                   v={m.shoulderYmm === null ? "-" : `y = ${m.shoulderYmm.toFixed(2)} mm`} />
              <Row k="vertices / size"
                   v={`${m.verts.toLocaleString()} · ${(body.bytes / 1024).toFixed(0)} KB`} />
              <Row k="dimension drift"
                   v={drift === null ? "-" : `${drift.toFixed(2)} mm`}
                   good={drift !== null && drift < 0.51} />
            </>
          ) : (
            <div style={{ color: "#8b8b96" }}>loading…</div>
          )}
        </div>
      </main>
    </div>
  );
}

function Row({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <span style={{ color: "#7d7d88", minWidth: 118 }}>{k}</span>
      <span style={{ color: good === undefined ? "#d2d2d8" : good ? "#5fd68a" : "#ff6b6b" }}>{v}</span>
    </div>
  );
}
