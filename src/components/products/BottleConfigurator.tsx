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
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { GLASS_PRESETS, type GlassPresetId } from "@/lib/materials/glassPresets";
import { CONFIGURATOR_FAMILIES, familyForSlug,
         type ConfiguratorFamily } from "@/lib/configurator/families";

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

/** THE 10 CAPS — SKU-derived (BlkDot/Wht/MattCu/MattGl/MattSl/PnkDot/
 *  ShBlk/ShnGl/ShnSl/SlDot). Dot caps render on the DOTS geometry. */
const CAPS: { id: string; label: string; swatch: string }[] = [
    { id: "CAP_SHINY_BLACK", label: "Black", swatch: "linear-gradient(145deg,#3a3a3a,#0b0b0b)" },
    { id: "CAP_WHITE", label: "White", swatch: "linear-gradient(145deg,#ffffff,#e2e0da)" },
    { id: "CAP_SHINY_GOLD", label: "Shiny gold", swatch: "linear-gradient(145deg,#fff4d0,#c9a24a)" },
    { id: "CAP_MATTE_GOLD", label: "Matte gold", swatch: "linear-gradient(145deg,#ecdcae,#b39a63)" },
    { id: "CAP_SHINY_SILVER", label: "Shiny silver", swatch: "linear-gradient(145deg,#ffffff,#b9bcbe)" },
    { id: "CAP_MATTE_SILVER", label: "Matte silver", swatch: "linear-gradient(145deg,#e6e6e4,#a9adae)" },
    { id: "CAP_COPPER", label: "Matte copper", swatch: "linear-gradient(145deg,#d99a6c,#8f4f2c)" },
    { id: "CAP_DOTS_BLACK", label: "Black dot", swatch: "radial-gradient(circle at 35% 35%, #161616 42%, #efece3 46%)" },
    { id: "CAP_DOTS_PINK", label: "Pink dot", swatch: "radial-gradient(circle at 35% 35%, #dcc3ca 42%, #efece3 46%)" },
    { id: "CAP_DOTS_SILVER", label: "Silver dot", swatch: "radial-gradient(circle at 35% 35%, #b9bcbe 42%, #efece3 46%)" },
];

/** spray collar colours (6, SKU-derived) — pump uses the first 3 */
const TRIMS: { id: string; label: string; swatch: string; pump: boolean }[] = [
    { id: "CAP_SHINY_BLACK", label: "Black", swatch: "linear-gradient(145deg,#3a3a3a,#0b0b0b)", pump: true },
    { id: "CAP_SHINY_GOLD", label: "Gold", swatch: "linear-gradient(145deg,#fff4d0,#c9a24a)", pump: true },
    { id: "CAP_MATTE_SILVER", label: "Matte silver", swatch: "linear-gradient(145deg,#e6e6e4,#a9adae)", pump: true },
    { id: "CAP_SHINY_SILVER", label: "Shiny silver", swatch: "linear-gradient(145deg,#ffffff,#b9bcbe)", pump: false },
    { id: "SPRAY_TURQUOISE", label: "Turquoise", swatch: "linear-gradient(145deg,#37b6b8,#136a6c)", pump: false },
    { id: "SPRAY_RED", label: "Red", swatch: "linear-gradient(145deg,#c93540,#7c0f18)", pump: false },
    { id: "CAP_MATTE_GOLD", label: "Matte gold", swatch: "linear-gradient(145deg,#ecdcae,#b39a63)", pump: true },
    { id: "CAP_COPPER", label: "Copper", swatch: "linear-gradient(145deg,#e8b18b,#9c5c38)", pump: true },
];

const BASES = [
    { id: "none", label: "Bottle" },
    { id: "roller", label: "Roll-on" },
    { id: "reducer", label: "Reducer" },
    { id: "sprayer", label: "Spray" },
    { id: "pump", label: "Pump" },
] as const;
type BaseId = (typeof BASES)[number]["id"];

/** SKU-truth navigation: the family's 15 product groups are
 *  cylinder-9ml-{colour}-17-415-{closure}. A glass swatch or closure-base
 *  change NAVIGATES to the sibling product so the SKU, price and fitment
 *  panel always match what is on screen — the configurator is the product
 *  selector, not a separate toy. */
function siblingSlug(fam: ConfiguratorFamily, current: string,
                     glass: GlassPresetId, base: string): string | null {
    if (!fam.slugRe.test(current)) return null;
    const currentToken = current.split("-").pop() ?? "";
    const closure = fam.slugClosure[base as keyof typeof fam.slugClosure]
        ?? currentToken;
    const colour = fam.slugColour[glass];
    if (!colour) return null;
    return fam.buildSlug(colour, closure);
}

export default function BottleConfigurator({
    bodyId = "Cyl-round-17-415-70x20",
    initialGlass = "amber",
    currentSlug = "",
    className = "",
}: {
    bodyId?: string;
    initialGlass?: GlassPresetId;
    /** enables SKU-truth navigation between sibling product groups */
    currentSlug?: string;
    className?: string;
}) {
    const router = useRouter();
    const fam = familyForSlug(currentSlug) ?? CONFIGURATOR_FAMILIES[0];
    const [glass, setGlass] = useState<GlassPresetId>(initialGlass);
    const slugClosure = currentSlug.split("-").pop() ?? "";
    const [base, setBase] = useState<BaseId>(
        fam.closureFromSlug[slugClosure] ?? (fam.bases.includes("roller") ? "roller" : "sprayer"));
    const [withCap, setWithCap] = useState(false);
    const [capMat, setCapMat] = useState("CAP_SHINY_GOLD");
    const [rollerVariant, setRollerVariant] = useState<"metal" | "plastic">("metal");
    const [trimMat, setTrimMat] = useState("CAP_SHINY_BLACK");
    const capLabel = CAPS.find((c) => c.id === capMat)?.label ?? "";
    const closure =
        base === "none" ? "none"
        : base === "roller" ? (withCap ? "rollerCapped" : "roller")
        : base === "reducer" ? (withCap ? "reducerCapped" : "reducer")
        : base === "sprayer" ? (withCap ? "sprayerCapped" : "sprayer")
        : withCap ? "pumpCapped" : "pump";
    const closureLabel =
        base === "none" ? "Bottle only"
        : base === "roller" ? (withCap ? `Roll-on · ${capLabel} cap` : "Roll-on")
        : base === "reducer" ? (withCap ? `Reducer · ${capLabel} cap` : "Pour reducer")
        : base === "sprayer" ? (withCap ? "Fine-mist spray · Overcap" : "Fine-mist spray")
        : withCap ? "Lotion pump · Overcap" : "Lotion pump";
    const trimLabel = TRIMS.find((t) => t.id === trimMat)?.label ?? "";

    return (
        <div className={className}>
            {/* ------------------------------------------------ the vitrine */}
            <div className="relative">
                <Bottle3DViewer
                    bodyId={fam.bodyForGlass?.[glass] ?? fam.bodyDefault ?? bodyId}
                    finish={fam.finish}
                    glass={glass}
                    closure={closure}
                    capMat={capMat}
                    rollerVariant={rollerVariant}
                    trimMat={trimMat}
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
                    {fam.glasses
                        .filter((id) => GLASS_PRESETS[id].configuratorReady !== false)
                        .map((id) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => {
                                setGlass(id);
                                const to = siblingSlug(fam, currentSlug, id, base);
                                if (to && to !== currentSlug) router.push(`/products/${to}`);
                            }}
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

                {/* segmented closure control + cap toggle */}
                <div className="flex flex-wrap items-center justify-center gap-2 px-2">
                    <div className="inline-flex rounded-full border border-champagne bg-warm-white p-0.5">
                        {BASES.filter((c) => fam.bases.includes(c.id)).map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                    setBase(c.id);
                                    if (c.id !== "none") {
                                        const to = siblingSlug(fam, currentSlug, glass, c.id);
                                        if (to && to !== currentSlug) router.push(`/products/${to}`);
                                    }
                                }}
                                aria-pressed={base === c.id}
                                className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.14em] font-bold transition-colors duration-200 ${
                                    base === c.id
                                        ? "bg-obsidian text-bone"
                                        : "text-ash hover:text-ink"
                                }`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                    {base === "roller" ? (
                        <div className="inline-flex rounded-full border border-champagne bg-warm-white p-0.5">
                            {(["metal", "plastic"] as const).map((v) => (
                                <button key={v} type="button"
                                        onClick={() => setRollerVariant(v)}
                                        aria-pressed={rollerVariant === v}
                                        className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.14em] font-bold transition-colors duration-200 ${
                                            rollerVariant === v ? "bg-obsidian text-bone" : "text-ash hover:text-ink"
                                        }`}>
                                    {v}
                                </button>
                            ))}
                        </div>
                    ) : null}
                    {base !== "none" ? (
                        <button
                            type="button"
                            onClick={() => setWithCap(!withCap)}
                            aria-pressed={withCap}
                            className={`px-3 py-1.5 rounded-full border text-[10px] uppercase tracking-[0.16em] font-bold transition-colors duration-200 ${
                                withCap
                                    ? "border-obsidian bg-obsidian text-bone"
                                    : "border-champagne bg-warm-white text-ash hover:text-ink"
                            }`}
                        >
                            {base === "roller" || base === "reducer" ? "+ Cap" : "+ Overcap"}
                        </button>
                    ) : null}
                </div>

                {/* spray / pump trim colours */}
                {base === "sprayer" || base === "pump" ? (
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-[9px] uppercase tracking-[0.22em] font-bold text-muted-gold">
                            {base === "sprayer" ? `Sprayer · ${trimLabel}` : `Pump · ${trimLabel}`}
                        </span>
                        <div className="flex items-center gap-2.5">
                            {TRIMS.filter((t) => (fam.trims ? fam.trims.includes(t.id) : !["CAP_MATTE_GOLD", "CAP_COPPER"].includes(t.id)))
                                        .filter((t) => base === "sprayer" || t.pump).map((t) => (
                                <button key={t.id} type="button" onClick={() => setTrimMat(t.id)}
                                        aria-label={`${t.label} ${base}`} aria-pressed={trimMat === t.id}
                                        title={t.label}
                                        className={`h-6 w-6 rounded-full transition-all duration-200 ${
                                            trimMat === t.id
                                                ? "ring-2 ring-muted-gold ring-offset-2 ring-offset-linen scale-105"
                                                : "ring-1 ring-champagne hover:ring-ash"
                                        }`}
                                        style={{ background: t.swatch }} />
                            ))}
                        </div>
                    </div>
                ) : null}

                {/* cap finishes — only when capped */}
                <AnimatePresence initial={false}>
                    {closure === "rollerCapped" || closure === "reducerCapped" ? (
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
