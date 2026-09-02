"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { GLASS_DEFAULTS } from "./PhotoGlass";

const Bottle3DViewer = dynamic(() => import("@/components/products/Bottle3DViewer"), { ssr: false });
const PhotoGlass = dynamic(() => import("./PhotoGlass"), { ssr: false });

const BODY_ID = "Cyl-round-17-415-70x20";      // the 9 mL 17-415 clear body
const SKUS = [
    "GBCyl9MtlRollShnGl",
    "GBCyl9MtlRollShBlk",
    "GBCyl9MtlRollSlDot",
    "GBCyl9RollWht",
];

/**
 * How Bottle3DViewer frames a body, derived from its own numbers rather than
 * guessed with a slider:
 *
 *   OrbitControls pins the radius at 3.15 x h (h = the body's measured height
 *   in metres) and the camera runs fov 30 vertical, so the visible height at
 *   the bottle's plane is 2 * 3.15h * tan(15 deg) = 1.6881h. The body itself is
 *   h, so it covers 1 / 1.6881 = 0.5924 of the frame.
 *
 *   <Center disableY> leaves Y alone and the GLBs origin at the base, so the
 *   bottle stands on y = 0. The camera targets y = 0.62h, so the view spans
 *   [-0.224h, 1.464h] and the baseline sits 1.464 / 1.6881 = 0.8673 down.
 *
 * A photographed plate has its own framing. Matching the two is arithmetic,
 * and the reference-outline toggle below shows the result rather than
 * asserting it.
 */
const FRAME = { body: 1 / 1.6881, baseline: 1.464 / 1.6881 };

/** The frame is a 10/11 box, so a height given as a fraction of its WIDTH
 *  converts to a fraction of its height by this. Shadows are shaped by the
 *  bottle's footprint, which is a width, so the conversion has to be explicit. */
const FRAME_ASPECT = 11 / 10;

/**
 * A grounded shadow — a pool on the floor under the base, not an offset copy
 * of the bottle. A CSS drop-shadow filter moves the whole silhouette down and
 * blurs it, which is precisely what makes a product look like it is hovering.
 *
 * Two ellipses, the way a contact shadow actually behaves: a tight dark core
 * where the glass meets the surface and light cannot reach, and a wide soft
 * pool of ambient occlusion around it. Both are centred ON the baseline, so
 * their upper halves are hidden behind the bottle and only the forward half
 * shows — the plates are shot straight on, so almost no floor is visible and
 * the shadow must stay a low smudge rather than a saucer.
 */
function GroundShadow({ cx, baseline, width, opacity, spread }: {
    /** all as fractions: cx and width of the frame WIDTH, baseline of its height */
    cx: number; baseline: number; width: number; opacity: number; spread: number;
}) {
    const ellipse = (w: number, h: number, a: number, blur: number) => ({
        position: "absolute" as const,
        left: `${cx * 100}%`,
        top: `${baseline * 100}%`,
        width: `${w * 100}%`,
        height: `${h * FRAME_ASPECT * 100}%`,
        transform: "translate(-50%, -50%)",
        background: `radial-gradient(closest-side, rgba(58,49,40,${a}) 0%, rgba(58,49,40,${a * 0.5}) 50%, rgba(58,49,40,0) 100%)`,
        filter: `blur(${blur}px)`,
        pointerEvents: "none" as const,
    });
    return (
        <>
            <div style={{ ...ellipse(width * spread, width * spread * 0.20, opacity * 0.7, 7), zIndex: 0 }} />
            <div style={{ ...ellipse(width * 1.02, width * 0.085, opacity, 2.5), zIndex: 0 }} />
        </>
    );
}

/** The ground is not a backdrop image — it is the cove the bottle stands on,
 *  so clear glass refracts it. That is where the dimension comes from. */
const GROUNDS: Array<[string, string]> = [
    ["bone", "#E3DAC9"],
    ["warm bone", "#EFE7DA"],
    ["paper", "#F4F0E7"],
    ["taupe (stage)", "#A29383"],
    ["white", "#FFFFFF"],
];

export default function GlassNineLab() {
    const [sku, setSku] = useState(SKUS[0]);
    const [ground, setGround] = useState(GROUNDS[0][1]);
    const [shadow, setShadow] = useState(0.42);
    const [spread, setSpread] = useState(GLASS_DEFAULTS.spread);
    const [transmit, setTransmit] = useState(GLASS_DEFAULTS.transmit);
    const [specular, setSpecular] = useState(GLASS_DEFAULTS.specular);
    const [refraction, setRefraction] = useState(GLASS_DEFAULTS.refraction);
    const [gradient, setGradient] = useState(GLASS_DEFAULTS.gradient);
    const [reflection, setReflection] = useState(GLASS_DEFAULTS.reflection);
    const [coveEnv, setCoveEnv] = useState(0.9);
    // the clear preset ships thinWall, which is the plain MeshPhysicalMaterial
    // path: no backside pass, no thickness, so a hollow shell renders empty.
    // The lab starts on the volume path because that is the question.
    const [volume, setVolume] = useState(true);
    const [thickness, setThickness] = useState(0.0095);
    const [dispersion, setDispersion] = useState(0.31);
    const [spin, setSpin] = useState(false);
    const [showSeams, setShowSeams] = useState(false);
    const [showRef, setShowRef] = useState(false);
    // the fit is computed; these only nudge it, so a change is a decision
    // about the photograph and not a number someone dragged until it looked ok
    const [scaleNudge, setScaleNudge] = useState(0);
    const [offsetNudge, setOffsetNudge] = useState(0);

    const kit = useQuery(api.productKits.forSku, { websiteSku: sku, graceSku: null });
    const parts = useMemo(
        () => (kit?.parts?.length ? [...kit.parts].sort((a, b) => a.zOrder - b.zOrder) : null),
        [kit],
    );
    const body = parts?.find((p) => p.slot === "body") ?? null;
    const overlays = parts?.filter((p) => p.slot !== "body") ?? [];

    /** the glass, sized and seated on the photographed body it stands in for */
    const fit = useMemo(() => {
        if (!kit || !body) return null;
        const H = kit.canvas.height;
        const photoBody = (body.bounds.bottom - body.bounds.top) / H;
        const photoBaseline = body.bounds.bottom / H;
        const scale = photoBody / FRAME.body;
        // CSS scales about the centre, so the baseline lands at
        // 0.5 + (FRAME.baseline - 0.5) * scale; the offset closes the rest.
        const offset = photoBaseline - 0.5 - (FRAME.baseline - 0.5) * scale;
        return { scale, offset, photoBody, photoBaseline };
    }, [kit, body]);

    const scale = (fit?.scale ?? 1) + scaleNudge;
    const offsetPct = (fit?.offset ?? 0) * 100 + offsetNudge;

    useEffect(() => {
        if (process.env.NODE_ENV !== "production")
            (window as unknown as Record<string, unknown>).__glassLab = { kit, fit, scale, offsetPct };
    }, [kit, fit, scale, offsetPct]);

    const frame = "relative w-full aspect-[10/11] rounded-sm overflow-hidden border border-black/10";

    /** the photographed bottle's footprint, in frame fractions */
    const foot = body && kit ? {
        cx: ((body.bounds.left + body.bounds.right) / 2) / kit.canvas.width,
        baseline: body.bounds.bottom / kit.canvas.height,
        width: (body.bounds.right - body.bounds.left) / kit.canvas.width,
    } : null;

    /** the render is sized UP rather than transform-scaled, so the canvas
     *  rasterises at its real size — a resampled canvas is no way to judge glass */
    const glassBox: React.CSSProperties = {
        position: "absolute", left: "50%", top: "50%",
        width: `${scale * 100}%`, height: `${scale * 100}%`,
        transform: `translate(-50%, calc(-50% + ${offsetPct}%))`,
    };

    const refBox = body && kit ? {
        left: `${(body.bounds.left / kit.canvas.width) * 100}%`,
        top: `${(body.bounds.top / kit.canvas.height) * 100}%`,
        width: `${((body.bounds.right - body.bounds.left) / kit.canvas.width) * 100}%`,
        height: `${((body.bounds.bottom - body.bounds.top) / kit.canvas.height) * 100}%`,
    } : null;

    const knobs = { transmit, specular, refraction, reflection, shadow, spread, gradient };
    const glassFoot: [number, number, number] | null = foot
        ? [foot.cx, 1 - foot.baseline, foot.width / 2] : null;

    return (
        <main className="mx-auto max-w-[1400px] p-8">
            <header className="mb-6">
                <h1 className="text-2xl font-medium">Glass on the 9 mL</h1>
                <p className="mt-2 max-w-[74ch] text-sm text-slate-600">
                    Three treatments of one SKU, held still and framed to the same body.
                    <strong> Photo</strong> is the kit exactly as it ships. <strong>Hybrid</strong> renders
                    only the bottle as real glass — transmission, IOR 1.52, dispersion 0.31, the measured
                    recipe you approved on 31 Aug — and keeps the photographed fitment and cap on top,
                    because a photograph already says everything a metal cap needs to say.
                    <strong> 3D</strong> models the lot. The ground colour is the cove the bottle stands
                    on, not a backdrop behind it, so the glass refracts it — that is where the dimension
                    comes from.
                </p>
            </header>

            <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4 text-sm">
                <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-500">SKU</span>
                    <select value={sku} onChange={(e) => setSku(e.target.value)}
                            className="rounded border border-black/20 px-2 py-1">
                        {SKUS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </label>

                <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-500">ground {ground}</span>
                    <div className="flex items-center gap-1">
                        {GROUNDS.map(([name, hex]) => (
                            <button key={hex} type="button" title={name} onClick={() => setGround(hex)}
                                    style={{ background: hex }}
                                    className={`h-7 w-7 rounded-full border ${
                                        ground === hex ? "border-slate-900 ring-1 ring-slate-900" : "border-black/20"}`} />
                        ))}
                        <input type="color" autoComplete="off" value={ground} onChange={(e) => setGround(e.target.value)}
                               className="ml-1 h-7 w-9 cursor-pointer rounded border border-black/20 bg-transparent p-0" />
                    </div>
                </div>

                <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                        shadow {shadow.toFixed(2)}
                    </span>
                    <input type="range" autoComplete="off" min={0} max={0.9} step={0.01} value={shadow}
                           onChange={(e) => setShadow(Number(e.target.value))} className="w-40" />
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                        shadow spread {spread.toFixed(2)}×
                    </span>
                    <input type="range" autoComplete="off" min={1} max={3} step={0.02} value={spread}
                           onChange={(e) => setSpread(Number(e.target.value))} className="w-40" />
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                        size nudge {scaleNudge >= 0 ? "+" : ""}{scaleNudge.toFixed(3)}
                    </span>
                    <input type="range" autoComplete="off" min={-0.1} max={0.1} step={0.002} value={scaleNudge}
                           onChange={(e) => setScaleNudge(Number(e.target.value))} className="w-40" />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                        seat nudge {offsetNudge >= 0 ? "+" : ""}{offsetNudge.toFixed(1)}%
                    </span>
                    <input type="range" autoComplete="off" min={-8} max={8} step={0.1} value={offsetNudge}
                           onChange={(e) => setOffsetNudge(Number(e.target.value))} className="w-40" />
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                        transmit {transmit.toFixed(2)}
                    </span>
                    <input type="range" autoComplete="off" min={0} max={1} step={0.01} value={transmit}
                           onChange={(e) => setTransmit(Number(e.target.value))} className="w-40" />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                        highlight {specular.toFixed(2)}
                    </span>
                    <input type="range" autoComplete="off" min={0} max={1} step={0.01} value={specular}
                           onChange={(e) => setSpecular(Number(e.target.value))} className="w-40" />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                        refraction {refraction.toFixed(3)}
                    </span>
                    <input type="range" autoComplete="off" min={0} max={0.12} step={0.001} value={refraction}
                           onChange={(e) => setRefraction(Number(e.target.value))} className="w-40" />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                        reflection {reflection.toFixed(2)}
                    </span>
                    <input type="range" autoComplete="off" min={0} max={0.6} step={0.01} value={reflection}
                           onChange={(e) => setReflection(Number(e.target.value))} className="w-40" />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                        cove falloff {gradient.toFixed(2)}
                    </span>
                    <input type="range" autoComplete="off" min={0} max={0.35} step={0.01} value={gradient}
                           onChange={(e) => setGradient(Number(e.target.value))} className="w-40" />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                        3D cove brightness {coveEnv.toFixed(2)}
                    </span>
                    <input type="range" autoComplete="off" min={0.2} max={2} step={0.02} value={coveEnv}
                           onChange={(e) => setCoveEnv(Number(e.target.value))} className="w-40" />
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                        glass thickness {(thickness * 1000).toFixed(1)}mm
                    </span>
                    <input type="range" autoComplete="off" min={0.001} max={0.02} step={0.0005}
                           value={thickness}
                           onChange={(e) => setThickness(Number(e.target.value))} className="w-40" />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                        dispersion {dispersion.toFixed(2)}
                    </span>
                    <input type="range" autoComplete="off" min={0} max={1.2} step={0.01}
                           value={dispersion}
                           onChange={(e) => setDispersion(Number(e.target.value))} className="w-40" />
                </label>

                <label className="flex items-center gap-2">
                    <input type="checkbox" autoComplete="off" checked={volume}
                           onChange={(e) => setVolume(e.target.checked)} />
                    <span>volume glass (backside pass)</span>
                </label>
                <label className="flex items-center gap-2">
                    <input type="checkbox" autoComplete="off" checked={spin} onChange={(e) => setSpin(e.target.checked)} />
                    <span>let it turn</span>
                </label>
                <label className="flex items-center gap-2">
                    <input type="checkbox" autoComplete="off" checked={showRef} onChange={(e) => setShowRef(e.target.checked)} />
                    <span>reference outline</span>
                </label>
                <label className="flex items-center gap-2">
                    <input type="checkbox" autoComplete="off" checked={showSeams} onChange={(e) => setShowSeams(e.target.checked)} />
                    <span>outline the photographed layers</span>
                </label>
            </div>

            {kit === undefined && <p className="text-sm text-slate-500">Loading the kit…</p>}
            {kit === null && <p className="text-sm text-red-700">No kit is published for {sku}.</p>}

            {parts && (
                <>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <figure>
                        <figcaption className="mb-2 text-sm font-medium">Photo — what ships</figcaption>
                        <div className={frame} style={{ background: ground }}>
                            {foot && <GroundShadow {...foot} opacity={shadow} spread={spread} />}
                            {parts.map((p) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img key={p.slot} src={p.image.url} alt={p.slot}
                                     style={{ zIndex: p.zOrder + 1 }}
                                     className="absolute inset-0 h-full w-full object-contain" />
                            ))}
                            {showRef && refBox && (
                                <div className="absolute border border-red-500/70" style={refBox} />
                            )}
                        </div>
                    </figure>

                    <figure>
                        <figcaption className="mb-2 text-sm font-medium">
                            Photo + glass — the plate relit onto the ground
                        </figcaption>
                        <div className={frame} style={{ background: ground }}>
                            {body && glassFoot && (
                                <PhotoGlass url={body.image.url} ground={ground}
                                            foot={glassFoot} aspectWH={10 / 11} knobs={knobs} />
                            )}
                            {overlays.map((p) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img key={p.slot} src={p.image.url} alt={p.slot}
                                     style={{ zIndex: p.zOrder + 10 }}
                                     className="absolute inset-0 h-full w-full object-contain" />
                            ))}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                            the photographed body is the transmittance map; the cap and roller are
                            opaque and stay exactly as shot
                        </p>
                    </figure>

                    <figure>
                        <figcaption className="mb-2 text-sm font-medium">
                            Hybrid — glass rendered, closure photographed
                        </figcaption>
                        <div className={frame} style={{ background: ground }}>
                            <div style={glassBox}>
                                <Bottle3DViewer bodyId={BODY_ID} finish="17-415" glass="clear"
                                                closure="none" backdrop={ground} fill
                                                spin={spin} orbit={spin} vignette={false}
                                                shadow={{ opacity: shadow }}
                                                sweep={{ envIntensity: coveEnv, dim: 0.92 }}
                                                glassPath={volume ? "volume" : "auto"}
                                                glassThickness={thickness} dispersion={dispersion} />
                            </div>
                            {overlays.map((p) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img key={p.slot} src={p.image.url} alt={p.slot}
                                     style={{ zIndex: p.zOrder + 10 }}
                                     className={`absolute inset-0 h-full w-full object-contain
                                                 ${showSeams ? "outline outline-1 outline-red-400/60" : ""}`} />
                            ))}
                            {showRef && refBox && (
                                <div className="absolute z-20 border border-red-500/70" style={refBox} />
                            )}
                        </div>
                    </figure>

                    <figure>
                        <figcaption className="mb-2 text-sm font-medium">3D — everything modelled</figcaption>
                        <div className={frame} style={{ background: ground }}>
                            <div style={glassBox}>
                                <Bottle3DViewer bodyId={BODY_ID} finish="17-415" glass="clear"
                                                closure="rollerCapped" backdrop={ground} fill
                                                spin={spin} orbit={spin} vignette={false}
                                                shadow={{ opacity: shadow }}
                                                sweep={{ envIntensity: coveEnv, dim: 0.92 }}
                                                glassPath={volume ? "volume" : "auto"}
                                                glassThickness={thickness} dispersion={dispersion} />
                            </div>
                            {showRef && refBox && (
                                <div className="absolute z-20 border border-red-500/70" style={refBox} />
                            )}
                        </div>
                    </figure>
                </div>

                {fit && body && kit && (
                    <p className="mt-4 text-xs text-slate-500">
                        photographed body {body.bounds.right - body.bounds.left}×
                        {body.bounds.bottom - body.bounds.top}px on {kit.canvas.width}×{kit.canvas.height}
                        {" — "}{(fit.photoBody * 100).toFixed(1)}% of frame height, baseline at{" "}
                        {(fit.photoBaseline * 100).toFixed(1)}%. The viewer frames a body at{" "}
                        {(FRAME.body * 100).toFixed(1)}% with its baseline at {(FRAME.baseline * 100).toFixed(1)}%,
                        so the render is sized ×{scale.toFixed(3)} and seated {offsetPct.toFixed(2)}% lower.
                        {kit.anchors.pxPerMm ? ` Plate scale ${kit.anchors.pxPerMm.toFixed(2)} px/mm.` : ""}
                    </p>
                )}
                </>
            )}
        </main>
    );
}
