"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { BOTTLE_MASTERS, listClosuresFor, listGlasses } from "@/lib/bottle25/registry";
import { STAGE_BONE, type GlassOverrides, type Stage } from "@/components/bottle25/Bottle25";

const Bottle25 = dynamic(() => import("@/components/bottle25/Bottle25"), { ssr: false });

const MASTER = BOTTLE_MASTERS["cylinder-9ml"];

export default function Bottle25Lab() {
    const glasses = listGlasses();
    const closures = listClosuresFor(MASTER);
    const [stage, setStage] = useState<Stage>(STAGE_BONE);
    const [ov, setOv] = useState<GlassOverrides>({});
    const [hero, setHero] = useState({ glass: "clear", closure: "roll-on-gold" });

    const num = (label: string, key: keyof GlassOverrides, min: number, max: number, def: number, step = 0.01) => (
        <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">
                {label} {(ov[key] ?? def).toFixed(2)}
            </span>
            <input type="range" autoComplete="off" min={min} max={max} step={step}
                   value={ov[key] ?? def}
                   onChange={(e) => setOv({ ...ov, [key]: Number(e.target.value) })}
                   className="w-40" />
        </label>
    );
    const stg = (label: string, key: keyof Stage, min: number, max: number, step = 0.01) => (
        <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">
                {label} {Number(stage[key]).toFixed(2)}
            </span>
            <input type="range" autoComplete="off" min={min} max={max} step={step}
                   value={Number(stage[key])}
                   onChange={(e) => setStage({ ...stage, [key]: Number(e.target.value) })}
                   className="w-40" />
        </label>
    );

    return (
        <main className="mx-auto max-w-[1500px] p-8">
            <header className="mb-6">
                <h1 className="text-2xl font-medium">2.5D bottle — one master, every glass, any closure</h1>
                <p className="mt-2 max-w-[80ch] text-sm text-slate-600">
                    Every bottle below is the same <code>cylinder-9ml</code> master: one 18 KB thickness
                    bake, drawn by one shader on a plane. Colour is absorption per millimetre through the
                    glass the bake measured — 4.9 mm down the axis, 12.5 mm where a ray grazes the inner
                    wall, 19.9 mm through the base — so the same cobalt is light in the wall and deep in
                    the puck without anyone painting either. The closures are photographs from the
                    component kit, on their own layer. No bottle image was made for any of these.
                </p>
            </header>

            <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4 text-sm">
                <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-500">ground</span>
                    <input type="color" autoComplete="off" value={stage.ground}
                           onChange={(e) => setStage({ ...stage, ground: e.target.value })}
                           className="h-7 w-12 cursor-pointer rounded border border-black/20 bg-transparent p-0" />
                </label>
                {stg("cove falloff", "gradient", 0, 0.35)}
                {stg("shadow", "shadow", 0, 0.9)}
                {stg("spread", "spread", 1, 3, 0.02)}
                {stg("reflection", "reflection", 0, 0.6)}
                {num("refraction", "refractionStrength", 0, 3, 1)}
                {num("fresnel", "fresnelStrength", 0, 2, 1)}
                {num("specular", "specularIntensity", 0, 2, 1)}
                {num("edge", "edgeIntensity", 0, 2, 1)}
                {num("thickness ×", "thicknessInfluence", 0.2, 2.5, 1)}
                {num("base boost", "baseBoost", 0, 2, 0)}
            </div>

            <section className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <figure>
                    <figcaption className="mb-2 flex items-center gap-3 text-sm font-medium">
                        <span>Hero</span>
                        <select value={hero.glass} onChange={(e) => setHero({ ...hero, glass: e.target.value })}
                                className="rounded border border-black/20 px-2 py-1 text-sm font-normal">
                            {glasses.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                        </select>
                        <select value={hero.closure} onChange={(e) => setHero({ ...hero, closure: e.target.value })}
                                className="rounded border border-black/20 px-2 py-1 text-sm font-normal">
                            {closures.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                    </figcaption>
                    <Bottle25 bottleMasterId={MASTER.id} glassMaterialId={hero.glass}
                              closureId={hero.closure} stage={stage} overrides={ov}
                              className="rounded-sm border border-black/10" />
                </figure>
                <div className="text-sm text-slate-600">
                    <h2 className="mb-2 font-medium text-slate-900">What this is, and is not</h2>
                    <ul className="list-disc space-y-1 pl-5">
                        <li>One refraction event against the stage, not the scene: nothing stands
                            behind the bottle to be seen through it.</li>
                        <li>Curvature is the across-row position of a solid of revolution. A bottle
                            that is not round front-on needs a normal map, which the master can carry.</li>
                        <li>Wall and base thickness are the GLB bake&apos;s measured 2.45 mm and 12.7 mm;
                            the bake sidecar records them, nothing is estimated.</li>
                        <li>Closures are photographs on their own layer. Recolouring a cap is a
                            different closure, never a change to the glass.</li>
                        <li>Each tile is its own canvas at <code>frameloop=&quot;demand&quot;</code>; it
                            draws when a knob moves and otherwise costs nothing.</li>
                    </ul>
                </div>
            </section>

            {closures.slice(0, 2).map((c) => (
                <section key={c.id} className="mb-8">
                    <h2 className="mb-3 text-sm font-medium">{c.label} — kit {c.source.websiteSku}</h2>
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {glasses.map((g) => (
                            <figure key={g.id}>
                                <Bottle25 bottleMasterId={MASTER.id} glassMaterialId={g.id}
                                          closureId={c.id} stage={stage} overrides={ov}
                                          className="rounded-sm border border-black/10" />
                                <figcaption className="mt-1 text-xs text-slate-500">
                                    {MASTER.id} + {g.id} + {c.id}
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                </section>
            ))}
        </main>
    );
}
