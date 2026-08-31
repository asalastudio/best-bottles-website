"use client";

/**
 * StudioEnvironment — THE single hybrid environment (candidate).
 *
 * Exactly ONE environment lights the whole scene: a neutral base HDRI for
 * full mirror coverage (metals must never orbit into a dead-black void, and
 * silver only stays silver under strictly neutral light), plus Lightformers
 * for the deliberate shapes — vertical strips for clear-glass edge
 * definition, an overhead softbox for cap tops and shoulders, and a broad
 * dim backlight so amber/cobalt transmit their colour instead of reading
 * near-black. Everything renders into ONE cubemap; per-finish variation
 * lives in material recipes (envMapIntensity, roughness…), never in
 * swapping environments.
 *
 * Base HDRI: Poly Haven "Studio Small 08" (CC0), 1k — lighting-only, never
 * shown as background — self-hosted at public/env/ (no runtime CDN
 * dependency). Same-family fallbacks if the look is rejected:
 * white_home_studio (more contrast), pav_studio_03 (softer).
 *
 * Every Lightformer number below is a SEED — tuning intensity/position/
 * scale, or adding/removing a former, is expected; commit tuned values
 * here (no magic local state). NOT allowed without a founder decision:
 * a second environment, per-material envMap overrides, or non-neutral
 * (coloured/warm) light colours.
 *
 * Ships only through the founder gate: /dev/lighting-test must pass all
 * five criteria (see that route), then APPROVED_STUDIO flips to the
 * "hybrid-small08" preset — until then the approved studio keeps rendering
 * in the PDP.
 */

import { Environment, Lightformer } from "@react-three/drei";

export function StudioEnvironment() {
    return (
        <Environment files="/env/studio_small_08_1k.hdr" resolution={512}>
            {/* Left + right vertical strips: clear-glass edge highlights,
                clean stripes in metal caps. Tuned from the seed (3 @ z=+2):
                intensity 4.5 so the lines survive the bright cove backdrop;
                z=+1 places the specular line near the glass SILHOUETTE while
                still filling the metals' camera-facing band (z=0 left it
                dark, z=+2 pulled the lines two-thirds inboard). */}
            <Lightformer form="rect" intensity={4.5} color="white"
                         scale={[1, 8, 1]} position={[-4, 2, 1]} target={[0, 0, 0]} />
            <Lightformer form="rect" intensity={4.5} color="white"
                         scale={[1, 8, 1]} position={[4, 2, 1]} target={[0, 0, 0]} />
            {/* Overhead softbox: cap tops and bottle shoulders */}
            <Lightformer form="rect" intensity={2} color="white"
                         scale={[6, 3, 1]} position={[0, 6, 0]}
                         rotation={[-Math.PI / 2, 0, 0]} />
            {/* Broad dim backlight panel: makes amber/cobalt transmit their
                colour instead of reading black */}
            <Lightformer form="rect" intensity={1.2} color="white"
                         scale={[8, 6, 1]} position={[0, 2, -6]} target={[0, 0, 0]} />
        </Environment>
    );
}
