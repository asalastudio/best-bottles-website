"use client";

/**
 * StudioView — the tuning studio. Jordan drives; the app hands back JSON.
 *
 * Everything that decides how a part looks is a control here: the full
 * MeshPhysicalMaterial set, the key/fill/ambient rig, environment choice
 * and intensity. The canonical reference sits beside the render at the
 * same size, and the parity numbers update live — so "does it match?" is
 * answered on screen, by eye AND by measurement, before anything is saved.
 *
 * Two findings from the pink-cap session are wired in as first-class
 * controls, because they turned out to matter more than base colour:
 *   - envMapIntensity FILLS the shadows a key light carves. A dielectric
 *     at env 1.35 renders flat no matter how strong the key is.
 *   - a specular lobe below one pixel is invisible. Roughness is the
 *     sparkle control on small stones, not intensity.
 *
 * "Copy token JSON" emits exactly the shape materials.json expects. It
 * never writes: values reach the registry only when Jordan hands the JSON
 * over, which is what keeps the locked set trustworthy.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useGLTF, useTexture, useEnvironment, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import { useMetalStudioHdri } from "@/lib/materials/metalStudio";

type Vals = {
  color: string; roughness: number; metalness: number;
  clearcoat: number; clearcoatRoughness: number; ior: number;
  specularIntensity: number; envMapIntensity: number; transmission: number;
  env: "metal" | "tent";
};
type Lights = {
  keyI: number; keyX: number; keyY: number; keyZ: number;
  fillI: number; ambI: number; exposure: number;
};

const DEFAULT_VALS: Vals = {
  color: "#e0a8c2", roughness: 0.34, metalness: 0, clearcoat: 0.35,
  clearcoatRoughness: 0.06, ior: 1.5, specularIntensity: 1.2,
  envMapIntensity: 0.12, transmission: 0, env: "metal",
};
const DEFAULT_LIGHTS: Lights = {
  keyI: 5.0, keyX: -0.9, keyY: 1.1, keyZ: 1.4,
  fillI: 0.55, ambI: 0.06, exposure: 1.0,
};

/* ------------------------------------------------------------------ rig */

function Part({ url, vals, envs }: {
  url: string; vals: Vals;
  envs: { metalEnv: THREE.Texture | null; plasticEnv: THREE.Texture | null };
}) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);
  useEffect(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(vals.color),
      roughness: vals.roughness, metalness: vals.metalness,
      clearcoat: vals.clearcoat, clearcoatRoughness: vals.clearcoatRoughness,
      ior: vals.ior, transmission: vals.transmission,
    });
    m.specularIntensity = vals.specularIntensity;
    m.envMap = vals.env === "metal" ? envs.metalEnv : envs.plasticEnv;
    m.envMapIntensity = vals.envMapIntensity;
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.material = m;
    });
    return () => m.dispose();
  }, [scene, vals, envs]);
  return <primitive object={scene} />;
}

function Rig({ shell, studs, vals, studVals, lights, zoom, onFrame }: {
  shell: string; studs: string | null; vals: Vals; studVals: Vals;
  lights: Lights; zoom: number; onFrame: (canvas: HTMLCanvasElement) => void;
}) {
  const metalEnv = useMetalStudioHdri();
  const plasticEnv = useEnvironment({ files: "/models/studio-browser.hdr" });
  const envs = useMemo(() => ({ metalEnv, plasticEnv }), [metalEnv, plasticEnv]);
  const { gl } = useThree();
  useEffect(() => { gl.toneMappingExposure = lights.exposure; }, [gl, lights.exposure]);
  // hand the canvas up so the panel can measure it
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
      <directionalLight position={[1.3, 0.3, 0.7]} intensity={lights.fillI} />
      <ambientLight intensity={lights.ambI} />
      <group position={[0, 0.0012, 0]}>
        <Part url={`/models/closures/${shell}.glb`} vals={vals} envs={envs} />
        {studs && <Part url={`/models/closures/${studs}.glb`} vals={studVals} envs={envs} />}
      </group>
    </>
  );
}

/* --------------------------------------------------------------- panel */

function Slider({ label, value, min, max, step, onChange, hint }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; hint?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <span style={{ display: "flex", justifyContent: "space-between",
                     fontSize: 11, color: "#57606C", marginBottom: 3 }}>
        <span>{label}{hint && <em style={{ color: "#9A9590", fontStyle: "normal" }}> · {hint}</em>}</span>
        <b style={{ color: "#1D1D1F", fontVariantNumeric: "tabular-nums" }}>{value.toFixed(3)}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={(e) => onChange(parseFloat(e.target.value))}
             style={{ width: "100%", accentColor: "#C5A065" }} />
    </label>
  );
}

export default function StudioView() {
  const [refs, setRefs] = useState<Array<{ slug: string; image: string; colourway: string; component: string | null }>>([]);
  const [refSlug, setRefSlug] = useState("12-17-415-roll-on-cproll17-415pnkdot");
  const [shell, setShell] = useState("BB_CAP_17415");
  const [studs, setStuds] = useState<string | null>("BB_CAP_DOTS_17415");
  const [target, setTarget] = useState<"shell" | "studs">("shell");
  const [vals, setVals] = useState<Vals>(DEFAULT_VALS);
  const [studVals, setStudVals] = useState<Vals>({
    ...DEFAULT_VALS, color: "#2a2f2d", roughness: 0.07, clearcoat: 1,
    clearcoatRoughness: 0.02, ior: 2.4, specularIntensity: 5, envMapIntensity: 1.6,
  });
  const [lights, setLights] = useState<Lights>(DEFAULT_LIGHTS);
  const [zoom, setZoom] = useState(0.0178);
  const [metrics, setMetrics] = useState<Record<string, number | string> | null>(null);
  const [refMetrics, setRefMetrics] = useState<Record<string, number> | null>(null);
  const [copied, setCopied] = useState(false);
  const refImg = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    fetch("/references/index.json").then((r) => r.json())
      .then((j) => setRefs(j.references ?? [])).catch(() => {});
  }, []);

  const active = target === "shell" ? vals : studVals;
  const setActive = (v: Vals) => (target === "shell" ? setVals(v) : setStudVals(v));
  const upd = (k: keyof Vals, v: number | string) =>
    setActive({ ...active, [k]: v } as Vals);

  /** measure the render exactly as parity-report does */
  const measure = (canvas: HTMLCanvasElement) => {
    const off = document.createElement("canvas");
    off.width = canvas.width; off.height = canvas.height;
    const ctx = off.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0);
    const d = ctx.getImageData(0, 0, off.width, off.height).data;
    const px: number[][] = [];
    let bright = 0, dark = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
      if (a < 10) continue;
      if (r > 248 && g > 248 && b > 248) continue;
      const l = (r + g + b) / 3;
      px.push([r, g, b, l]);
      if (l > 235) bright++;
      if (l < 110) dark++;
    }
    if (!px.length) return;
    px.sort((p, q) => p[3] - q[3]);
    const at = (f: number) => px[Math.max(0, Math.min(px.length - 1, Math.round(px.length * f)))];
    const hex = (a: number[]) =>
      "#" + a.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    setMetrics({
      covered: px.length,
      midtone: hex(at(0.5)),
      range: Math.round(at(0.95)[3] - at(0.05)[3]),
      darkPct: +(100 * dark / px.length).toFixed(2),
      brightPct: +(100 * bright / px.length).toFixed(2),
    });
  };

  /** measure the reference image the same way, in-browser */
  const measureRef = () => {
    const img = refImg.current;
    if (!img || !img.complete || !img.naturalWidth) return;
    const off = document.createElement("canvas");
    off.width = img.naturalWidth; off.height = img.naturalHeight;
    const ctx = off.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, off.width, off.height).data;
    const px: number[][] = [];
    let bright = 0, dark = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const l = (r + g + b) / 3;
      if (l > 248) continue;
      px.push([r, g, b, l]);
      if (l > 235) bright++;
      if (l < 110) dark++;
    }
    if (!px.length) return;
    px.sort((p, q) => p[3] - q[3]);
    const at = (f: number) => px[Math.max(0, Math.min(px.length - 1, Math.round(px.length * f)))];
    setRefMetrics({
      range: Math.round(at(0.95)[3] - at(0.05)[3]),
      darkPct: +(100 * dark / px.length).toFixed(2),
      brightPct: +(100 * bright / px.length).toFixed(2),
      midR: at(0.5)[0], midG: at(0.5)[1], midB: at(0.5)[2],
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
      ior: v.ior, transmission: v.transmission,
      specularIntensity: v.specularIntensity,
      envMapIntensity: v.envMapIntensity, env: v.env,
    });
    return JSON.stringify({
      tunedBy: "jordan", tunedAt: new Date().toISOString().slice(0, 10),
      reference: refSlug, lights, zoom,
      shell: one(vals), studs: studs ? one(studVals) : null,
    }, null, 2);
  };

  const cell = { background: "#FDFBF8", border: "1px solid rgba(212,197,169,.55)",
                 borderRadius: 4, padding: 12 } as const;
  const num = (v: number | string | undefined) =>
    v === undefined ? "—" : typeof v === "number" ? v.toLocaleString() : v;

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
                  style={{ width: 300, marginTop: 8, font: "inherit", fontSize: 11, padding: 4 }}>
            {refs.length === 0 && <option value={refSlug}>{refSlug}</option>}
            {refs.map((r) => (
              <option key={r.slug} value={r.slug}>{r.colourway} — {r.component ?? "?"}</option>
            ))}
          </select>
        </div>

        {/* render */}
        <div style={cell}>
          <p style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase",
                      color: "#57606C", fontWeight: 600, marginBottom: 6 }}>Render</p>
          <div style={{ width: 300, height: 400, background: "#fff" }}>
            <Canvas
              gl={{ antialias: true, preserveDrawingBuffer: true,
                    toneMapping: THREE.ACESFilmicToneMapping,
                    outputColorSpace: THREE.SRGBColorSpace }}
              style={{ width: 300, height: 400 }}
              onCreated={({ gl }) => gl.setClearColor("#ffffff", 1)}
            >
              <Suspense fallback={null}>
                <Rig shell={shell} studs={studs} vals={vals} studVals={studVals}
                     lights={lights} zoom={zoom} onFrame={measure} />
              </Suspense>
            </Canvas>
          </div>
          {/* live parity */}
          <table style={{ width: 300, marginTop: 8, fontSize: 11,
                          fontVariantNumeric: "tabular-nums", borderCollapse: "collapse" }}>
            <tbody>
              {[["tonal range", metrics?.range, refMetrics?.range],
                ["dark %", metrics?.darkPct, refMetrics?.darkPct],
                ["bright %", metrics?.brightPct, refMetrics?.brightPct],
                ["midtone", metrics?.midtone, refMetrics
                  ? "#" + [refMetrics.midR, refMetrics.midG, refMetrics.midB]
                      .map((v) => Math.round(v).toString(16).padStart(2, "0")).join("") : undefined],
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
            yours · reference
          </p>
        </div>

        {/* controls */}
        <div style={{ ...cell, width: 320 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {(["shell", "studs"] as const).map((t) => (
              <button key={t} onClick={() => setTarget(t)}
                      style={{ flex: 1, padding: "6px 8px", fontSize: 11, fontWeight: 600,
                               borderRadius: 3, cursor: "pointer",
                               border: target === t ? "1px solid #1D1D1F" : "1px solid #D4C5A9",
                               background: target === t ? "#1D1D1F" : "#fff",
                               color: target === t ? "#fff" : "#57606C" }}>
                {t === "shell" ? "Shell" : "Stones"}
              </button>
            ))}
          </div>

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
                  value={active.metalness} min={0} max={1} step={1}
                  onChange={(v) => upd("metalness", v)} />
          <Slider label="envMapIntensity" hint="fills the key's shadows"
                  value={active.envMapIntensity} min={0} max={4} step={0.01}
                  onChange={(v) => upd("envMapIntensity", v)} />
          <Slider label="clearcoat" value={active.clearcoat} min={0} max={1} step={0.01}
                  onChange={(v) => upd("clearcoat", v)} />
          <Slider label="clearcoatRoughness" value={active.clearcoatRoughness}
                  min={0} max={1} step={0.005}
                  onChange={(v) => upd("clearcoatRoughness", v)} />
          <Slider label="specularIntensity" value={active.specularIntensity}
                  min={0} max={6} step={0.05}
                  onChange={(v) => upd("specularIntensity", v)} />
          <Slider label="ior" value={active.ior} min={1} max={2.8} step={0.01}
                  onChange={(v) => upd("ior", v)} />
          <Slider label="transmission" value={active.transmission} min={0} max={1} step={0.01}
                  onChange={(v) => upd("transmission", v)} />

          <div style={{ display: "flex", gap: 6, margin: "6px 0 14px" }}>
            {(["metal", "tent"] as const).map((e) => (
              <button key={e} onClick={() => upd("env", e)}
                      style={{ flex: 1, padding: "5px 8px", fontSize: 11, fontWeight: 600,
                               borderRadius: 3, cursor: "pointer",
                               border: active.env === e ? "1px solid #1D1D1F" : "1px solid #D4C5A9",
                               background: active.env === e ? "#1D1D1F" : "#fff",
                               color: active.env === e ? "#fff" : "#57606C" }}>
                {e === "metal" ? "Studio env" : "Tent env"}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase",
                      color: "#8B6F42", fontWeight: 600, margin: "12px 0 8px" }}>Lighting</p>
          <Slider label="key" value={lights.keyI} min={0} max={12} step={0.1}
                  onChange={(v) => setLights({ ...lights, keyI: v })} />
          <Slider label="key x" value={lights.keyX} min={-3} max={3} step={0.05}
                  onChange={(v) => setLights({ ...lights, keyX: v })} />
          <Slider label="key y" value={lights.keyY} min={-3} max={3} step={0.05}
                  onChange={(v) => setLights({ ...lights, keyY: v })} />
          <Slider label="key z" value={lights.keyZ} min={-3} max={3} step={0.05}
                  onChange={(v) => setLights({ ...lights, keyZ: v })} />
          <Slider label="fill" value={lights.fillI} min={0} max={4} step={0.05}
                  onChange={(v) => setLights({ ...lights, fillI: v })} />
          <Slider label="ambient" value={lights.ambI} min={0} max={1} step={0.01}
                  onChange={(v) => setLights({ ...lights, ambI: v })} />
          <Slider label="exposure" value={lights.exposure} min={0.2} max={2.5} step={0.01}
                  onChange={(v) => setLights({ ...lights, exposure: v })} />
          <Slider label="zoom" value={zoom} min={0.008} max={0.05} step={0.0005}
                  onChange={setZoom} />

          <button onClick={() => {
                    navigator.clipboard?.writeText(tokenJson());
                    setCopied(true); setTimeout(() => setCopied(false), 1600);
                  }}
                  style={{ width: "100%", marginTop: 12, padding: "11px 8px",
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

      <details style={{ marginTop: 16, maxWidth: 980 }}>
        <summary style={{ cursor: "pointer", fontSize: 12, color: "#57606C" }}>Parts</summary>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <input value={shell} onChange={(e) => setShell(e.target.value)}
                 placeholder="shell GLB" style={{ font: "inherit", fontSize: 11, padding: 5, width: 260 }} />
          <input value={studs ?? ""} onChange={(e) => setStuds(e.target.value || null)}
                 placeholder="studs GLB (optional)" style={{ font: "inherit", fontSize: 11, padding: 5, width: 260 }} />
        </div>
      </details>
    </div>
  );
}
