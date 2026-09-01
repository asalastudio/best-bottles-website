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

import { memo, useMemo } from "react";
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
 *  seeds, feathered, then LIFTED ABOVE THE BOTTLE per the lane law
 *  ([[glass-env-no-horizon-sources]]): a source at bottle height reflects
 *  on a cylinder at the SILHOUETTE for whichever camera azimuth faces away
 *  from it — the broad horizon backlight wrapped amber/cobalt in a
 *  full-height white halo the moment the orbit stopped near front
 *  (Jordan), and horizon strips do the same at their own azimuths. All
 *  punch now comes from elevation: edge/shoulder grades stay, full-height
 *  wraps cannot form at ANY orbit angle. */
const EMITTERS: Emitter[] = [
  // ONE KEY. That is the whole rig now (Jordan: "we need more simple key
  // lighting", and before that "glossy is enough with maybe just one
  // keylight").
  //
  // THE REAR EMITTER IS GONE, and it was not a judgement call — it was
  // arithmetic. A cylinder reflects environment azimuth 2*psi, so a source at
  // azimuth A lands at psi = A/2, and psi = +/-90 IS THE SILHOUETTE. The rear
  // emitter sat at azimuth exactly 180.0, which maps to psi +/-90 and NOWHERE
  // ELSE: it could only ever draw the outline. That is the "line halo effect
  // around it" Jordan flagged, and no amount of softening it would have
  // helped, because its position was the defect.
  //
  // It was there to backlight amber and cobalt so they transmit rather than
  // read black. That job now falls to the base HDRI, which still carries
  // energy behind the bottle. If dark glass goes dead as a result, the fix is
  // a rear source placed HIGH and kept SHORT in elevation — the silhouette
  // mirrors azimuth 180 at HORIZON elevation, so a high backlight still
  // refracts through the body without being mirrored at the rim. Do not
  // simply put this one back.
  { position: [-4.2, 2.4, 3.6], scale: [7.0, 13.0], intensity: 2.2, sigma: [1.35, 1.5] },
  // REAR EMITTER, RESTORED — and the reason it can come back matters.
  //
  // It was deleted because azimuth 180 maps to psi +/-90, the silhouette,
  // and it was therefore the obvious cause of the rim halo. It was not.
  // Removing it changed the rim not at all; the halo was a thickness scalar
  // set to the body DIAMETER instead of the wall, and fixing that removed
  // the rim in one frame. So the arithmetic was right and the attribution
  // was wrong — a source CAN land on the silhouette without being what you
  // are looking at.
  //
  // Deleting it did cost the thing it was there for: amber and cobalt
  // transmit what is BEHIND them, and with nothing behind, amber read almost
  // black. Absorption was ruled out as the cause first — opening
  // attenuationDistance to 0.0055 (76% transmitted) barely moved it, which
  // is what proves this is a lighting problem and not a material one.
  { position: [0, 4.6, -6], scale: [17.0, 9.0], intensity: 0.85, sigma: [1.5, 1.4] },
];

/** Per-axis Gaussian × raised-cosine window, baked to a FLOAT sprite. The
 *  window forces EXACT zero at the quad rim whatever the sigma, so no
 *  emitter can ever print a hard boundary; float texels mean the ×6 HDR
 *  intensity can never quantize the gradient into contour bands. */
function makeFeatherTexture(sigma: [number, number]): THREE.Texture {
  const SIZE = 256;
  const data = new Float32Array(SIZE * SIZE * 4);
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
      data[i] = data[i + 1] = data[i + 2] = g;
      data[i + 3] = g;
    }
  }
  const tex = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat, THREE.FloatType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
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

/** memo + memoized children: the environment must be INERT to parent
 *  re-renders. Without this, any state flip in the viewer (the first
 *  click sets `touched`) recreated the children array, drei's Environment
 *  portal re-fired its bake effect, and the frames={1} re-bake caught the
 *  portal with its HDRI background unset — the scene snapped to "four
 *  bright quads over black": bottle goes dark, halo wraps it (Jordan's
 *  wet-bottle-until-I-click bug). One mount, one bake, ever. */
export const StudioEnvironment = memo(function StudioEnvironment() {
  const emitters = useMemo(
    () => EMITTERS.map((e, i) => <SoftEmitter key={i} emitter={e} />),
    [],
  );
  return (
    // frames={1}: bake the cubemap ONCE — the environment is static, so
    // nothing about the lighting can shimmer or re-resolve frame to frame.
    // The HDRI is the PEAK-CLAMPED variant (luminance capped at 24,
    // hue-preserving): the raw Poly Haven file peaks at ~97 and its hot
    // bare-fixture texels rendered as firefly speckle — "miniature ants"
    // (Jordan) — on the glossy glass. Pristine original kept alongside.
    <Environment files="/env/studio_small_08_1k_peak24.hdr" resolution={512} frames={1}>
      {emitters}
    </Environment>
  );
});
