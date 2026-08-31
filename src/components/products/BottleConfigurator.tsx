"use client";

/**
 * BottleConfigurator — the PDP's interactive product surface.
 *
 * Design grammar (Mobbin: Revolut Business card configurator, Wise card
 * customiser): one hero object on a dramatic stage, an elegant caption
 * beneath it, minimal centred controls, generous negative space. Rendered
 * in the Best Bottles register — umber vitrine, EB Garamond captions,
 * champagne hairlines, muted-gold micro-labels.
 *
 * All options are DATA (glassPresets + materials.json): the swatches can
 * only ever offer what the renderer actually ships.
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { GLASS_PRESETS, type GlassPresetId } from "@/lib/materials/glassPresets";

const Bottle3DViewer = dynamic(() => import("./Bottle3DViewer"), {
    ssr: false,
    loading: () => (
        <div className="aspect-[10/11] w-full rounded-sm flex items-center justify-center"
             style={{ background: "#a29383" }}>
            <span className="text-[10px] tracking-[0.22em] uppercase text-champagne/70">
                Preparing 3D view
            </span>
        </div>
    ),
});

const GLASS_SWATCH: Record<GlassPresetId, string> = {
    clear: "linear-gradient(145deg,#f4f6f5,#d5dbd8)",
    amber: "linear-gradient(145deg,#a5601f,#4a2409)",
    cobalt: "linear-gradient(145deg,#2a4bbf,#0a1b63)",
    frosted: "linear-gradient(145deg,#eef0f0,#c3c9c9)",
    swirl: "linear-gradient(145deg,#efe7d8,#cbbfa6)",
};

const CAPS: { id: string; label: string; swatch: string }[] = [
    { id: "CAP_SHINY_BLACK", label: "Black", swatch: "linear-gradient(145deg,#3a3a3a,#0b0b0b)" },
    { id: "CAP_WHITE", label: "White", swatch: "linear-gradient(145deg,#ffffff,#e2e0da)" },
    { id: "CAP_SHINY_GOLD", label: "Shiny gold", swatch: "linear-gradient(145deg,#fff4d0,#c9a24a)" },
    { id: "CAP_MATTE_GOLD", label: "Matte gold", swatch: "linear-gradient(145deg,#ecdcae,#b39a63)" },
    { id: "CAP_SHINY_SILVER", label: "Shiny silver", swatch: "linear-gradient(145deg,#ffffff,#b9bcbe)" },
    { id: "CAP_MATTE_SILVER", label: "Matte silver", swatch: "linear-gradient(145deg,#e6e6e4,#a9adae)" },
    { id: "CAP_COPPER", label: "Matte copper", swatch: "linear-gradient(145deg,#d99a6c,#8f4f2c)" },
];

const CLOSURES: { id: "none" | "roller" | "rollerCapped"; label: string }[] = [
    { id: "none", label: "Bottle" },
    { id: "roller", label: "Roll-on" },
    { id: "rollerCapped", label: "Capped" },
];

/** colourways that live on their own mesh — the swirl's flutes are geometry */
const BODY_FOR_GLASS: Partial<Record<GlassPresetId, string>> = {
    swirl: "CylSwrl-round-17-415-74x21",
};

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
    const [capMat, setCapMat] = useState("CAP_SHINY_GOLD");
    const capLabel = CAPS.find((c) => c.id === capMat)?.label ?? "";
    const closureLabel =
        closure === "none" ? "Bottle only"
        : closure === "roller" ? "Roll-on"
        : `Roll-on · ${capLabel} cap`;

    return (
        <div className={className}>
            {/* ------------------------------------------------ the vitrine */}
            <div className="relative">
                <Bottle3DViewer
                    bodyId={BODY_FOR_GLASS[glass] ?? bodyId}
                    glass={glass}
                    closure={closure}
                    capMat={capMat}
                    backdrop="#a29383"
                    className="rounded-sm overflow-hidden"
                />
                <div className="absolute top-3 left-3 flex items-center gap-1.5 pointer-events-none">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-gold animate-pulse" />
                    <span className="text-[9px] uppercase tracking-[0.22em] font-bold text-champagne/90">
                        Live 3D
                    </span>
                </div>
                <div className="absolute bottom-3 right-3 pointer-events-none">
                    <span className="text-[9px] uppercase tracking-[0.18em] text-champagne/50">
                        Drag to rotate
                    </span>
                </div>
            </div>

            {/* --------------------------------------------- caption line */}
            <div className="mt-4 text-center">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={`${glass}-${closureLabel}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.25 }}
                        className="font-serif text-lg text-obsidian"
                    >
                        {GLASS_PRESETS[glass].label} Glass
                        <span className="text-ash mx-2">·</span>
                        <span className="text-ink/80">{closureLabel}</span>
                    </motion.p>
                </AnimatePresence>
            </div>

            {/* ------------------------------------------------- controls */}
            <div className="mt-4 flex flex-col items-center gap-4">
                {/* glass swatches */}
                <div className="flex items-center gap-2.5">
                    {(Object.keys(GLASS_PRESETS) as GlassPresetId[])
                        .filter((id) => GLASS_PRESETS[id].configuratorReady !== false)
                        .map((id) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setGlass(id)}
                            aria-label={`${GLASS_PRESETS[id].label} glass`}
                            aria-pressed={glass === id}
                            title={GLASS_PRESETS[id].label}
                            className={`h-7 w-7 rounded-full transition-all duration-200 ${
                                glass === id
                                    ? "ring-2 ring-muted-gold ring-offset-2 ring-offset-linen scale-105"
                                    : "ring-1 ring-champagne hover:ring-ash"
                            }`}
                            style={{ background: GLASS_SWATCH[id] }}
                        />
                    ))}
                </div>

                {/* segmented closure control */}
                <div className="inline-flex rounded-full border border-champagne bg-warm-white p-0.5">
                    {CLOSURES.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => setClosure(c.id)}
                            aria-pressed={closure === c.id}
                            className={`px-4 py-1.5 rounded-full text-[10px] uppercase tracking-[0.16em] font-bold transition-colors duration-200 ${
                                closure === c.id
                                    ? "bg-obsidian text-bone"
                                    : "text-ash hover:text-ink"
                            }`}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>

                {/* cap finishes — only when capped */}
                <AnimatePresence initial={false}>
                    {closure === "rollerCapped" ? (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                        >
                            <div className="flex flex-col items-center gap-2 pt-1">
                                <span className="text-[9px] uppercase tracking-[0.22em] font-bold text-muted-gold">
                                    Cap finish
                                </span>
                                <div className="flex items-center gap-2.5">
                                    {CAPS.map((c) => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => setCapMat(c.id)}
                                            aria-label={`${c.label} cap`}
                                            aria-pressed={capMat === c.id}
                                            title={c.label}
                                            className={`h-6 w-6 rounded-full transition-all duration-200 ${
                                                capMat === c.id
                                                    ? "ring-2 ring-muted-gold ring-offset-2 ring-offset-linen scale-105"
                                                    : "ring-1 ring-champagne hover:ring-ash"
                                            }`}
                                            style={{ background: c.swatch }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>
        </div>
    );
}
