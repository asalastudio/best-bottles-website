"use client";

/**
 * PhotoGlass — the photograph, relit as glass.
 *
 * The plate is not flat because it lacks glass; it IS a photograph of glass.
 * It looks flat on a coloured ground because it was shot on WHITE, so every
 * transparent part of it still transmits white. Drop that cut-out onto bone
 * and the bottle is a sticker: the room behind it changed and the glass did
 * not notice.
 *
 * So treat the photograph as what it physically is — a transmittance map.
 * On a white sweep the pixel under the glass is T x 1, so the pixel IS T.
 * Re-composite it over the new ground and the glass transmits bone:
 *
 *     out = mix(ground, T * groundBehind + specular, alpha)
 *
 * Two things save it from going muddy. The studio highlights (the hot vertical
 * band down a cylinder) are specular, not transmitted — they stay white and are
 * added back rather than tinted. And the ground SAMPLED BEHIND the glass is
 * displaced like a cylinder lens, so the contact shadow bends at the walls,
 * which is the cue that says "there is a volume here" more than any highlight.
 *
 * Nothing here invents shape. The silhouette, the wall darkening and the
 * highlights are all the photographer's; the shader only answers the question
 * the photograph could not: what is behind it now.
 */

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { GL_COLOR_SETTINGS } from "@/lib/materials/colorManagement";

export type GlassKnobs = {
    transmit: number;    // 0 = the plate untouched, 1 = fully relit onto the ground
    specular: number;    // how much of the studio highlight is added back
    refraction: number;  // cylinder-lens displacement of the ground behind
    reflection: number;  // the bottle mirrored in the surface it stands on
    shadow: number;
    spread: number;
    gradient: number;    // the cove falling off toward the top
};

export const GLASS_DEFAULTS: GlassKnobs = {
    transmit: 1, specular: 0.35, refraction: 0.035, reflection: 0.18,
    shadow: 0.42, spread: 1.6, gradient: 0.1,
};

const vert = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const frag = `
precision highp float;
varying vec2 vUv;

uniform sampler2D map;
uniform vec3  ground;
uniform vec3  foot;        // x: centre, y: baseline (uv), z: half-width (of frame WIDTH)
uniform float aspectWH;    // frame width / height, to draw a round ellipse in uv
uniform float transmit;
uniform float specular;
uniform float refraction;
uniform float reflection;
uniform float shadowA;
uniform float spread;
uniform float gradient;

/** the cove: the ground, its falloff, and the contact shadow pooled on it */
vec3 groundAt(vec2 uv) {
    vec3 g = ground * (1.0 - gradient * uv.y);
    vec2 c = vec2(foot.x, foot.y);
    // a tight core where the glass meets the surface, a wide soft pool around it
    vec2 d1 = (uv - c) / vec2(foot.z * spread, foot.z * spread * 0.20 * aspectWH);
    vec2 d2 = (uv - c) / vec2(foot.z * 1.02,   foot.z * 0.085 * aspectWH);
    float pool = (1.0 - smoothstep(0.0, 1.0, length(d1))) * 0.7;
    float core = (1.0 - smoothstep(0.0, 1.0, length(d2)));
    return mix(g, g * 0.16, clamp(pool + core, 0.0, 1.0) * shadowA);
}

void main() {
    vec4 t = texture2D(map, vUv);
    vec3 T = t.rgb;                 // shot on white, so the pixel IS transmittance
    float a = t.a;

    // a cylinder bends hardest at its walls and not at all down its axis
    float nx   = clamp((vUv.x - foot.x) / max(foot.z, 1e-4), -1.0, 1.0);
    float bend = nx * (1.0 - sqrt(max(0.0, 1.0 - nx * nx)));

    vec3 front  = groundAt(vUv);
    vec3 behind = groundAt(vUv - vec2(bend * refraction, 0.0));

    // the surface it stands on returns some of it. Mirror about the baseline
    // and fade with distance — a real bench does this, and without it the
    // bottle reads as a cut-out no matter how good the shadow is.
    if (vUv.y < foot.y) {
        vec4 m = texture2D(map, vec2(vUv.x, 2.0 * foot.y - vUv.y));
        float fade = exp(-(foot.y - vUv.y) * 26.0) * reflection;
        front = mix(front, front * m.rgb, m.a * fade);
    }

    // the highlight is specular: it never took the ground's colour
    float lum  = dot(T, vec3(0.2126, 0.7152, 0.0722));
    float spec = smoothstep(0.80, 1.0, lum);

    vec3 glass = mix(T, T * behind, transmit) + spec * specular * a;
    gl_FragColor = vec4(mix(front, glass, a), 1.0);

    // Everything above is linear. A ShaderMaterial does NOT get three's output
    // conversion for free the way a built-in material does — without this the
    // bone ground rendered at its LINEAR value (178,163,136 against the CSS
    // panel's 227,218,201, measured), which reads as a different, muddier
    // colour rather than a lighting choice.
    #include <colorspace_fragment>
}`;

function Plate({ url, ground, foot, aspectWH, knobs }: {
    url: string; ground: string; foot: [number, number, number];
    aspectWH: number; knobs: GlassKnobs;
}) {
    const map = useTexture(url);
    map.colorSpace = THREE.SRGBColorSpace;

    const uniforms = useMemo(() => ({
        map: { value: map },
        ground: { value: new THREE.Color(ground) },
        foot: { value: new THREE.Vector3(...foot) },
        aspectWH: { value: aspectWH },
        transmit: { value: knobs.transmit },
        specular: { value: knobs.specular },
        refraction: { value: knobs.refraction },
        reflection: { value: knobs.reflection },
        shadowA: { value: knobs.shadow },
        spread: { value: knobs.spread },
        gradient: { value: knobs.gradient },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [map]);

    // drive the uniforms directly: a new material every frame would recompile
    uniforms.ground.value.set(ground);
    uniforms.foot.value.set(...foot);
    uniforms.aspectWH.value = aspectWH;
    uniforms.transmit.value = knobs.transmit;
    uniforms.specular.value = knobs.specular;
    uniforms.refraction.value = knobs.refraction;
    uniforms.reflection.value = knobs.reflection;
    uniforms.shadowA.value = knobs.shadow;
    uniforms.spread.value = knobs.spread;
    uniforms.gradient.value = knobs.gradient;

    return (
        <mesh>
            <planeGeometry args={[2, 2]} />
            <shaderMaterial vertexShader={vert} fragmentShader={frag}
                            uniforms={uniforms} toneMapped={false} />
        </mesh>
    );
}

export default function PhotoGlass({ url, ground, foot, aspectWH, knobs }: {
    /** the BODY part only — the cap and fitment are opaque and stay photographs */
    url: string; ground: string;
    /** centre x, baseline y (both uv, y measured from the BOTTOM), half-width */
    foot: [number, number, number];
    aspectWH: number; knobs: GlassKnobs;
}) {
    return (
        <Canvas orthographic camera={{ position: [0, 0, 1], zoom: 1, left: -1, right: 1, top: 1, bottom: -1 }}
                gl={{ antialias: true, ...GL_COLOR_SETTINGS }} dpr={[1, 2]}
                style={{ position: "absolute", inset: 0 }}>
            <Plate url={url} ground={ground} foot={foot} aspectWH={aspectWH} knobs={knobs} />
        </Canvas>
    );
}
