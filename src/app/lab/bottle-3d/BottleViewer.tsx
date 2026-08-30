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
  MeshTransmissionMaterial,
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
  // `thickness` and `attenuationDistance` are WORLD UNITS, and this scene is
  // METRES — the same contract the GLBs are built to. Writing `thickness: 1.6`
  // reads as 1.6 METRES of glass across a 70 mm bottle, which absorbs
  // everything and renders the body opaque.
  //
  // `dispersion` splits light into colour the way real glass does, strongest
  // at edges and around the thread. It is the cheapest single thing that stops
  // three.js glass reading as tinted plastic — CG glass without it looks
  // "clean" in a way real glass never is.
  //
  // These bodies are SOLID (no cavity), so light crosses one thick slab rather
  // than wall-air-wall. thickness is therefore set to a real fraction of the
  // body, not to a wall thickness — and the attenuation distances are longer
  // than real glass chemistry would give, to compensate. A real amber bottle
  // is a ~2 mm wall you can see through; a 27 mm solid slab of the same glass
  // would be nearly black. This is the clearest symptom of the SOLID-BODY
  // ceiling: the values are being bent to fake a cavity that is not modelled.
  clear: {
    color: "#ffffff", roughness: 0.03, transmission: 1.0, thickness: 0.012,
    ior: 1.52, atten: 0.42, attenColor: "#eef6f2", dispersion: 1.4,
    clearcoat: 0.0,
  },
  frosted: {
    // Frosting is a SURFACE, so roughness climbs but transmission stays high;
    // dropping transmission instead makes it look like grey plastic.
    color: "#ffffff", roughness: 0.55, transmission: 0.98, thickness: 0.010,
    ior: 1.50, atten: 0.28, attenColor: "#f4f6f5", dispersion: 0.5,
    clearcoat: 0.0,
  },
  amber: {
    color: "#ffffff", roughness: 0.04, transmission: 1.0, thickness: 0.014,
    ior: 1.52, atten: 0.030, attenColor: "#a8571a", dispersion: 1.2,
    clearcoat: 0.0,
  },
  cobalt: {
    color: "#ffffff", roughness: 0.04, transmission: 1.0, thickness: 0.014,
    ior: 1.52, atten: 0.026, attenColor: "#123f9e", dispersion: 1.2,
    clearcoat: 0.0,
  },
  swirl: {
    color: "#ffffff", roughness: 0.30, transmission: 0.96, thickness: 0.011,
    ior: 1.50, atten: 0.16, attenColor: "#e2d8c6", dispersion: 0.9,
    clearcoat: 0.0,
  },
} as const;

type GlassKey = keyof typeof GLASS;

export type ClosurePart = {
  file: string; mesh: string; finish: string; part: string;
  variant: string | null; attach: string; asset_id?: string;
  non_manifold?: number; verts?: number;
  height_mm?: number; max_diameter_mm?: number;
};
export type ClosureManifest = {
  parts: ClosurePart[];
  assemblies: { finish: string; kind: string; stack: string[] }[];
};

/**
 * Closure colourways, taken from the SKU vocabulary rather than invented:
 * ShnBlk / MtSl / ShnSl / ShnGl / MtGl / Cu / Wh, plus the leather wraps
 * (BlkLthr, BrwnLthr, LBrwnLthr, IvyLthr, PnkLthr).
 *
 * These apply to the SHELL parts only — the cap and the metal collar. The
 * product descriptions are explicit that these are two-material assemblies
 * ("metal shell collar over plastic sprayer", "metal shell cap with plastic
 * insert"), so the actuator stays white plastic and a steel ball stays steel
 * no matter which colourway is picked. Recolouring the whole assembly would
 * be wrong, not merely ugly.
 */
const CLOSURE_FINISHES = {
  // MEASURED from the isolated cap layers in
  // "20. Closures .../12. 17-415 Roll on" — base colour is the 10-90 percentile
  // mean (trimming the specular so it is not washed out), and `spread` is the
  // p99-p02 luminance range, a proxy for how sharp the highlight is.
  //
  // These are PHENOLIC (composite) caps, NOT metal — Jordan, 2026-08-30. That
  // is a shading model, not a colour: a pigmented phenolic cap is a DIELECTRIC
  // with a clearcoat, so metalness 0. Modelling black or white as metal (which
  // an earlier version of this file did) makes it reflect like a mirror and
  // lose its body colour entirely.
  //
  // The silver/gold/copper finishes read metallic because the substrate is
  // vacuum-METALLIZED — a real metal layer under clearcoat — so those keep
  // metalness 1. If any of them turn out to be pigmented rather than plated,
  // flip `plated` and the colour stays as measured.
  "shiny-silver": { color: "#828282", plated: true,  roughness: 0.10, spread: 0.957 },
  "shiny-gold":   { color: "#9b9062", plated: true,  roughness: 0.13, spread: 0.898 },
  "pink-dot":     { color: "#d8c5cc", plated: true,  roughness: 0.22, spread: 0.748 },
  "silver-dot":   { color: "#d4d4d4", plated: true,  roughness: 0.22, spread: 0.725 },
  "matte-gold":   { color: "#c5b375", plated: true,  roughness: 0.44, spread: 0.695 },
  copper:         { color: "#975a42", plated: true,  roughness: 0.28, spread: 0.528 },
  "matte-silver": { color: "#c0c0c0", plated: true,  roughness: 0.48, spread: 0.475 },
  "shiny-black":  { color: "#292929", plated: false, roughness: 0.09, spread: 0.333 },
  "black-dot":    { color: "#202020", plated: false, roughness: 0.11, spread: 0.722 },
  white:          { color: "#f1f1f1", plated: false, roughness: 0.42, spread: 0.118 },
} as const;

type ClosureFinishKey = keyof typeof CLOSURE_FINISHES;

/** Which parts wear the colourway, and which have a fixed material role. */
function isShell(mesh: string) {
  // CAP_DOTS is deliberately excluded: on the product the studs read SILVER on
  // the black, pink and silver caps alike, so they never take the colourway.
  if (mesh.includes("CAP_DOTS")) return false;
  return mesh.includes("CAP_") || mesh.includes("SPR_COLLAR");
}

/**
 * Closure appearance, keyed by MESH NAME plus the chosen colourway. This is
 * the whole reason parts ship as separate files with stable names and ZERO
 * materials: the geometry says nothing about how it looks, so a customer
 * switching from black to copper is a state change here, not a new asset and
 * not a re-export.
 */
function partMaterial(mesh: string, finish: ClosureFinishKey): THREE.Material {
  const plastic = (color: string, roughness: number) =>
    new THREE.MeshStandardMaterial({ color, metalness: 0.0, roughness });

  if (isShell(mesh)) {
    const f = CLOSURE_FINISHES[finish];
    // Clearcoat is what makes phenolic read as phenolic: a glassy lacquer over
    // a coloured body, so the highlight sits ON TOP of the colour instead of
    // replacing it the way a bare metal highlight does.
    // A matte metallized cap is BRUSHED, not merely rough: its highlight
    // stretches around the cylinder instead of forming a round hotspot.
    // Uniform roughness is one of the reasons a CG cap reads as fake, so the
    // matte plated finishes get real anisotropy.
    const brushed = f.plated && f.roughness > 0.35;
    return new THREE.MeshPhysicalMaterial({
      color: f.color,
      metalness: f.plated ? 1.0 : 0.0,
      roughness: f.roughness,
      clearcoat: f.plated ? 0.35 : 0.9,
      clearcoatRoughness: f.plated ? 0.10 : 0.06,
      anisotropy: brushed ? 0.65 : 0.0,
      anisotropyRotation: Math.PI / 2,      // brushing runs around the cap
      envMapIntensity: 1.35,
    });
  }
  // Fixed roles — these do NOT follow the colourway.
  if (mesh.includes("CAP_DOTS")) {
    return new THREE.MeshPhysicalMaterial({
      // Polished set stones. A tiny convex mirror reflects a very small
      // solid angle, so on a dark cap it reads as a dark speck unless the
      // environment response is pushed hard — hence envMapIntensity 3.2.
      color: "#f2f4f6", metalness: 1.0, roughness: 0.06,
      clearcoat: 0.5, clearcoatRoughness: 0.05, envMapIntensity: 3.2,
    });
  }
  if (mesh.includes("ROLL_BALL")) {
    return mesh.includes("STEEL")
      ? new THREE.MeshStandardMaterial({ color: "#cfd2d6", metalness: 1.0, roughness: 0.18 })
      : plastic("#eeece4", 0.45);
  }
  if (mesh.includes("ROLL_HOUSING")) return plastic("#e8e6dd", 0.40);
  if (mesh.includes("REDUCER")) return plastic("#e9e7df", 0.42);
  if (mesh.includes("SPR_ACTUATOR")) return plastic("#f4f4f2", 0.38);
  if (mesh.includes("PMP_SPOUT")) return plastic("#f4f4f2", 0.38);
  if (mesh.includes("SPR_OVERCAP")) {
    // Clear on the *ClOvrCap SKUs. Clear plastic is TRANSMISSIVE, not pale
    // opaque grey. thickness/attenuation are WORLD UNITS (metres), so a
    // 0.6 mm wall is 0.0006 — writing 0.6 renders it solid.
    return new THREE.MeshPhysicalMaterial({
      color: "#ffffff", roughness: 0.12, metalness: 0.0,
      transmission: 0.94, thickness: 0.0006, ior: 1.49,
      attenuationDistance: 0.5,
      attenuationColor: new THREE.Color("#f2f4f2"),
    });
  }
  return plastic("#cccccc", 0.4);
}

/**
 * One closure part, seated the way the contract says: its origin IS the neck
 * rim, so it parent-and-zeros onto BB_ATTACH_NECK. `explodeMm` lifts it along
 * +Y by its index for an exploded view — no part needs to know its own seating
 * maths for that to work.
 */
function ClosurePartMesh({
  file, mesh, attachY, explodeMm, index, finish,
}: {
  file: string; mesh: string; attachY: number;
  explodeMm: number; index: number; finish: ClosureFinishKey;
}) {
  const gltf = useGLTF(`/models/closures/${file}`);
  const root = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  useEffect(() => {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = partMaterial(mesh, finish);
    });
  }, [root, mesh, finish]);
  return (
    <primitive object={root} position={[0, attachY + index * explodeMm / 1000, 0]} />
  );
}

/**
 * A ring at BB_ATTACH_NECK so the seating datum is visible while judging fit.
 *
 * Parented to the datum object, which is why the bottle is measured from its
 * GEOMETRY: Box3.setFromObject walks children, so this ring would otherwise be
 * counted as part of the bottle and report drift that does not exist.
 */
function useDatumRing(
  target: THREE.Object3D | null,
  visible: boolean,
  radius: number,
) {
  useEffect(() => {
    if (!target) return;
    const geo = new THREE.TorusGeometry(radius * 1.12, radius * 0.055, 12, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: "#ff3b52", depthTest: false, transparent: true, opacity: 0.9,
    });
    const ring = new THREE.Mesh(geo, mat);
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


function Bottle({
  url,
  glass,
  showDatum,
  neckRadiusM,
  onMeasure,
  transmissionModel,
}: {
  url: string;
  glass: GlassKey;
  showDatum: boolean;
  neckRadiusM: number;
  onMeasure: (m: Measured) => void;
  transmissionModel: boolean;
}) {
  const gltf = useGLTF(url);
  const scene = gltf.scene;
  // What the FILE declares, not what three.js defaulted in. Counting materials
  // on the loaded mesh always returns >= 1 because three.js assigns a default
  // to any primitive that has none.
  const fileMaterials: number =
    (gltf as unknown as { parser?: { json?: { materials?: unknown[] } } })
      .parser?.json?.materials?.length ?? 0;
  const root = useMemo(() => scene.clone(true), [scene]);

  // The bottle renders as an explicit <mesh> rather than a <primitive> so the
  // transmission material can be a JSX child — drei's MeshTransmissionMaterial
  // is a component, not a class, and cannot be assigned in a traverse.
  const { geometry, attach, shoulder, meshName } = useMemo(() => {
    let geometry: THREE.BufferGeometry | null = null;
    let meshName = "";
    let attach: THREE.Object3D | null = null;
    let shoulder: THREE.Object3D | null = null;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !geometry) {
        geometry = m.geometry;
        meshName = m.name;
      }
      if (o.name === "BB_ATTACH_NECK") attach = o;
      if (o.name === "BB_REF_SHOULDER") shoulder = o;
    });
    return { geometry, attach, shoulder, meshName };
  }, [root]);

  const g = GLASS[glass];
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!geometry) return;
    const geo = geometry as THREE.BufferGeometry;
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const size = new THREE.Vector3();
    bb.getSize(size);
    onMeasure({
      // Measure the GEOMETRY, not Box3.setFromObject: that walks children, so
      // anything parented to a datum (the marker ring now, a closure later)
      // gets counted as part of the bottle.
      heightMm: size.y * 1000,
      widthMm: size.x * 1000,
      depthMm: size.z * 1000,
      // Y-up: export_yup rotated Blender's Z-up, so a datum's height is .y.
      // Reading .z reports 0.00 mm for every body.
      attachYmm: attach ? (attach as THREE.Object3D).position.y * 1000 : null,
      shoulderYmm: shoulder ? (shoulder as THREE.Object3D).position.y * 1000 : null,
      verts: geo.attributes.position.count,
      meshName,
      materials: fileMaterials,
    });
  }, [geometry, attach, shoulder, meshName, fileMaterials, onMeasure]);

  useDatumRing(attach as THREE.Object3D | null, showDatum, neckRadiusM);

  if (!geometry) return null;
  return (
    <group ref={groupRef}>
      <mesh geometry={geometry as THREE.BufferGeometry} name={meshName}>
        {/* `backside` renders the BACK faces in their own pass, so light is
            traced through the far wall as well as the near one. A physical
            material only refracts where it hits, which on a SOLID body reads
            as a glass paperweight — the ceiling we kept hitting. This buys the
            wall-air-wall look without hollowing the mesh.
            It costs an extra render pass, so buffers are kept modest; drei's
            own guidance is that low buffer resolution barely shows. */}
        {/* The two models refract DIFFERENT things, which is why neither wins
            outright:
              physical      refracts the ENVIRONMENT MAP — crisp, contrasty,
                            and it does not care that the scene is empty
              transmission  refracts the SCENE through a render buffer, so it
                            needs real content behind the bottle or it turns
                            milky, but `backside` traces the far wall too
            On a solid body with a plain backdrop, physical currently looks
            better. Keep both until a real HDRI and a fuller set are in. */}
        {!transmissionModel ? (
          <meshPhysicalMaterial
            color={g.color}
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
            envMapIntensity={1.45}
          />
        ) : (
        <MeshTransmissionMaterial
          transmission={g.transmission}
          thickness={g.thickness}
          backside
          backsideThickness={g.thickness * 2.6}
          samples={8}
          resolution={512}
          backsideResolution={256}
          roughness={g.roughness}
          ior={g.ior}
          chromaticAberration={g.dispersion * 0.055}
          anisotropicBlur={g.roughness > 0.4 ? 0.6 : 0.1}
          distortion={0}
          attenuationDistance={g.atten}
          attenuationColor={g.attenColor}
          color={g.color}
          envMapIntensity={1.45}
        />
        )}
      </mesh>
      {attach ? <primitive object={attach as THREE.Object3D} /> : null}
      {shoulder ? <primitive object={shoulder as THREE.Object3D} /> : null}
    </group>
  );
}


/**
 * A product studio, built in-scene — no CDN fetch, CSP-safe.
 *
 * This is what glass and glossy plastic actually SEE. Transmission and metal
 * sample the environment map, not the lights, so a bottle looks real or fake
 * almost entirely because of what is in here. Adding more lights to a thin
 * environment does nothing for glass.
 *
 * Laid out like a real table-top set rather than as abstract panels:
 *
 *   KEY        one large soft box high and in front — the broad highlight that
 *              runs down a bottle shoulder in every product photo
 *   FILL       tall dim cards either side, so the body does not go black
 *              where it curves away
 *   RIM        two bright, NARROW strips behind. These matter most: the bright
 *              outline along a glass edge is the single strongest cue that
 *              something is transparent, and it can only come from behind
 *   FLOOR      a wide dim bounce, giving the base something to pick up
 */
/**
 * A seamless studio backdrop — a real sweep, not a flat clear colour.
 *
 * MeshTransmissionMaterial refracts the SCENE through a render buffer, so an
 * empty background gives it nothing to bend and the glass turns milky. A real
 * table-top set never shoots into a void; it uses a curved sweep with a
 * gradient, and that gradient IS what you see through the glass. This is also
 * what puts a vertical falloff into the caps' reflections instead of one flat
 * grey.
 */
function Backdrop({ light }: { light: boolean }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 8; c.height = 256;
    const ctx = c.getContext("2d")!;
    const grd = ctx.createLinearGradient(0, 0, 0, 256);
    if (light) {
      grd.addColorStop(0.0, "#ffffff");
      grd.addColorStop(0.45, "#f2f5f7");
      grd.addColorStop(1.0, "#c8ced4");
    } else {
      grd.addColorStop(0.0, "#3a3a44");
      grd.addColorStop(0.5, "#22222a");
      grd.addColorStop(1.0, "#101014");
    }
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 8, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [light]);

  return (
    <mesh position={[0, 0.02, -0.55]} scale={[3.2, 2.2, 1]}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}


function StudioEnvironment() {
  return (
    <Environment resolution={1024}>
      {/* key */}
      <Lightformer form="rect" intensity={10} color="#ffffff"
                   position={[0, 1.6, 0.9]} rotation={[-Math.PI / 3, 0, 0]}
                   scale={[3.5, 2.6, 1]} />
      {/* fill */}
      <Lightformer form="rect" intensity={3.2} color="#eef2f6"
                   position={[-1.9, 0.5, 0.5]} rotation={[0, Math.PI / 2.4, 0]}
                   scale={[2.2, 3.2, 1]} />
      <Lightformer form="rect" intensity={2.4} color="#f6f2ee"
                   position={[1.9, 0.4, 0.4]} rotation={[0, -Math.PI / 2.4, 0]}
                   scale={[2.0, 3.0, 1]} />
      {/* rim — narrow and hot, the edge-defining pair */}
      <Lightformer form="rect" intensity={22} color="#ffffff"
                   position={[-1.1, 0.7, -1.5]} rotation={[0, Math.PI / 4, 0]}
                   scale={[0.35, 3.0, 1]} />
      <Lightformer form="rect" intensity={18} color="#ffffff"
                   position={[1.1, 0.7, -1.5]} rotation={[0, -Math.PI / 4, 0]}
                   scale={[0.35, 3.0, 1]} />
      {/* floor bounce */}
      <Lightformer form="rect" intensity={1.6} color="#ffffff"
                   position={[0, -1.4, 0.2]} rotation={[Math.PI / 2, 0, 0]}
                   scale={[4, 4, 1]} />
      {/* a dim ceiling wrap keeps metal from reading as flat grey */}
      <Lightformer form="ring" intensity={1.2} color="#ffffff"
                   position={[0, 2.4, -0.6]} scale={[4, 4, 1]} />
    </Environment>
  );
}

export default function BottleViewer({
  bodies,
  threadedIds = [],
  closures = { parts: [], assemblies: [] },
}: {
  bodies: Body[];
  /** bodyIds that also exist under /models/bodies-threaded/ */
  threadedIds?: string[];
  closures?: ClosureManifest;
}) {
  const [i, setI] = useState(0);
  const [glass, setGlass] = useState<GlassKey>("clear");
  const [showDatum, setShowDatum] = useState(true);
  const [threaded, setThreaded] = useState(true);
  const [closureKind, setClosureKind] = useState<string>("none");
  const [explodeMm, setExplodeMm] = useState(0);
  // Clear glass cannot be judged against near-black: with nothing bright behind
  // it, transmission has nothing to carry and it reads as smoked glass. A light
  // ground is what every product photograph uses, and for the same reason.
  const [lightBg, setLightBg] = useState(true);
  const [transmissionModel, setTransmissionModel] = useState(false);
  const [closureFinish, setClosureFinish] =
    useState<ClosureFinishKey>("shiny-black");
  const [m, setM] = useState<Measured | null>(null);
  const body = bodies[i];

  // The threaded build carries the drawing-exact finish master (real helix)
  // grafted on; the original has a smooth silhouette-traced neck. Only some
  // bodies have one, so fall back rather than 404.
  const threadedSet = useMemo(() => new Set(threadedIds), [threadedIds]);
  const hasThreaded = threadedSet.has(body.bodyId);
  const url = hasThreaded && threaded
    ? body.url.replace("/models/bodies/", "/models/bodies-threaded/")
    : body.url;

  // 18-415 / 17-415 / 13-415 outside diameters, in metres.
  const neckRadiusM = useMemo(() => {
    const od: Record<string, number> = {
      "18-415": 0.0245, "17-415": 0.0197, "15-415": 0.0205,
      "13-415": 0.0175, "13-425": 0.0175, "8-425": 0.0125, "20-410": 0.0265,
      "18-400": 0.0245,
    };
    return (od[body.neckFinish ?? ""] ?? 0.02) / 2;
  }, [body.neckFinish]);

  // Only closures for THIS body's neck finish can seat on it — that is the
  // whole point of the finish being part of the contract.
  const fits = useMemo(
    () => closures.assemblies.filter((a) => a.finish === body.neckFinish),
    [closures.assemblies, body.neckFinish],
  );
  const partByMesh = useMemo(() => {
    const m = new Map<string, ClosurePart>();
    for (const p of closures.parts) m.set(p.mesh, p);
    return m;
  }, [closures.parts]);
  const stack = fits.find((a) => a.kind === closureKind)?.stack ?? [];

  useEffect(() => setM(null), [i]);
  // A closure chosen for one finish cannot seat on the next body.
  useEffect(() => setClosureKind("none"), [body.neckFinish]);

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

        <label style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={showDatum} onChange={(e) => setShowDatum(e.target.checked)} />
          <span>show BB_ATTACH_NECK</span>
        </label>

        <label style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={lightBg} onChange={(e) => setLightBg(e.target.checked)} />
          <span>studio background</span>
        </label>

        <label style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={transmissionModel}
                 onChange={(e) => setTransmissionModel(e.target.checked)} />
          <span>MeshTransmissionMaterial</span>
        </label>
        <div style={{ color: "#7d7d88", marginBottom: 10, fontSize: 11 }}>
          {transmissionModel
            ? "refracts the SCENE (backside pass) — needs content behind"
            : "refracts the ENVIRONMENT map — crisper on an empty set"}
        </div>

        <label style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4,
                        cursor: hasThreaded ? "pointer" : "not-allowed",
                        opacity: hasThreaded ? 1 : 0.4 }}>
          <input type="checkbox" checked={hasThreaded && threaded} disabled={!hasThreaded}
                 onChange={(e) => setThreaded(e.target.checked)} />
          <span>threaded finish</span>
        </label>
        <div style={{ color: "#8b8b96", marginBottom: 14, fontSize: 11 }}>
          {hasThreaded
            ? (threaded
                ? "drawing-exact finish master, grafted"
                : "original silhouette-traced neck")
            : "no threaded build for this body yet"}
        </div>

        <div style={{ borderTop: "1px solid #26262c", paddingTop: 10, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Closure</div>
          {fits.length === 0 ? (
            <div style={{ color: "#8b8b96", marginBottom: 8 }}>
              no closure built for {body.neckFinish ?? "this finish"} yet
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
              {["none", ...fits.map((a) => a.kind)].map((k) => (
                <button key={k} onClick={() => setClosureKind(k)}
                  style={{ padding: "4px 7px", borderRadius: 4, cursor: "pointer", fontSize: 11,
                           border: "1px solid " + (closureKind === k ? "#6a6af0" : "#33333c"),
                           background: closureKind === k ? "#23234a" : "transparent",
                           color: "#d2d2d8" }}>{k}</button>
              ))}
            </div>
          )}

          {stack.length > 0 && (
            <>
              <div style={{ color: "#8b8b96", marginBottom: 4 }}>closure finish</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                {(Object.keys(CLOSURE_FINISHES) as ClosureFinishKey[]).map((k) => (
                  <button key={k} onClick={() => setClosureFinish(k)} title={k}
                    style={{ width: 22, height: 22, borderRadius: 4, cursor: "pointer",
                             background: CLOSURE_FINISHES[k].color,
                             border: "2px solid " +
                               (closureFinish === k ? "#6a6af0" : "#33333c") }} />
                ))}
              </div>
              <div style={{ color: "#7d7d88", marginBottom: 10, fontSize: 11 }}>
                {closureFinish} — applied to the shell only; the actuator stays
                plastic and a steel ball stays steel
              </div>

              <label style={{ display: "block", color: "#8b8b96", marginBottom: 3 }}>
                explode {explodeMm} mm
              </label>
              <input type="range" min={0} max={40} step={1} value={explodeMm}
                     onChange={(e) => setExplodeMm(Number(e.target.value))}
                     style={{ width: "100%", marginBottom: 8 }} />
              <div style={{ color: "#8b8b96", lineHeight: 1.7 }}>
                {stack.map((meshName, idx) => {
                  const pp = partByMesh.get(meshName);
                  return (
                    <div key={meshName} style={{ whiteSpace: "nowrap", overflow: "hidden",
                                                 textOverflow: "ellipsis" }}>
                      <span style={{ color: "#6a6af0" }}>{idx}</span>{" "}
                      {meshName.replace(/^BB_/, "")}
                      {pp?.height_mm ? (
                        <span style={{ color: "#5f5f6a" }}>
                          {" "}· {pp.height_mm}×Ø{pp.max_diameter_mm}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

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
        <Canvas dpr={[1, 2]} camera={{ position: [0.16, 0.09, 0.19], fov: 32 }}
                gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping,
                      toneMappingExposure: 1.05 }}>
          {/* A mid-grey ground reads closer to a product shot than near-black,
              and gives the glass something to refract that is not the void.
              NOTE: no drei <AccumulativeShadows> or <ContactShadows> here —
              they re-render the scene into an offscreen buffer and that pass
              draws transmissive glass OPAQUE WHITE, while the material stays
              correct, so it reads as a material bug and is not one. */}
          <color attach="background" args={[lightBg ? "#eceff2" : "#2a2a30"]} />
          <Suspense fallback={null}>
            <Center key={body.bodyId}>
              <Bottle url={url} glass={glass} showDatum={showDatum}
                      neckRadiusM={neckRadiusM} onMeasure={setM}
                      transmissionModel={transmissionModel} />
              {/* Every part parent-and-zeros to the rim: its origin already IS
                  the rim, so the only placement needed is the attach height. */}
              {m?.attachYmm != null &&
                stack.map((meshName, idx) => {
                  const pp = partByMesh.get(meshName);
                  if (!pp) return null;
                  return (
                    <ClosurePartMesh key={meshName} file={pp.file} mesh={pp.mesh}
                                     attachY={m.attachYmm! / 1000}
                                     explodeMm={explodeMm} index={idx}
                                     finish={closureFinish} />
                  );
                })}
            </Center>
            {/* Environment built in-scene: no CDN fetch, CSP-safe. */}
            {/* Transmission samples the ENVIRONMENT, not the lights, so a dim
                env renders glass black however many lights are added. */}
            <Backdrop light={lightBg} />
            <StudioEnvironment />
            {/* Deliberately dim: transmissive glass barely responds to direct
                lights, so these only lift the opaque closure parts. Realism
                comes from the ENVIRONMENT above, not from adding lights. */}
            <ambientLight intensity={0.35} />
            <directionalLight position={[0.2, 0.5, 0.3]} intensity={0.9} />
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
