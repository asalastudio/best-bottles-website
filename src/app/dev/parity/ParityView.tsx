"use client";

/**
 * ParityView — the REFERENCE-PARITY rig.
 *
 * Renders ONE closure part, alone, framed and lit to match the product
 * photography in "20. Closures …", so a script can diff the render against
 * the PSD and report a NUMBER instead of an opinion. Jordan's standard:
 * "realism is non-negotiable … indistinguishable from the product in the
 * real world" — that is only enforceable if it is measured.
 *
 * It is deliberately NOT a pretty stage: white ground, orthographic
 * front-on camera, no entrance animation, no contact shadow. Every visual
 * difference that survives is a MATERIAL difference, which is the whole
 * point.
 *
 * Materials come from the SAME registry + environments the storefront
 * uses (createMaterial / tokens.json), so a pass here is a pass on the PDP.
 *
 *   /dev/parity?part=BB_CAP_DOTS_17415&mat=CAP_DOTS_PINK
 *              &studs=PART_STUD_RHINESTONE&shell=BB_CAP_17415
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, useTexture, useEnvironment, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import { useMetalStudioHdri } from "@/lib/materials/metalStudio";
import {
  loadTokens, getSpec, createMaterial, ensureCylindricalUV, needsCylindricalUV,
  type TokenFile,
} from "@/lib/materials/registry";

function Part({ url, matName, tokens, envs }: {
  url: string; matName: string; tokens: TokenFile;
  envs: Parameters<typeof createMaterial>[1];
}) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => {
    const s = gltf.scene.clone(true);
    const spec = getSpec(tokens, matName);
    const mat = createMaterial(spec, envs);
    s.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (needsCylindricalUV(spec)) ensureCylindricalUV(mesh);
      mesh.material = mat;
    });
    return s;
  }, [gltf, matName, tokens, envs]);
  return <primitive object={scene} />;
}

function Rig({ shell, part, studs, mat, zoom, tokens }: {
  shell: string; part: string | null; studs: string | null;
  mat: string; zoom: number; tokens: TokenFile;
}) {
  const metalEnv = useMetalStudioHdri();
  const plasticEnv = useEnvironment({ files: "/models/studio-browser.hdr" });
  const matteMaps = useTexture({
    normal: "/models/pbr/matte/normal.png",
    rough: "/models/pbr/matte/roughness.png",
  });
  const leatherMaps = useTexture({
    normal: "/models/pbr/leather/normal.png",
    rough: "/models/pbr/leather/roughness.png",
  });
  useEffect(() => {
    for (const [set, rpt] of [[matteMaps, 3], [leatherMaps, 2]] as const) {
      for (const t of Object.values(set)) {
        t.colorSpace = THREE.NoColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(rpt as number, 1);
        t.needsUpdate = true;
      }
    }
  }, [matteMaps, leatherMaps]);
  const envs = useMemo(
    () => ({ metalEnv, plasticEnv, maps: { matte: matteMaps, leather: leatherMaps } }),
    [metalEnv, plasticEnv, matteMaps, leatherMaps]);
  return (
    <>
      {/* the cap spans y -14.7..+12.3 mm; centre it and frame at the
          PSD's crop (cap ~76% of frame height) */}
      <OrthographicCamera makeDefault position={[0, 0, 0.2]}
                          near={0.001} far={1}
                          left={-zoom * 0.75} right={zoom * 0.75}
                          top={zoom} bottom={-zoom} />
      {/* KEY LIGHT (Jordan: "we need the light to reflect the shine of the
          stones"). HDRI alone leaves a metalness-0 dielectric flat — the
          reference photograph spans 169 luminance levels, our HDRI-only
          render spanned 18. A product-photography key from upper-front-left
          plus a soft opposite fill restores the falloff, and gives every
          faceted stone a hotspot to throw. */}
      <directionalLight position={[-0.9, 1.1, 1.4]} intensity={5.0} />
      <directionalLight position={[1.3, 0.3, 0.7]} intensity={0.55} />
      <ambientLight intensity={0.06} />
      <group position={[0, 0.0012, 0]}>
        <Part url={`/models/closures/${shell}.glb`} matName={mat}
              tokens={tokens} envs={envs} />
        {part && part !== shell && (
          <Part url={`/models/closures/${part}.glb`} matName={mat}
                tokens={tokens} envs={envs} />
        )}
        {studs && (
          <Part url={"/models/closures/BB_CAP_DOTS_17415.glb"} matName={studs}
                tokens={tokens} envs={envs} />
        )}
      </group>
    </>
  );
}

export default function ParityView() {
  const [tokens, setTokens] = useState<TokenFile | null>(null);
  useEffect(() => { loadTokens().then(setTokens).catch(() => {}); }, []);

  const q = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const shell = q.get("shell") ?? "BB_CAP_17415";
  const part = q.get("part");
  const mat = q.get("mat") ?? "CAP_SHINY_BLACK";
  const studs = q.get("studs");
  const zoom = Number(q.get("zoom") ?? "0.0178");

  if (!tokens) return <div style={{ padding: 24, font: "13px system-ui" }}>loading tokens…</div>;

  return (
    <div id="parity-stage" style={{ width: 552, height: 736, background: "#ffffff" }}>
      <Canvas
        gl={{ antialias: true, preserveDrawingBuffer: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              outputColorSpace: THREE.SRGBColorSpace }}
        style={{ width: 552, height: 736, background: "#ffffff" }}
        onCreated={({ gl }) => { gl.setClearColor("#ffffff", 1); }}
      >
        <Suspense fallback={null}>
          <Rig shell={shell} part={part} studs={studs} mat={mat}
               zoom={zoom} tokens={tokens} />
        </Suspense>
      </Canvas>
    </div>
  );
}
