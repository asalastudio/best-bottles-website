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
import { useEnvironment } from "@react-three/drei";
import * as THREE from "three";

/** THE metal environment: a REAL studio HDRI — Poly Haven
 *  monochrome_studio_02 (CC0), Jordan's pick ("we do need an HDRI").
 *  Real softboxes give metals genuine structured reflections that no
 *  procedural band ever matched; monochrome keeps silver silver. The
 *  procedural generator below remains as a tunable fallback. */
export function useMetalStudioHdri(): THREE.Texture {
  return useEnvironment({ files: "/models/studio-mono.hdr" });
}

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
  /** KEY SOFTBOX — a visible, fully feathered area source. This is what
   *  the surface mirrors as "the studio": a tall soft window of light.
   *  Feathered gaussian edges = a graded sheen, never a hard stripe. */
  key: number;
  keyDeg: number;
  keyWidth: number;   // azimuthal gaussian sigma, degrees
  /** counter softbox opposite-ish the key, dimmer, for the second sheen */
  counter: number;
};

export const METAL_STUDIO_DEFAULTS: MetalStudioParams = {
  // v3 (Jordan: "we need to have the studio lighting reflect in the black
  // trim... see that nice reflection in the gold"): shine is a LIGHT YOU
  // CAN SEE in the surface. A featureless band lights a metal without
  // giving it anything to mirror; a narrow source stripes. So: two BIG
  // feathered softboxes (key left-front, dim counter right-rear) over a
  // moderate band + ceiling. Gaussian edges keep every sheen graded.
  floor: 0.055, band: 0.8, bandEl: 0.12, bandWidth: 0.24,
  ceiling: 5.0, lobe: 0.25, lobeDeg: 130,
  key: 6.0, keyDeg: 315, keyWidth: 26, counter: 2.2,
};

export function useMetalStudio(params?: Partial<MetalStudioParams>): THREE.Texture {
  const gl = useThree((s) => s.gl);
  const p = { ...METAL_STUDIO_DEFAULTS, ...(params ?? {}) };
  const { floor, band, bandEl, bandWidth, ceiling, lobe, lobeDeg,
          key, keyDeg, keyWidth, counter } = p;
  const tex = useMemo(() => {
    const data = new Float32Array(W * H * 4);
    const lobeRad = (lobeDeg * Math.PI) / 180;
    const keyRad = (keyDeg * Math.PI) / 180;
    const counterRad = keyRad + Math.PI * 0.92;
    const sigK = (keyWidth * Math.PI) / 180;
    const dAz = (a: number, b: number) => {
      const d = Math.abs(a - b) % (2 * Math.PI);
      return d > Math.PI ? 2 * Math.PI - d : d;
    };
    for (let y = 0; y < H; y++) {
      // WebGL UV origin is BOTTOM-left: row 0 = v0 = the sphere's BOTTOM.
      // (The first cut had this flipped — ceiling underground, key softbox
      // below the floor — which is why no metal ever showed its shine.)
      const el = (y / (H - 1) - 0.5) * Math.PI;      // -pi/2 bottom .. +pi/2
      for (let x = 0; x < W; x++) {
        const az = (x / W) * 2 * Math.PI;
        let L = floor;
        // continuous 360-degree band — a smooth band cannot stripe
        L += band * Math.exp(-((el - bandEl) ** 2) / (2 * bandWidth ** 2));
        // ceiling dome — the overhead sheen
        L += ceiling * smooth((el - 0.5) / 0.55);
        // KEY softbox: tall feathered window, the reflection you SEE
        L += key * Math.exp(-(dAz(az, keyRad) ** 2) / (2 * sigK ** 2))
                 * Math.exp(-((el - 0.22) ** 2) / (2 * 0.34 ** 2));
        // counter softbox: dimmer, wider, opposite-ish
        L += counter * Math.exp(-(dAz(az, counterRad) ** 2) / (2 * (sigK * 1.5) ** 2))
                     * Math.exp(-((el - 0.15) ** 2) / (2 * 0.3 ** 2));
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
  }, [gl, floor, band, bandEl, bandWidth, ceiling, lobe, lobeDeg,
      key, keyDeg, keyWidth, counter]);
  useEffect(() => () => { tex.dispose(); }, [tex]);
  return tex;
}
