"use client";

/**
 * StudioEnvironment — THE single environment: one universal light cone.
 *
 * Exactly ONE environment lights the whole scene, and it is now a single
 * continuous source rather than a photographed room with emitters composited
 * over it. Per-finish variation lives in material recipes (roughness,
 * envMapIntensity…), never in swapping environments or per-material envMaps.
 *
 * WHY THERE IS NO JSX HERE ANY MORE
 * ---------------------------------
 * This component used to mount feathered quads over a photographed HDRI.
 * Jordan, on the fine-mist render: "There are too many lines. It needs to be
 * a softbox, not individual. NO CARDS." Both halves were printing lines:
 *
 *   - the QUADS were small bright rectangles in a dark room. Feathering
 *     softens a quad's EDGE, but the quad is still discrete, so a cylinder
 *     mirrors it as a band. There is no feather value that fixes a source
 *     being small — five rigs proved that before this one.
 *   - the PHOTOGRAPHED HDRI underneath (Poly Haven studio_small_08) carried a
 *     real ceiling: bare fixtures, a window, a doorway. Each is its own bright
 *     patch and its own line. Deleting the quads alone would have left those,
 *     which is why the base had to go too.
 *
 * THE FIX IS A SHAPE, NOT A VALUE (Jordan: "think of it like a light cone —
 * it really is"). The tabletop rig for shiny things is a cone of diffusion
 * standing around the subject, open at the bottom, lit from outside; you use
 * it on chrome and glass precisely because the fabric integrates every lamp
 * behind it into one continuous wall. Stated as a rule:
 *
 *     a source that is CONTINUOUS IN AZIMUTH has no azimuth to be AT.
 *
 * A cylinder mirrors a vertical slice of the world, so a discrete source shows
 * up as a line at whichever orbit angle faces it. Wrap the source through all
 * 360 deg and no such angle exists — the lines cannot return at ANY orbit
 * position, because nothing discrete remains to reflect. Softness stops being
 * a number to tune and becomes a property of the geometry.
 *
 * The cone is generated, not painted, by
 * pipeline/paper-doll-3d/scripts/make_universal_softbox.py — read its header
 * for the shape parameters (wall elevation grade, the single cosine key, the
 * sweep) and the reasoning behind each. Its --check mode is the acceptance
 * test: it counts how many separate bright regions a cylinder could mirror.
 * This file passes at ONE region, 360 deg wide — i.e. no discrete source at
 * all. Any future rig must pass the same check before it ships.
 *
 * Level is calibrated to the environment it replaced (0.746 sin-weighted mean
 * radiance) so that the 45 material recipes — all of which were just reset to
 * envMapIntensity 1.0 — keep meaning what they mean. A brighter world would
 * silently re-tune every one of them.
 *
 * NOT allowed without a founder decision: a second environment, per-material
 * envMap overrides, non-neutral (coloured/warm) light on the cone wall, or
 * re-introducing in-scene emitters. material_lock.py pins the HDRI hash and
 * the cone parameters; changing them is drift until Jordan re-approves and the
 * lock is rewritten in the same commit.
 */

import { memo } from "react";
import { Environment } from "@react-three/drei";

export const StudioEnvironment = memo(function StudioEnvironment() {
  return (
    // frames={1}: bake the cubemap ONCE. The environment is static, so nothing
    // about the lighting can shimmer or re-resolve frame to frame.
    //
    // Having no children is also what retires the rebake race this component
    // was memo()-wrapped for: a parent re-render used to rebuild the emitter
    // array, drei's portal re-fired its bake effect, and the frames={1} rebake
    // caught the portal mid-setup — the scene snapped to bright quads over
    // black (bottle dark, halo around it) on the first click. With a bare HDRI
    // there is no child array to rebuild. memo stays as belt and braces.
    <Environment
      files="/env/studio-universal-softbox.hdr"
      resolution={512}
      frames={1}
    />
  );
});
