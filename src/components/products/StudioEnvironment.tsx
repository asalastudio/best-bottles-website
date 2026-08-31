"use client";

/**
 * StudioEnvironment — THE single hybrid environment (candidate).
 *
 * Exactly ONE environment lights the whole scene: a neutral base HDRI for
 * full mirror coverage (metals must never orbit into a dead-black void, and
 * silver only stays silver under strictly neutral light), plus in-scene
 * emitters for the deliberate shapes — vertical strips for clear-glass edge
 * definition, an overhead softbox for cap tops and shoulders, and a broad
 * dim backlight so amber/cobalt transmit their colour instead of reading
 * near-black. Everything renders into ONE cubemap; per-finish variation
 * lives in material recipes (envMapIntensity, roughness…), never in
 * swapping environments.
 *
 * WHY THESE ARE NOT drei <Lightformer>s: a Lightformer rect is a hard-edged
 * quad, and a hard edge mirrors off a cylinder as an abrupt razor line —
 * the exact "fake" read Jordan flagged (and the artefact the lane already
 * documented in studioPresets.ts). The lane's fix is WIDER, FEATHERED
 * sources: each emitter here is a quad carrying a Gaussian falloff texture
 * (bright core, soft skirts), additively blended over the base HDRI, so its
 * reflection is a gradient that slides as the bottle turns.
 *
 * Base HDRI: Poly Haven "Studio Small 08" (CC0), 1k — lighting-only, never
 * shown as background — self-hosted at public/env/ (no runtime CDN
 * dependency). Same-family fallbacks if the look is rejected:
 * white_home_studio (more contrast), pav_studio_03 (softer).
 *
 * APPROVED 2026-08-31 (Jordan, at /dev/lighting-test: "the feathered
 * softbox is much better") — APPROVED_STUDIO points at "hybrid-small08",
 * so this IS the shipping environment for every glass colourway. The
 * EMITTERS values and the HDRI hash are pinned by material_lock.py: any
 * change here is drift until Jordan re-approves and the lock is rewritten
 * in the same commit. NOT allowed without a founder decision: a second
 * environment, per-material envMap overrides, or non-neutral
 * (coloured/warm) light colours.
 */

import { useMemo } from "react";
import { Environment } from "@react-three/drei";
import * as THREE from "three";

type Emitter = {
  /** direction from origin; the quad faces the origin */
  position: [number, number, number];
  /** quad size (world units in the env portal) */
  scale: [number, number];
  /** HDR peak brightness at the Gaussian core */
  intensity: number;
  /** Gaussian falloff (fraction of the quad's half-extent) per axis —
   *  smaller = tighter hot core, larger = softer wash */
  sigma: [number, number];
};

/** The four deliberate shapes. Descended from the handoff's Lightformer
 *  seeds (strips 3@z=+2 → 4.5@z=±1 → feathered); geometry unchanged. */
const EMITTERS: Emitter[] = [
  // left + right vertical strips: clear-glass edge highlights, graded
  // sheens (not stripes) in the metal caps
  { position: [-4, 2, 1], scale: [1.6, 8], intensity: 6, sigma: [0.3, 0.55] },
  { position: [4, 2, 1], scale: [1.6, 8], intensity: 6, sigma: [0.3, 0.55] },
  // overhead softbox: cap tops and bottle shoulders
  { position: [0, 6, 0], scale: [6, 3], intensity: 2.5, sigma: [0.45, 0.45] },
  // broad dim backlight: amber/cobalt transmit instead of reading black
  { position: [0, 2, -6], scale: [8, 6], intensity: 1.4, sigma: [0.55, 0.55] },
];

/** Per-axis Gaussian × raised-cosine window, baked to a sprite. The window
 *  forces EXACT zero at the quad rim whatever the sigma, so no emitter can
 *  ever print a hard boundary. 8-bit is plenty after the 512px cubemap +
 *  PMREM blur. */
function makeFeatherTexture(sigma: [number, number]): THREE.Texture {
  const SIZE = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const img = ctx.createImageData(SIZE, SIZE);
  const window1 = (t: number) => {
    // 1 inside |t|<0.7, cosine roll to 0 at |t|=1
    const a = (Math.min(1, Math.abs(t)) - 0.7) / 0.3;
    return a <= 0 ? 1 : 0.5 + 0.5 * Math.cos(Math.PI * a);
  };
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = (x / (SIZE - 1)) * 2 - 1;
      const v = (y / (SIZE - 1)) * 2 - 1;
      const g =
        Math.exp(-(u * u) / (2 * sigma[0] * sigma[0])) *
        Math.exp(-(v * v) / (2 * sigma[1] * sigma[1])) *
        window1(u) * window1(v);
      const i = (y * SIZE + x) * 4;
      const b = Math.round(255 * g);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = b;
      img.data[i + 3] = b;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function SoftEmitter({ emitter }: { emitter: Emitter }) {
  const { position, scale, intensity, sigma } = emitter;
  const material = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map: makeFeatherTexture(sigma),
      transparent: true,
      blending: THREE.AdditiveBlending, // adds light over the base HDRI
      depthWrite: false,
      side: THREE.FrontSide,
      toneMapped: false,
    });
    m.color.setScalar(intensity); // HDR: the env portal renders half-float
    return m;
    // sigma is a tuple literal from EMITTERS — stringify for stable deps
  }, [intensity, sigma[0], sigma[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <mesh position={position} scale={[scale[0], scale[1], 1]}
          onUpdate={(self) => self.lookAt(0, 0, 0)}>
      <planeGeometry />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

export function StudioEnvironment() {
  return (
    <Environment files="/env/studio_small_08_1k.hdr" resolution={512}>
      {EMITTERS.map((e, i) => (
        <SoftEmitter key={i} emitter={e} />
      ))}
    </Environment>
  );
}
