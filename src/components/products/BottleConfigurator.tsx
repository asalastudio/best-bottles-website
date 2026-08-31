"use client";

/**
 * BottleConfigurator — the PDP's interactive product surface.
 *
 * Wraps Bottle3DViewer with the customer-facing controls: glass colourway,
 * closure, and cap finish. All options are DATA (glassPresets + materials.json),
 * so the swatches always mirror what the renderer can actually produce.
 *
 * Rendered in the PDP's main image slot; ProductImageGallery drops to
 * `mode="thumbs-only"` beneath it.
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import { GLASS_PRESETS, type GlassPresetId } from "@/lib/materials/glassPresets";

// three.js must not run on the server, and the bundle is heavy — load it
// only when a PDP actually shows the configurator
const Bottle3DViewer = dynamic(() => import("./Bottle3DViewer"), {
    ssr: false,
    loading: () => (
        <div className="aspect-[10/11] w-full bg-travertine rounded-sm flex items-center justify-center">
            <span className="text-xs tracking-[0.18em] uppercase text-stone/60">
                Loading 3D view
            </span>
        </div>
    ),
});

const GLASS_SWATCH: Record<GlassPresetId, string> = {
    clear: "linear-gradient(145deg,#f2f4f3,#d8dedb)",
    amber: "linear-gradient(145deg,#a5601f,#4a2409)",
    cobalt: "linear-gradient(145deg,#2a4bbf,#0a1b63)",
    frosted: "linear-gradient(145deg,#eef0f0,#c3c9c9)",
    swirl: "linear-gradient(145deg,#efe7d8,#cbbfa6)",
};

const CAPS: { id: string; label: string; swatch: string }[] = [
    { id: "CAP_SHINY_BLACK", label: "Black", swatch: "linear-gradient(145deg,#3a3a3a,#0b0b0b)" },
    { id: "CAP_WHITE", label: "White", swatch: "linear-gradient(145deg,#ffffff,#e2e0da)" },
    { id: "CAP_SHINY_GOLD", label: "Gold", swatch: "linear-gradient(145deg,#fff4d0,#c9a24a)" },
    { id: "CAP_MATTE_GOLD", label: "Gold matte", swatch: "linear-gradient(145deg,#ecdcae,#b39a63)" },
    { id: "CAP_SHINY_SILVER", label: "Silver", swatch: "linear-gradient(145deg,#ffffff,#b9bcbe)" },
    { id: "CAP_MATTE_SILVER", label: "Silver matte", swatch: "linear-gradient(145deg,#e6e6e4,#a9adae)" },
    { id: "CAP_COPPER", label: "Copper", swatch: "linear-gradient(145deg,#d99a6c,#8f4f2c)" },
];

const CLOSURES: { id: "none" | "roller" | "rollerCapped"; label: string }[] = [
    { id: "none", label: "Bottle only" },
    { id: "roller", label: "Roll-on" },
    { id: "rollerCapped", label: "Roll-on + cap" },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3">
            <span className="w-[4.5rem] shrink-0 text-[10px] uppercase tracking-[0.16em] text-stone/60">
                {label}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">{children}</div>
        </div>
    );
}

export default function BottleConfigurator({
    bodyId = "Cyl-round-17-415-70x20",
    initialGlass = "amber",
    className = "",
}: {
    bodyId?: string;
    initialGlass?: GlassPresetId;
    className?: string;
}) {
    const [glass, setGlass] = useState<GlassPresetId>(initialGlass);
    const [closure, setClosure] = useState<"none" | "roller" | "rollerCapped">("roller");
    const [capMat, setCapMat] = useState("CAP_SHINY_BLACK");

    const chip = (active: boolean) =>
        `px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] border transition-colors ${
            active
                ? "border-stone/70 text-stone bg-white/70"
                : "border-champagne/60 text-stone/55 hover:border-stone/40"
        }`;

    const dot = (active: boolean) =>
        `h-6 w-6 rounded-full border transition-all ${
            active ? "border-stone/80 ring-1 ring-stone/25 scale-105" : "border-champagne/70 hover:border-stone/40"
        }`;

    return (
        <div className={className}>
            <Bottle3DViewer
                bodyId={bodyId}
                glass={glass}
                closure={closure}
                capMat={capMat}
                className="border-0 sm:border sm:border-champagne/50"
            />

            <div className="mt-4 space-y-3">
                <Row label="Glass">
                    {(Object.keys(GLASS_PRESETS) as GlassPresetId[]).map((id) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setGlass(id)}
                            aria-label={GLASS_PRESETS[id].label}
                            aria-pressed={glass === id}
                            title={GLASS_PRESETS[id].label}
                            className={dot(glass === id)}
                            style={{ background: GLASS_SWATCH[id] }}
                        />
                    ))}
                </Row>

                <Row label="Closure">
                    {CLOSURES.map((c) => (
                        <button key={c.id} type="button" onClick={() => setClosure(c.id)}
                                aria-pressed={closure === c.id} className={chip(closure === c.id)}>
                            {c.label}
                        </button>
                    ))}
                </Row>

                {closure === "rollerCapped" ? (
                    <Row label="Cap">
                        {CAPS.map((c) => (
                            <button key={c.id} type="button" onClick={() => setCapMat(c.id)}
                                    aria-label={c.label} aria-pressed={capMat === c.id} title={c.label}
                                    className={dot(capMat === c.id)}
                                    style={{ background: c.swatch }} />
                        ))}
                    </Row>
                ) : null}
            </div>
        </div>
    );
}
