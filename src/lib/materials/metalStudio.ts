"use client";

/**
 * The metal-component studio — procedural equirect, PMREM-baked.
 *
 * v2 (2026-08-31). RoomEnvironment (threejs-materials "Studio mode") gave
 * the approved overhead sheen — its one big CEILING light — but level-on,
 * a cylinder caught its several separate WALL lights as vertical line
 * streaks, and no blur fully melts discrete sources (Jordan: "the lines
 * create a pretty bad pattern... we want the same sheen as looking down").
 *
 * So the walls are gone. This environment has exactly two ideas:
 *   1. a big soft ceiling dome        -> the approved overhead sheen;
 *   2. a CONTINUOUS 360-degree band at eye level whose only azimuthal
 *      variation is one broad cosine lobe -> a level camera sees a single
 *      unbroken gradient. A smooth band cannot stripe, by construction.
 * Dark floor keeps contrast (ACES washes hue out of clipped highlights).
 *
 * Baked once per renderer and shared by every metal/glossy part.
 */

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

const W = 512, H = 256;

function smooth(x: number) {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** Every dial of the studio, exposed so Jordan can tune the shine in the
 *  lab the way the clear glass was tuned — then the numbers get locked. */
export type MetalStudioParams = {
  /** dark ground level */
  floor: number;
  /** eye-level wrap band: intensity, centre elevation (rad), gaussian width */
  band: number;
  bandEl: number;
  bandWidth: number;
  /** overhead dome intensity */
  ceiling: number;
  /** single broad azimuthal accent: strength 0..1 and direction (deg) */
  lobe: number;
  lobeDeg: number;
};

export const METAL_STUDIO_DEFAULTS: MetalStudioParams = {
  // Glossy black is CONTRAST, not brightness: a uniform hot band washed
  // the black cap to grey (band 2.2 experiment), and a dim band (0.95)
  // vanished into the 4% dielectric reflection. So the band is moderate
  // and the azimuthal lobe is strong: one flank carries a broad hot sheen
  // (~3x) while the far side stays near-black — piano black on a
  // cylinder, and on metals a graded accent that cannot stripe.
  floor: 0.055, band: 1.5, bandEl: 0.12, bandWidth: 0.24,
  ceiling: 5.0, lobe: 0.85, lobeDeg: 130,
};

export function useMetalStudio(params?: Partial<MetalStudioParams>): THREE.Texture {
  const gl = useThree((s) => s.gl);
  const p = { ...METAL_STUDIO_DEFAULTS, ...(params ?? {}) };
  const { floor, band, bandEl, bandWidth, ceiling, lobe, lobeDeg } = p;
  const tex = useMemo(() => {
    const data = new Float32Array(W * H * 4);
    const lobeRad = (lobeDeg * Math.PI) / 180;
    for (let y = 0; y < H; y++) {
      const el = (0.5 - y / (H - 1)) * Math.PI;      // +pi/2 top .. -pi/2
      for (let x = 0; x < W; x++) {
        const az = (x / W) * 2 * Math.PI;
        let L = floor;
        // continuous 360-degree band — a smooth band cannot stripe
        L += band * Math.exp(-((el - bandEl) ** 2) / (2 * bandWidth ** 2));
        // ceiling dome — the overhead sheen
        L += ceiling * smooth((el - 0.5) / 0.55);
        // one broad azimuthal lobe — grades, never lines
        L *= 1 + lobe * Math.cos(az - lobeRad);
        const i = (y * W + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = L;
        data[i + 3] = 1;
      }
    }
    const dt = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
    dt.mapping = THREE.EquirectangularReflectionMapping;
    dt.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(gl);
    const t = pmrem.fromEquirectangular(dt).texture;
    pmrem.dispose();
    dt.dispose();
    return t;
  }, [gl, floor, band, bandEl, bandWidth, ceiling, lobe, lobeDeg]);
  useEffect(() => () => { tex.dispose(); }, [tex]);
  return tex;
}
