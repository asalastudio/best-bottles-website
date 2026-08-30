import * as THREE from "three";

/**
 * A procedurally generated studio HDRI.
 *
 * WHY THIS EXISTS
 * ---------------
 * Glass has no look of its own - it renders its ENVIRONMENT. A bottle is a
 * lens, so what you see through it is a distorted image of the surroundings.
 * Lighting a bottle with a handful of flat-coloured Lightformer rectangles puts
 * exactly that in the glass: flat rectangles on black. No material parameter
 * fixes it, which is why glass tuning stalls before the material is even the
 * problem.
 *
 * Real product glass photography works because the bottle refracts a scrim with
 * STRUCTURE - gradients, falloff, a room. This builds that as a genuine
 * high-dynamic-range equirectangular map: emitters sit well above 1.0 (the key
 * at ~14, the rim pair at ~30) against a soft graded field, and every edge is
 * feathered rather than hard.
 *
 * Deliberately NOT an imported image:
 *  - a downloaded HDRI is a better photograph, but it is an external asset and
 *    a network dependency (drei's <Environment preset> fetches from a CDN,
 *    which a strict CSP blocks).
 *  - an AI-GENERATED environment image cannot work here at all: PNG/JPEG are
 *    8-bit LDR, so light sources clamp at 1.0 and there is no dynamic range for
 *    glass to pick up. Generated pixels make pictures, not light.
 *
 * Swap in a real photographed studio HDRI later if you want; this exists so the
 * environment is never the reason the glass looks wrong.
 */

type Emitter = {
  /** azimuth, radians. 0 = +Z (toward camera), grows counter-clockwise. */
  theta: number;
  /** polar, radians. 0 = straight up, PI = straight down. */
  phi: number;
  /** angular half-size */
  wTheta: number;
  wPhi: number;
  /** radiance - values well above 1 are the whole point */
  intensity: number;
  color: [number, number, number];
  /** 0 = hard edge, 1 = fully feathered */
  softness: number;
};

/** A soft-shouldered softbox. Feathered edges are what separate this from a
 *  Lightformer: a hard rectangle reads as a fake panel floating in the glass. */
const EMITTERS: Emitter[] = [
  // key — large, high, slightly front-left, the main modelling light
  { theta: -0.45, phi: 0.62, wTheta: 0.95, wPhi: 0.62, intensity: 14, color: [1, 0.99, 0.97], softness: 0.85 },
  // broad fills — the "room", keeps the body from going dead
  { theta: 2.05, phi: 1.02, wTheta: 1.15, wPhi: 0.85, intensity: 2.6, color: [0.93, 0.96, 1], softness: 1 },
  { theta: -2.15, phi: 1.0, wTheta: 1.05, wPhi: 0.8, intensity: 2.2, color: [1, 0.97, 0.93], softness: 1 },
  // the rim pair, behind and narrow — the bright vertical outline that reads
  // as "transparent". This is the single most identifiable feature of real
  // glass photography.
  { theta: Math.PI - 0.62, phi: 1.12, wTheta: 0.1, wPhi: 0.85, intensity: 30, color: [1, 1, 1], softness: 0.5 },
  { theta: -(Math.PI - 0.62), phi: 1.12, wTheta: 0.1, wPhi: 0.85, intensity: 26, color: [1, 1, 1], softness: 0.5 },
  // overhead scrim — soft top falloff down the shoulder
  { theta: 0, phi: 0.16, wTheta: Math.PI, wPhi: 0.3, intensity: 3.2, color: [1, 1, 1], softness: 1 },
];

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** shortest signed angular difference, so emitters can straddle the seam */
function dTheta(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function createStudioEnvironment(width = 1024): THREE.DataTexture {
  const height = width / 2;
  const data = new Uint16Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const phi = ((y + 0.5) / height) * Math.PI;      // 0 top -> PI bottom
    // Base field: a lit ceiling falling to a darker floor. Continuous, so the
    // glass always has a gradient to bend - never a flat void.
    const up = Math.cos(phi);                         // +1 up, -1 down
    const sky = 0.30 + 0.62 * smoothstep(-0.85, 0.95, up);
    const floor = 0.20 * smoothstep(0.1, -1.0, up);   // soft bounce underneath

    for (let x = 0; x < width; x++) {
      const theta = ((x + 0.5) / width) * 2 * Math.PI - Math.PI;

      let r = sky * 0.97 + floor * 1.0;
      let g = sky * 0.98 + floor * 0.96;
      let b = sky * 1.0 + floor * 0.9;

      for (const e of EMITTERS) {
        const nt = Math.abs(dTheta(theta, e.theta)) / e.wTheta;
        const np = Math.abs(phi - e.phi) / e.wPhi;
        const d = Math.hypot(nt, np);
        if (d >= 1) continue;
        const inner = 1 - e.softness;
        const f = e.softness <= 0 ? 1 : smoothstep(1, inner, d);
        r += e.intensity * e.color[0] * f;
        g += e.intensity * e.color[1] * f;
        b += e.intensity * e.color[2] * f;
      }

      const i = (y * width + x) * 4;
      data[i] = THREE.DataUtils.toHalfFloat(r);
      data[i + 1] = THREE.DataUtils.toHalfFloat(g);
      data[i + 2] = THREE.DataUtils.toHalfFloat(b);
      data[i + 3] = THREE.DataUtils.toHalfFloat(1);
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;   // radiance, not sRGB pixels
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
