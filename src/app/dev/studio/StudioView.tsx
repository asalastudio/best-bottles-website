"use client";

/**
 * StudioView — the tuning studio. Jordan drives; the app hands back JSON.
 *
 * Everything that decides how a part looks is a control here — material,
 * lights, AND the environment (Jordan: "can the studio lighting live in
 * here also so we have all the environment along with tuning"). Nothing
 * that affects the render is hidden in a file somewhere else, because a
 * token tuned under an unknown environment is not a tuned token.
 *
 * The workflow is one product at a time: pick the part, pick its
 * reference, tune, copy the JSON. The canonical reference sits beside the
 * render at the same size and the parity numbers update live, so "does it
 * match?" is answered on screen — by eye AND by measurement.
 *
 * ENVIRONMENT. Two slots, A and B, matching the token contract's
 * env:"metal" | env:"tent". Each slot can point at any studio HDRI we
 * ship, with its own intensity and Y rotation. Rotation matters more than
 * it looks: it decides WHERE the softbox lands on a curved wall, which is
 * the difference between a bottle that reads as glass and one that reads
 * as a grey tube.
 *
 * REFLECTION CHECK. The mirror ball shows the environment as a surface
 * actually sees it. If the ball is flat, the env is not reaching the
 * material and no amount of material tuning will help — that is the
 * "is the lighting and reflection working" question, answered directly.
 *
 * Two findings from the pink-cap session are wired in as labelled hints,
 * because they mattered more than base colour:
 *   - envMapIntensity FILLS the shadows a key light carves. A dielectric
 *     at env 1.35 renders flat no matter how strong the key is.
 *   - a specular lobe below one pixel is invisible. Roughness is the
 *     sparkle control on small stones, not intensity.
 *
 * "Copy token JSON" emits exactly the shape materials.json expects, plus
 * the environment and rig it was tuned under. It never writes: values
 * reach the registry only when Jordan hands the JSON over, which is what
 * keeps the locked set trustworthy.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useGLTF, useEnvironment, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";

/* ------------------------------------------------------------- types */

type Vals = {
  color: string; roughness: number; metalness: number;
  clearcoat: number; clearcoatRoughness: number; ior: number;
  specularIntensity: number; envMapIntensity: number; transmission: number;
  thickness: number; attenuationDistance: number; attenuationColor: string;
  env: "metal" | "tent";
};
type Lights = {
  keyI: number; keyX: number; keyY: number; keyZ: number;
  fillI: number; fillX: number; fillY: number; fillZ: number;
  ambI: number; exposure: number;
};
/** one environment slot: which HDRI, how strong, and turned how far */
type EnvSlot = { file: string; intensity: number; rotation: number };
type EnvRig = { metal: EnvSlot; tent: EnvSlot; showBackground: boolean; ground: string };

/** every studio HDRI we ship. The two marked (approved) are what the
 *  storefront renders with today — change those only with a decision. */
const HDRIS: Array<{ file: string; label: string }> = [
  { file: "/models/studio-classic-clean.hdr", label: "classic clean (approved · metal)" },
  { file: "/models/studio-browser.hdr", label: "browser tent (approved · plastic)" },
  { file: "/models/studio-metal-key.hdr", label: "metal key — single softbox" },
  { file: "/models/studio-metal.hdr", label: "metal" },
  { file: "/models/studio-metal-ph.hdr", label: "metal ph" },
  { file: "/models/studio-classic.hdr", label: "classic (raw)" },
  { file: "/models/studio-universal.hdr", label: "universal" },
  { file: "/models/studio-room.hdr", label: "room" },
  { file: "/models/studio-mono.hdr", label: "mono" },
  { file: "/models/studio.hdr", label: "studio" },
];

const DEFAULT_VALS: Vals = {
  color: "#e0a8c2", roughness: 0.34, metalness: 0, clearcoat: 0.35,
  clearcoatRoughness: 0.06, ior: 1.5, specularIntensity: 1.2,
  envMapIntensity: 0.12, transmission: 0, thickness: 0,
  attenuationDistance: 0, attenuationColor: "#ffffff", env: "metal",
};
const DEFAULT_STUDS: Vals = {
  ...DEFAULT_VALS, color: "#2a2f2d", roughness: 0.07, clearcoat: 1,
  clearcoatRoughness: 0.02, ior: 2.4, specularIntensity: 5, envMapIntensity: 1.6,
};
const DEFAULT_LIGHTS: Lights = {
  keyI: 5.0, keyX: -0.9, keyY: 1.1, keyZ: 1.4,
  fillI: 0.55, fillX: 1.3, fillY: 0.3, fillZ: 0.7,
  ambI: 0.06, exposure: 1.0,
};
const DEFAULT_ENV: EnvRig = {
  metal: { file: HDRIS[0].file, intensity: 1, rotation: 0 },
  tent: { file: HDRIS[1].file, intensity: 1, rotation: 0 },
  showBackground: false, ground: "#ffffff",
};

/* --------------------------------------------------------------- rig */

function Part({ url, vals, envs }: {
  url: string; vals: Vals;
  envs: Record<"metal" | "tent", { tex: THREE.Texture; intensity: number; rotation: number }>;
}) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);
  useEffect(() => {
    const slot = envs[vals.env];
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(vals.color),
      roughness: vals.roughness, metalness: vals.metalness,
      clearcoat: vals.clearcoat, clearcoatRoughness: vals.clearcoatRoughness,
      ior: vals.ior, transmission: vals.transmission,
      transparent: vals.transmission > 0,
    });
    m.specularIntensity = vals.specularIntensity;
    if (vals.transmission > 0) {
      m.thickness = vals.thickness;
      if (vals.attenuationDistance > 0) {
        m.attenuationDistance = vals.attenuationDistance;
        m.attenuationColor = new THREE.Color(vals.attenuationColor);
      }
    }
    m.envMap = slot.tex;
    // the slot's own intensity multiplies the material's, so one dial
    // brightens every part on that env without retuning each token
    m.envMapIntensity = vals.envMapIntensity * slot.intensity;
    // A material carrying its OWN envMap does not see scene.environmentRotation
    // -- that only turns scene.environment. Rotation has to be set per material
    // or the slider moves and nothing happens.
    m.envMapRotation = new THREE.Euler(0, (slot.rotation * Math.PI) / 180, 0);
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.material = m;
    });
    return () => m.dispose();
  }, [scene, vals, envs]);
  return <primitive object={scene} />;
}

/** The reflection check. A chrome ball shows the environment exactly as a
 *  surface sees it — a flat ball means the env is not reaching materials. */
function MirrorBall({ tex, radius, intensity, rotation }: {
  tex: THREE.Texture; radius: number; intensity: number; rotation: number;
}) {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: "#ffffff", metalness: 1, roughness: 0.02 });
    m.envMap = tex;
    m.envMapIntensity = intensity;
    m.envMapRotation = new THREE.Euler(0, (rotation * Math.PI) / 180, 0);
    return m;
  }, [tex, intensity, rotation]);
  useEffect(() => () => { mat.dispose(); }, [mat]);
  return (
    <mesh material={mat}>
      <sphereGeometry args={[radius, 48, 32]} />
    </mesh>
  );
}

function Rig({ parts, vals, studVals, lights, env, zoom, ball, onFrame }: {
  parts: { shell: string; studs: string | null };
  vals: Vals; studVals: Vals; lights: Lights; env: EnvRig;
  zoom: number; ball: boolean; onFrame: (c: HTMLCanvasElement) => void;
}) {
  const metalTex = useEnvironment({ files: env.metal.file });
  const tentTex = useEnvironment({ files: env.tent.file });
  const envs = useMemo(() => ({
    metal: { tex: metalTex, intensity: env.metal.intensity, rotation: env.metal.rotation },
    tent: { tex: tentTex, intensity: env.tent.intensity, rotation: env.tent.rotation },
  }), [metalTex, tentTex, env.metal.intensity, env.metal.rotation,
       env.tent.intensity, env.tent.rotation]);

  const { gl, scene } = useThree();
  useEffect(() => { gl.toneMappingExposure = lights.exposure; }, [gl, lights.exposure]);

  // The BACKDROP is a scene property; reflections are per material (above).
  // backgroundRotation keeps the visible HDRI turning in step with what the
  // parts are actually reflecting, so the two never disagree on screen.
  const activeSlot = envs[vals.env];
  useEffect(() => {
    scene.backgroundRotation = new THREE.Euler(0, (activeSlot.rotation * Math.PI) / 180, 0);
    scene.background = env.showBackground ? activeSlot.tex : new THREE.Color(env.ground);
    scene.backgroundIntensity = activeSlot.intensity;
    return () => { scene.background = null; };
  }, [scene, activeSlot, env.showBackground, env.ground]);

  useEffect(() => {
    const id = setInterval(() => onFrame(gl.domElement), 900);
    return () => clearInterval(id);
  }, [gl, onFrame]);

  return (
    <>
      <OrthographicCamera makeDefault position={[0, 0, 0.2]} near={0.001} far={1}
                          left={-zoom * 0.75} right={zoom * 0.75}
                          top={zoom} bottom={-zoom} />
      <directionalLight position={[lights.keyX, lights.keyY, lights.keyZ]}
                        intensity={lights.keyI} />
      <directionalLight position={[lights.fillX, lights.fillY, lights.fillZ]}
                        intensity={lights.fillI} />
      <ambientLight intensity={lights.ambI} />
      {ball
        ? <MirrorBall tex={activeSlot.tex} radius={zoom * 0.62}
                      intensity={activeSlot.intensity} rotation={activeSlot.rotation} />
        : (
          <group position={[0, 0.0012, 0]}>
            <Part url={parts.shell} vals={vals} envs={envs} />
            {parts.studs && <Part url={parts.studs} vals={studVals} envs={envs} />}
          </group>
        )}
    </>
  );
}

/* ------------------------------------------------------------- panel */

function Slider({ label, value, min, max, step, onChange, hint, dp = 3 }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; hint?: string; dp?: number;
}) {
  return (
    <label style={{ display: "block", marginBottom: 9 }}>
      <span style={{ display: "flex", justifyContent: "space-between",
                     fontSize: 11, color: "#57606C", marginBottom: 3 }}>
        <span>{label}{hint && <em style={{ color: "#9A9590", fontStyle: "normal" }}> · {hint}</em>}</span>
        <b style={{ color: "#1D1D1F", fontVariantNumeric: "tabular-nums" }}>{value.toFixed(dp)}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={(e) => onChange(parseFloat(e.target.value))}
             style={{ width: "100%", accentColor: "#C5A065" }} />
    </label>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase",
                color: "#8B6F42", fontWeight: 600, margin: "16px 0 8px" }}>{children}</p>
  );
}

function Seg<T extends string>({ options, value, onChange }: {
  options: ReadonlyArray<{ id: T; label: string }>; value: T; onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)}
                style={{ flex: 1, padding: "6px 8px", fontSize: 11, fontWeight: 600,
                         borderRadius: 3, cursor: "pointer",
                         border: value === o.id ? "1px solid #1D1D1F" : "1px solid #D4C5A9",
                         background: value === o.id ? "#1D1D1F" : "#fff",
                         color: value === o.id ? "#fff" : "#57606C" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%", font: "inherit", fontSize: 11, padding: 5,
  border: "1px solid #D4C5A9", borderRadius: 3, background: "#fff",
};

/* -------------------------------------------------------------- view */

type PartRow = { id: string; kind: string; url: string; neck: string | null };
type RefRow = { slug: string; image: string; colourway: string; component: string | null };

export default function StudioView() {
  const [refs, setRefs] = useState<RefRow[]>([]);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [refSlug, setRefSlug] = useState("12-17-415-roll-on-cproll17-415pnkdot");
  const [shell, setShell] = useState("/models/closures/BB_CAP_17415.glb");
  const [studs, setStuds] = useState<string | null>("/models/closures/BB_CAP_DOTS_17415.glb");
  const [target, setTarget] = useState<"shell" | "studs">("shell");
  const [tab, setTab] = useState<"material" | "environment">("material");
  const [ball, setBall] = useState(false);
  const [vals, setVals] = useState<Vals>(DEFAULT_VALS);
  const [studVals, setStudVals] = useState<Vals>(DEFAULT_STUDS);
  const [lights, setLights] = useState<Lights>(DEFAULT_LIGHTS);
  const [env, setEnv] = useState<EnvRig>(DEFAULT_ENV);
  const [zoom, setZoom] = useState(0.0178);
  const [metrics, setMetrics] = useState<Record<string, number | string> | null>(null);
  const [refMetrics, setRefMetrics] = useState<Record<string, number> | null>(null);
  const [copied, setCopied] = useState(false);
  const refImg = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    fetch("/references/index.json").then((r) => r.json())
      .then((j) => setRefs(j.references ?? [])).catch(() => {});
    fetch("/models/parts-index.json").then((r) => r.json())
      .then((j) => setParts(j.parts ?? [])).catch(() => {});
  }, []);

  const active = target === "shell" ? vals : studVals;
  const setActive = (v: Vals) => (target === "shell" ? setVals(v) : setStudVals(v));
  const upd = (k: keyof Vals, v: number | string) =>
    setActive({ ...active, [k]: v } as Vals);
  const updEnv = (slot: "metal" | "tent", k: keyof EnvSlot, v: number | string) =>
    setEnv({ ...env, [slot]: { ...env[slot], [k]: v } });

  /** measure a pixel buffer exactly as parity-report.py does */
  const stats = (d: Uint8ClampedArray, alpha: boolean) => {
    const px: number[][] = [];
    let bright = 0, dark = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (alpha && d[i + 3] < 10) continue;
      const l = (r + g + b) / 3;
      if (l > 248) continue;                    // the white sweep, not the part
      px.push([r, g, b, l]);
      if (l > 235) bright++;
      if (l < 110) dark++;
    }
    if (!px.length) return null;
    px.sort((p, q) => p[3] - q[3]);
    const at = (f: number) => px[Math.max(0, Math.min(px.length - 1, Math.round(px.length * f)))];
    return { px, at, bright, dark };
  };
  const hex = (a: number[]) =>
    "#" + a.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

  const measure = useCallback((canvas: HTMLCanvasElement) => {
    const off = document.createElement("canvas");
    off.width = canvas.width; off.height = canvas.height;
    const ctx = off.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0);
    const s = stats(ctx.getImageData(0, 0, off.width, off.height).data, true);
    if (!s) return;
    setMetrics({
      covered: s.px.length, midtone: hex(s.at(0.5)),
      range: Math.round(s.at(0.95)[3] - s.at(0.05)[3]),
      darkPct: +(100 * s.dark / s.px.length).toFixed(2),
      brightPct: +(100 * s.bright / s.px.length).toFixed(2),
    });
  }, []);

  const measureRef = () => {
    const img = refImg.current;
    if (!img?.complete || !img.naturalWidth) return;
    const off = document.createElement("canvas");
    off.width = img.naturalWidth; off.height = img.naturalHeight;
    const ctx = off.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const s = stats(ctx.getImageData(0, 0, off.width, off.height).data, false);
    if (!s) return;
    setRefMetrics({
      range: Math.round(s.at(0.95)[3] - s.at(0.05)[3]),
      darkPct: +(100 * s.dark / s.px.length).toFixed(2),
      brightPct: +(100 * s.bright / s.px.length).toFixed(2),
      midR: s.at(0.5)[0], midG: s.at(0.5)[1], midB: s.at(0.5)[2],
    });
  };

  const tokenJson = () => {
    const toLinear = (h: string) => {
      const n = parseInt(h.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
        const c = v / 255;
        return +(c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92).toFixed(4);
      });
    };
    const one = (v: Vals) => ({
      color: v.color, linear: toLinear(v.color),
      metalness: v.metalness, roughness: v.roughness,
      clearcoat: v.clearcoat, clearcoatRoughness: v.clearcoatRoughness,
      ior: v.ior, specularIntensity: v.specularIntensity,
      envMapIntensity: v.envMapIntensity, env: v.env,
      ...(v.transmission > 0 ? {
        transmission: v.transmission, thickness: v.thickness,
        ...(v.attenuationDistance > 0 ? {
          attenuationDistance: v.attenuationDistance,
          attenuationColor: v.attenuationColor,
        } : {}),
      } : {}),
    });
    return JSON.stringify({
      tunedBy: "jordan", tunedAt: new Date().toISOString().slice(0, 10),
      reference: refSlug,
      part: { shell, studs },
      environment: env, lights, zoom,
      shell: one(vals), studs: studs ? one(studVals) : null,
    }, null, 2);
  };

  const cell = { background: "#FDFBF8", border: "1px solid rgba(212,197,169,.55)",
                 borderRadius: 4, padding: 12 } as const;
  const num = (v: number | string | undefined) =>
    v === undefined ? "—" : typeof v === "number" ? v.toLocaleString() : v;
  const partName = (url: string) => url.split("/").pop()?.replace(/\.glb$/, "") ?? url;

  return (
    <div style={{ background: "#FAF8F5", minHeight: "100vh", padding: 20,
                  font: "13px Inter, system-ui, sans-serif", color: "#1D1D1F" }}>
      <p style={{ fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase",
                  color: "#8B6F42", fontWeight: 600 }}>Best Bottles · material studio</p>
      <h1 style={{ font: "500 26px/1.1 'EB Garamond', Georgia, serif", margin: "4px 0 14px" }}>
        Tune against the reference
      </h1>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* reference */}
        <div style={cell}>
          <p style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase",
                      color: "#57606C", fontWeight: 600, marginBottom: 6 }}>Reference</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={refImg} src={`/references/closures/${refSlug}.png`} alt="reference"
               onLoad={measureRef} crossOrigin="anonymous"
               style={{ width: 300, height: 400, objectFit: "contain", background: "#fff" }} />
          <select value={refSlug} onChange={(e) => setRefSlug(e.target.value)}
                  style={{ ...selectStyle, width: 300, marginTop: 8 }}>
            {refs.length === 0 && <option value={refSlug}>{refSlug}</option>}
            {refs.map((r) => (
              <option key={r.slug} value={r.slug}>{r.colourway} — {r.component ?? "?"}</option>
            ))}
          </select>
        </div>

        {/* render */}
        <div style={cell}>
          <div style={{ display: "flex", justifyContent: "space-between",
                        alignItems: "center", marginBottom: 6 }}>
            <p style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase",
                        color: "#57606C", fontWeight: 600 }}>
              {ball ? "Reflection check" : "Render"}
            </p>
            <button onClick={() => setBall(!ball)}
                    style={{ fontSize: 10, padding: "3px 8px", borderRadius: 3, cursor: "pointer",
                             border: "1px solid #D4C5A9",
                             background: ball ? "#1D1D1F" : "#fff",
                             color: ball ? "#fff" : "#57606C", fontWeight: 600 }}>
              mirror ball
            </button>
          </div>
          <div style={{ width: 300, height: 400, background: "#fff" }}>
            <Canvas
              gl={{ antialias: true, preserveDrawingBuffer: true,
                    toneMapping: THREE.ACESFilmicToneMapping,
                    outputColorSpace: THREE.SRGBColorSpace }}
              style={{ width: 300, height: 400 }}
              onCreated={({ gl }) => gl.setClearColor("#ffffff", 1)}
            >
              <Suspense fallback={null}>
                <Rig parts={{ shell, studs }} vals={vals} studVals={studVals}
                     lights={lights} env={env} zoom={zoom} ball={ball} onFrame={measure} />
              </Suspense>
            </Canvas>
          </div>
          <table style={{ width: 300, marginTop: 8, fontSize: 11,
                          fontVariantNumeric: "tabular-nums", borderCollapse: "collapse" }}>
            <tbody>
              {[["tonal range", metrics?.range, refMetrics?.range],
                ["dark %", metrics?.darkPct, refMetrics?.darkPct],
                ["bright %", metrics?.brightPct, refMetrics?.brightPct],
                ["midtone", metrics?.midtone, refMetrics
                  ? hex([refMetrics.midR, refMetrics.midG, refMetrics.midB]) : undefined],
              ].map(([k, mine, theirs]) => (
                <tr key={String(k)}>
                  <td style={{ color: "#57606C", padding: "2px 0" }}>{k}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{num(mine as number)}</td>
                  <td style={{ textAlign: "right", color: "#9A9590" }}>{num(theirs as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 10, color: "#9A9590", marginTop: 4 }}>
            {ball ? "the environment as a surface sees it — flat means it is not reaching materials"
                  : "yours · reference"}
          </p>
        </div>

        {/* controls */}
        <div style={{ ...cell, width: 330 }}>
          <Seg options={[{ id: "material", label: "Material" },
                         { id: "environment", label: "Environment" }] as const}
               value={tab} onChange={setTab} />

          {tab === "material" ? (
            <>
              <Seg options={[{ id: "shell", label: "Shell" },
                             { id: "studs", label: "Stones" }] as const}
                   value={target} onChange={setTarget} />

              <label style={{ display: "block", marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: "#57606C" }}>Base colour</span>
                <input type="color" value={active.color}
                       onChange={(e) => upd("color", e.target.value)}
                       style={{ width: "100%", height: 30, marginTop: 3 }} />
              </label>

              <Slider label="roughness" hint="sparkle size on small stones"
                      value={active.roughness} min={0} max={1} step={0.005}
                      onChange={(v) => upd("roughness", v)} />
              <Slider label="metalness" hint="0 plastic · 1 metal, never between"
                      value={active.metalness} min={0} max={1} step={1} dp={0}
                      onChange={(v) => upd("metalness", v)} />
              <Slider label="envMapIntensity" hint="fills the key's shadows"
                      value={active.envMapIntensity} min={0} max={5} step={0.01}
                      onChange={(v) => upd("envMapIntensity", v)} />
              <Slider label="clearcoat" value={active.clearcoat} min={0} max={1} step={0.01}
                      onChange={(v) => upd("clearcoat", v)} />
              <Slider label="clearcoatRoughness" value={active.clearcoatRoughness}
                      min={0} max={1} step={0.005}
                      onChange={(v) => upd("clearcoatRoughness", v)} />
              <Slider label="specularIntensity" hint="reflectivity"
                      value={active.specularIntensity} min={0} max={6} step={0.05}
                      onChange={(v) => upd("specularIntensity", v)} />
              <Slider label="ior" value={active.ior} min={1} max={2.8} step={0.01}
                      onChange={(v) => upd("ior", v)} />

              <Head>Glass · only bites when transmission &gt; 0</Head>
              <Slider label="transmission" value={active.transmission} min={0} max={1} step={0.01}
                      onChange={(v) => upd("transmission", v)} />
              <Slider label="thickness" hint="mm of glass the ray crosses"
                      value={active.thickness} min={0} max={20} step={0.1} dp={1}
                      onChange={(v) => upd("thickness", v)} />
              <Slider label="attenuationDistance" hint="0 = off · how far before the tint bites"
                      value={active.attenuationDistance} min={0} max={40} step={0.5} dp={1}
                      onChange={(v) => upd("attenuationDistance", v)} />
              <label style={{ display: "block", marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: "#57606C" }}>attenuation colour</span>
                <input type="color" value={active.attenuationColor}
                       onChange={(e) => upd("attenuationColor", e.target.value)}
                       style={{ width: "100%", height: 26, marginTop: 3 }} />
              </label>

              <Head>This part reflects</Head>
              <Seg options={[{ id: "metal", label: "Env A · metal" },
                             { id: "tent", label: "Env B · tent" }] as const}
                   value={active.env} onChange={(v) => upd("env", v)} />
            </>
          ) : (
            <>
              {(["metal", "tent"] as const).map((slot) => (
                <div key={slot}>
                  <Head>{slot === "metal" ? "Env A · metal / glossy" : "Env B · tent / plastic"}</Head>
                  <select value={env[slot].file}
                          onChange={(e) => updEnv(slot, "file", e.target.value)}
                          style={{ ...selectStyle, marginBottom: 9 }}>
                    {HDRIS.map((h) => <option key={h.file} value={h.file}>{h.label}</option>)}
                  </select>
                  <Slider label="intensity" hint="multiplies every part on this env"
                          value={env[slot].intensity} min={0} max={4} step={0.01}
                          onChange={(v) => updEnv(slot, "intensity", v)} />
                  <Slider label="rotation" hint="degrees — moves where the softbox lands"
                          value={env[slot].rotation} min={-180} max={180} step={1} dp={0}
                          onChange={(v) => updEnv(slot, "rotation", v)} />
                </div>
              ))}

              <Head>Backdrop</Head>
              <Seg options={[{ id: "flat", label: "Flat sweep" },
                             { id: "hdri", label: "Show HDRI" }] as const}
                   value={env.showBackground ? "hdri" : "flat"}
                   onChange={(v) => setEnv({ ...env, showBackground: v === "hdri" })} />
              <label style={{ display: "block", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "#57606C" }}>sweep colour</span>
                <input type="color" value={env.ground}
                       onChange={(e) => setEnv({ ...env, ground: e.target.value })}
                       style={{ width: "100%", height: 26, marginTop: 3 }} />
              </label>
              <p style={{ fontSize: 10, color: "#9A9590", margin: "0 0 4px" }}>
                Parity is measured against a white sweep. Change it to judge, put
                it back to #ffffff to measure.
              </p>

              <Head>Lighting</Head>
              <Slider label="key" value={lights.keyI} min={0} max={12} step={0.1} dp={2}
                      onChange={(v) => setLights({ ...lights, keyI: v })} />
              <Slider label="key x" value={lights.keyX} min={-3} max={3} step={0.05} dp={2}
                      onChange={(v) => setLights({ ...lights, keyX: v })} />
              <Slider label="key y" value={lights.keyY} min={-3} max={3} step={0.05} dp={2}
                      onChange={(v) => setLights({ ...lights, keyY: v })} />
              <Slider label="key z" value={lights.keyZ} min={-3} max={3} step={0.05} dp={2}
                      onChange={(v) => setLights({ ...lights, keyZ: v })} />
              <Slider label="fill" value={lights.fillI} min={0} max={4} step={0.05} dp={2}
                      onChange={(v) => setLights({ ...lights, fillI: v })} />
              <Slider label="fill x" value={lights.fillX} min={-3} max={3} step={0.05} dp={2}
                      onChange={(v) => setLights({ ...lights, fillX: v })} />
              <Slider label="fill y" value={lights.fillY} min={-3} max={3} step={0.05} dp={2}
                      onChange={(v) => setLights({ ...lights, fillY: v })} />
              <Slider label="fill z" value={lights.fillZ} min={-3} max={3} step={0.05} dp={2}
                      onChange={(v) => setLights({ ...lights, fillZ: v })} />
              <Slider label="ambient" value={lights.ambI} min={0} max={1} step={0.01}
                      onChange={(v) => setLights({ ...lights, ambI: v })} />
              <Slider label="exposure" value={lights.exposure} min={0.2} max={2.5} step={0.01}
                      onChange={(v) => setLights({ ...lights, exposure: v })} />
              <Slider label="zoom" value={zoom} min={0.005} max={0.12} step={0.0005} dp={4}
                      onChange={setZoom} />

              <button onClick={() => { setLights(DEFAULT_LIGHTS); setEnv(DEFAULT_ENV); }}
                      style={{ width: "100%", marginTop: 4, padding: "7px 8px", fontSize: 11,
                               fontWeight: 600, borderRadius: 3, cursor: "pointer",
                               border: "1px solid #D4C5A9", background: "#fff", color: "#57606C" }}>
                Reset rig to the approved studio
              </button>
            </>
          )}

          <button onClick={() => {
                    navigator.clipboard?.writeText(tokenJson());
                    setCopied(true); setTimeout(() => setCopied(false), 1600);
                  }}
                  style={{ width: "100%", marginTop: 14, padding: "11px 8px",
                           background: copied ? "#1F6B49" : "#1D1D1F", color: "#fff",
                           border: "none", borderRadius: 3, fontSize: 13, fontWeight: 600,
                           cursor: "pointer" }}>
            {copied ? "Copied — paste it to Claude" : "Copy token JSON"}
          </button>
          <p style={{ fontSize: 10, color: "#9A9590", marginTop: 6 }}>
            Nothing is written here. Paste the JSON back and it goes into the
            registry with your approval on it.
          </p>
        </div>
      </div>

      {/* part picker — one product at a time */}
      <div style={{ ...cell, marginTop: 16, maxWidth: 1000 }}>
        <p style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase",
                    color: "#57606C", fontWeight: 600, marginBottom: 8 }}>
          Part &nbsp;·&nbsp; {parts.length} in the library
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ flex: "1 1 320px" }}>
            <span style={{ fontSize: 11, color: "#57606C" }}>shell / body</span>
            <select value={shell} onChange={(e) => setShell(e.target.value)} style={selectStyle}>
              {parts.length === 0 && <option value={shell}>{partName(shell)}</option>}
              {parts.map((p) => (
                <option key={p.url} value={p.url}>{p.id} — {p.kind}</option>
              ))}
            </select>
          </label>
          <label style={{ flex: "1 1 320px" }}>
            <span style={{ fontSize: 11, color: "#57606C" }}>second part (stones, collar, ball)</span>
            <select value={studs ?? ""} onChange={(e) => setStuds(e.target.value || null)}
                    style={selectStyle}>
              <option value="">— none —</option>
              {parts.map((p) => (
                <option key={p.url} value={p.url}>{p.id} — {p.kind}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
