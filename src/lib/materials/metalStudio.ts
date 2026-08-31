"use client";

/**
 * The metal-component studio — three.js RoomEnvironment, PMREM-baked.
 *
 * This is the "Studio mode" the threejs-materials library (bernhard-42,
 * our physicallybased source) renders its metals under, and the neutral
 * procedural studio three's own material viewers use. Its area lights are
 * BROAD, so a cylindrical cap shows wide graded sheens instead of the
 * hard vertical stripe a narrow source paints (the failure Jordan called
 * out on the black and gold caps). Baked once per renderer and shared.
 */

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export function useMetalStudio(): THREE.Texture {
  const gl = useThree((s) => s.gl);
  const tex = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    // sigma 0.28: bakes the room PRE-BLURRED. Level-on, a cylinder catches
    // the room's several wall lights as hard line streaks (Jordan) — the
    // blur melts them into the same broad sheen the top-down view gets
    // from the big ceiling light, without losing energy.
    const t = pmrem.fromScene(new RoomEnvironment(), 0.28).texture;
    pmrem.dispose();
    return t;
  }, [gl]);
  useEffect(() => () => { tex.dispose(); }, [tex]);
  return tex;
}
