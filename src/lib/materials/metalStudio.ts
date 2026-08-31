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

export function useMetalStudio(): THREE.Texture {
  const gl = useThree((s) => s.gl);
  const tex = useMemo(() => {
    const data = new Float32Array(W * H * 4);
    for (let y = 0; y < H; y++) {
      const el = (0.5 - y / (H - 1)) * Math.PI;      // +pi/2 top .. -pi/2
      for (let x = 0; x < W; x++) {
        const az = (x / W) * 2 * Math.PI;
        // floor: dark, slightly warm-neutral
        let L = 0.055;
        // eye-level wrap band: gaussian in elevation, centred a touch above
        // the horizon — the level-view sheen, continuous around 360 deg
        L += 0.95 * Math.exp(-((el - 0.12) ** 2) / (2 * 0.20 ** 2));
        // ceiling dome — the overhead sheen Jordan approved
        L += 5.0 * smooth((el - 0.5) / 0.55);
        // ONE broad azimuthal lobe (accent toward the left-front) — the
        // lowest possible frequency, so it grades, never lines
        L *= 1 + 0.32 * Math.cos(az - Math.PI * 0.72);
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
  }, [gl]);
  useEffect(() => () => { tex.dispose(); }, [tex]);
  return tex;
}
