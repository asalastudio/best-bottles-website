"use client";

/**
 * Bottle25 — renders one ProductConfiguration.
 *
 *     BottleMaster + GlassMaterial + Closure  ->  a product
 *
 * The glass is a shader on a plane, fed by the master's thickness bake. The
 * closure is its own layer, drawn from the component kit, placed by its
 * recorded bounds rather than by a tuned offset. Neither knows about the other,
 * so eight configurations are eight rows of data and no new pictures.
 *
 * The stage (ground, falloff, contact shadow, reflection) is computed inside
 * the same shader as the glass, because refraction has to sample it: a
 * background painted in CSS behind the canvas is a background the glass cannot
 * bend.
 */

import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { GL_COLOR_SETTINGS } from "@/lib/materials/colorManagement";
import { BOTTLE_MASTERS, CLOSURES, GLASS_MATERIALS } from "@/lib/bottle25/registry";
import type { BottleMaster, GlassMaterial } from "@/lib/bottle25/types";
import { bottleGlassFrag, bottleGlassVert } from "./bottleGlassShader";

export type Stage = {
    ground: string;
    gradient: number;
    shadow: number;
    spread: number;
    reflection: number;
};

export const STAGE_BONE: Stage = {
    ground: "#E3DAC9", gradient: 0.1, shadow: 0.42, spread: 1.6, reflection: 0.18,
};

/** knobs a surface may push past the material's own values, for tuning */
export type GlassOverrides = Partial<
    Pick<GlassMaterial, "refractionStrength" | "fresnelStrength" | "specularIntensity" | "edgeIntensity">
> & { thicknessInfluence?: number; baseBoost?: number };

/* --------------------------------------------------------------- the glass */

function Glass({ master, glass, stage, overrides }: {
    master: BottleMaster; glass: GlassMaterial; stage: Stage; overrides: GlassOverrides;
}) {
    const url = master.maps?.thicknessMapUrl;
    const [map, setMap] = useState<THREE.Texture | null>(null);
    const [maxMm, setMaxMm] = useState(20);
    // half the bottle's width, in frame units — the bake measured it, so the
    // contact shadow is sized by the bottle rather than by a guess
    const [halfW, setHalfW] = useState(0.1);

    useEffect(() => {
        if (!url) return;
        let dead = false;
        // the bake is DATA: no colour-space decode, or the millimetres that come
        // back out are not the millimetres that went in. It KEEPS three's
        // default flipY: this is a screen-space image whose top is the top of
        // the frame, unlike the GLB bake, whose UVs were authored in GL space.
        // (The first draw of this renderer stood every bottle on its neck.)
        new THREE.TextureLoader().load(url, (t) => {
            if (dead) return;
            t.colorSpace = THREE.NoColorSpace;
            t.minFilter = THREE.LinearMipmapLinearFilter;
            t.magFilter = THREE.LinearFilter;
            t.generateMipmaps = true;
            t.anisotropy = 4;
            setMap(t);
        });
        fetch(url.replace(/\.png$/, ".json"))
            .then((r) => r.json())
            .then((j) => {
                if (dead || !j?.maxThicknessMm) return;
                setMaxMm(j.maxThicknessMm);
                setHalfW((j.bounds.right - j.bounds.left) / 2 / j.canvas.width);
            })
            .catch(() => { /* the default is the bottle's own diameter; close enough to draw */ });
        return () => { dead = true; };
    }, [url]);

    const uniforms = useMemo(() => ({
        uThickness: { value: null as THREE.Texture | null },
        uThicknessMaxMm: { value: 20 },
        uAbsorption: { value: new THREE.Vector3() },
        uIor: { value: 1.52 },
        uRoughness: { value: 0.02 },
        uFrost: { value: 0 },
        uFresnelStrength: { value: 1 },
        uRefractionStrength: { value: 1 },
        uSpecularIntensity: { value: 1 },
        uEdgeIntensity: { value: 1 },
        uSurfaceTint: { value: new THREE.Vector3(1, 1, 1) },
        uThicknessInfluence: { value: 1 },
        uGround: { value: new THREE.Color() },
        uGradient: { value: 0.1 },
        uFoot: { value: new THREE.Vector3() },
        uAspectWH: { value: 10 / 11 },
        uShadow: { value: 0.42 },
        uSpread: { value: 1.6 },
        uReflection: { value: 0.18 },
        uBaseBoost: { value: 0 },
    }), []);

    // drive the uniforms in place; a new material per render would recompile
    /* eslint-disable react-hooks/immutability -- three.js uniforms are mutated by design;
       the memoized object is the one the compiled shader is bound to */
    const u = uniforms;
    u.uThickness.value = map;
    u.uThicknessMaxMm.value = maxMm;
    u.uAbsorption.value.set(...glass.absorption);
    u.uIor.value = glass.ior;
    u.uRoughness.value = glass.roughness;
    u.uFrost.value = glass.frost;
    u.uFresnelStrength.value = overrides.fresnelStrength ?? glass.fresnelStrength;
    u.uRefractionStrength.value = overrides.refractionStrength ?? glass.refractionStrength;
    u.uSpecularIntensity.value = overrides.specularIntensity ?? glass.specularIntensity;
    u.uEdgeIntensity.value = overrides.edgeIntensity ?? glass.edgeIntensity;
    u.uSurfaceTint.value.set(...(glass.surfaceTint ?? [1, 1, 1]));
    u.uThicknessInfluence.value = overrides.thicknessInfluence ?? 1;
    u.uGround.value.set(stage.ground);
    u.uGradient.value = stage.gradient;
    u.uShadow.value = stage.shadow;
    u.uSpread.value = stage.spread;
    u.uReflection.value = stage.reflection;
    u.uBaseBoost.value = overrides.baseBoost ?? 0;
    // GL uv puts y at the BOTTOM; the master's anchors are plate coordinates
    u.uFoot.value.set(master.anchors.baseline.x, 1 - master.anchors.baseline.y, halfW);
    /* eslint-enable react-hooks/immutability */

    // frameloop is "demand", so a uniform change draws nothing until asked
    const invalidate = useThree((s) => s.invalidate);
    useEffect(() => { invalidate(); });

    if (!map) return null;
    return (
        <mesh>
            <planeGeometry args={[2, 2]} />
            <shaderMaterial vertexShader={bottleGlassVert}
                            fragmentShader={bottleGlassFrag} uniforms={uniforms}
                            toneMapped={false} />
        </mesh>
    );
}

/* ------------------------------------------------------------- the product */

export default function Bottle25({
    bottleMasterId, glassMaterialId, closureId,
    stage = STAGE_BONE, overrides = {}, className,
}: {
    bottleMasterId: string; glassMaterialId: string; closureId: string;
    stage?: Stage; overrides?: GlassOverrides; className?: string;
}) {
    const master = BOTTLE_MASTERS[bottleMasterId];
    const glass = GLASS_MATERIALS[glassMaterialId];
    const closure = CLOSURES[closureId];

    // A closure is a set of slots in a kit that already exists. Looking them up
    // keeps the URLs content-addressed in one place instead of copied into a
    // second registry that would go stale the next time a part is re-cut.
    const kit = useQuery(api.productKits.forSku,
        closure ? { websiteSku: closure.source.websiteSku, graceSku: null } : "skip");
    const parts = useMemo(() => {
        if (!kit?.parts || !closure) return [];
        return kit.parts
            .filter((p) => closure.source.slots.includes(p.slot))
            .sort((a, b) => a.zOrder - b.zOrder);
    }, [kit, closure]);

    if (!master || !glass || !closure) {
        return <div className={className}>unknown configuration</div>;
    }
    const fits = closure.compatibleNeckFinishes.includes(master.neckFinish);

    return (
        <div className={className}
             style={{ position: "relative", width: "100%", aspectRatio: "10 / 11",
                      overflow: "hidden", background: stage.ground }}>
            <Canvas orthographic
                    camera={{ position: [0, 0, 1], zoom: 1, left: -1, right: 1, top: 1, bottom: -1 }}
                    gl={{ antialias: true, ...GL_COLOR_SETTINGS }} dpr={[1, 2]}
                    frameloop="demand"
                    style={{ position: "absolute", inset: 0 }}>
                <Glass master={master} glass={glass} stage={stage} overrides={overrides} />
            </Canvas>

            {/* the closure is its own layer and never touches the glass shader */}
            {/* Part images are published ON the full plate canvas, already
                registered to it — that registration IS the anchor, recorded by
                the builder and verified by the kit's axis gate. Re-placing them
                from `bounds` would apply the same offset twice. `bounds` stays
                the metadata that sizes the shadow and seats a future GLB. */}
            {fits && parts.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.slot} src={p.image.url} alt={p.slot}
                     style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                              objectFit: "contain", zIndex: 10 + p.zOrder }}
                     decoding="async" />
            ))}
            {!fits && (
                <p style={{ position: "absolute", bottom: 8, left: 8, fontSize: 11, color: "#a00" }}>
                    {closure.label} does not fit {master.neckFinish}
                </p>
            )}
        </div>
    );
}
