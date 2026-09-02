"use client";

/**
 * The component picker, as a modal.
 *
 * Jordan: "the modal should show up with a picker. That way, users can see
 * the color more clearly in the product detail." The thing a buyer is choosing
 * is a FINISH, and a finish has to be seen, not read.
 *
 * WHAT THE PICKER HAD TO FIX, measured on one real row — the 100 ml Clear
 * Cylinder, whose Sprayer chip resolves to 24 components:
 *
 *  1. NONE of those 24 carry a capColor. Every label therefore fell back to
 *     the itemName, and the itemName leads with the colour but buries the
 *     difference: "Lavender ... bulb sprayer with silver fittings" and
 *     "Lavender ... bulb sprayer with silver fittings and tassel" are
 *     different products that truncate to the same seven visible words. Seven
 *     such pairs exist in that one list, which is exactly the "duplicates"
 *     they appear to be. They are not duplicates and no SKU repeats — so
 *     describe() splits the name into COLOUR and the distinguishing clause
 *     and gives each its own line, instead of truncating away the clause that
 *     carries the whole difference.
 *
 *  2. That chip mixes two different products: 18 antique bulb sprayers and 6
 *     plain collar sprayers, interleaved. The nine bulb colours are Lavender,
 *     Pink, Matte Silver, Ivory Silver, Gold, Ivory Gold, White, Red and
 *     Black — and Black sat fourteen cards below the other eight, behind the
 *     collar sprayers, so the set read as eight. Sub-grouping by kind puts all
 *     nine together; nothing was missing from the data.
 *
 * SWATCHES ONLY WHERE THERE IS NO PHOTOGRAPH. Measured 2026-09-01 over the
 * 456 distinct components the catalogue actually offers: 25% carry an imageUrl
 * (and every one of those URLs resolves — unlike the bottle photography, which
 * is ~55% dead links), 69% carry a capColor, and 68% resolve to a material
 * gradient. Together that is 93% of components showing something real, with 34
 * falling back to an empty well.
 *
 * A photograph is always better, so it wins; the gradient is the honest
 * fallback for the rest. Per Jordan, a photograph sits on plain WHITE — the
 * ground it was shot and cut out on — never on a tinted well that would read
 * as part of the product.
 */

import { useEffect, useMemo, useRef } from "react";
import { X, Check, ShieldCheck, Question } from "@/components/icons";
import { cn } from "@/lib/utils";
import { getMaterialSwatchStyle } from "@/lib/products/material-swatches";
import { ClosureIcon, BottleOnlyIcon } from "./ClosureIcon";

export type PickerComponent = {
    graceSku: string;
    itemName: string;
    imageUrl: string | null;
    capColor: string | null;
    stockStatus: string | null;
    groupKey?: string;
};

export function ComponentPickerModal({
    open, loading, bottleName, neck, groups, selectedSku, onPick, onClose,
}: {
    open: boolean;
    /** all-families mode fetches this row's components when the picker opens */
    loading?: boolean;
    bottleName: string;
    neck: string | null | undefined;
    /** the server-resolved compatible set, by closure type */
    groups: Record<string, PickerComponent[]>;
    selectedSku?: string | null;
    onPick: (c: PickerComponent | null) => void;
    onClose: () => void;
}) {
    const panel = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";   // the page must not scroll behind
        panel.current?.focus();
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    const entries = useMemo(
        () => Object.entries(groups).filter(([, xs]) => xs.length > 0),
        [groups],
    );
    const total = entries.reduce((n, [, xs]) => n + xs.length, 0);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4
                       bg-obsidian/40 backdrop-blur-[2px]"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                ref={panel} tabIndex={-1}
                role="dialog" aria-modal="true" aria-label="Choose a component"
                className="w-full max-w-[1180px] max-h-[90vh] flex flex-col bg-white
                           border border-champagne rounded-[3px]
                           shadow-[0_28px_70px_rgba(29,29,31,.22)] outline-none"
            >
                <header className="px-6 pt-5 pb-4 border-b border-champagne/60">
                    <div className="flex items-start gap-4">
                        <div className="min-w-0">
                            <p className="text-xs uppercase tracking-eyebrow font-semibold text-gold-dim">
                                Step 2 — choose a component
                            </p>
                            <h2 className="font-serif text-[21px] leading-snug text-obsidian mt-1">
                                {bottleName}
                            </h2>
                        </div>
                        <div className="flex-1" />
                        <button type="button" onClick={onClose} aria-label="Close"
                            className="shrink-0 rounded-[3px] p-1.5 text-slate
                                       transition-colors duration-200 hover:bg-warm-white hover:text-obsidian">
                            <X size={18} />
                        </button>
                    </div>

                    {/* THE COMPATIBILITY CALLOUT. Jordan: "a clear header that
                        calls out the compatibility in the modal so customers
                        understand exactly what it is." The single most useful
                        thing this dialog knows is that everything inside it has
                        already been checked to fit — said plainly and up front,
                        not as fine print under the fold. */}
                    <div className="mt-3.5 flex items-start gap-2.5 rounded-[3px]
                                    bg-[#F0F4EE] border border-[#5B7B5D]/25 px-3 py-2.5">
                        <ShieldCheck size={18} weight="fill" className="shrink-0 mt-0.5 text-[#5B7B5D]" />
                        <p className="text-md text-obsidian">
                            <strong className="font-semibold">
                                {loading
                                    ? "Checking which components fit this bottle…"
                                    : total === 1
                                        ? "The one component we make for this bottle."
                                        : `Every one of these ${total} options fits this bottle.`}
                            </strong>{" "}
                            <span className="text-slate">
                                {neck ? (
                                    <>Matched to its{" "}
                                        <Hint label={`${neck} neck`}>
                                            The neck finish — bore diameter and thread pitch. A closure
                                            only seals on a matching finish, so anything that would not
                                            fit is never shown here.
                                        </Hint>.
                                    </>
                                ) : "Matched against our fitment chart."}
                            </span>
                        </p>
                    </div>
                </header>

                <div className="overflow-auto px-6 py-5 flex flex-col gap-7">
                    {entries.map(([type, items]) => (
                        <TypeSection
                            key={type} type={type} items={items}
                            selectedSku={selectedSku} onPick={onPick}
                        />
                    ))}

                    {loading && (
                        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                            {Array.from({ length: 10 }, (_, i) => (
                                <li key={i} className="rounded-[3px] border border-champagne p-2">
                                    <span className="block w-full aspect-[4/3] rounded-[2px]
                                                     bg-product-well animate-pulse" />
                                    <span className="block mt-2 h-3 w-2/3 rounded bg-product-well animate-pulse" />
                                </li>
                            ))}
                        </ul>
                    )}

                    {!loading && total === 0 && (
                        <p className="text-md text-slate py-6 text-center">
                            No compatible components are mapped for this bottle yet.
                        </p>
                    )}
                </div>

                {/* BOTTLE ONLY — a first-class choice, sized like one. Jordan:
                    "that would have to be a little bit bigger and more
                    prominent, and maybe even have a slight animation to call
                    it out." It competes with a wall of colour; the ring is slow
                    and disappears entirely under prefers-reduced-motion. */}
                <footer className="flex items-center gap-4 px-6 py-4 border-t border-champagne/60">
                    <button type="button" onClick={() => onPick(null)}
                        className="animate-bottle-only inline-flex items-center gap-3 rounded-[3px]
                                   border-[1.5px] border-muted-gold bg-warm-white px-5 py-3
                                   text-obsidian transition-colors duration-200
                                   hover:bg-obsidian hover:text-white hover:border-obsidian">
                        <BottleOnlyIcon size={26} />
                        <span className="text-left leading-tight">
                            <span className="block text-md font-semibold">Bottle only</span>
                            <span className="block text-ui opacity-70">No component</span>
                        </span>
                    </button>
                    <span className="text-ui text-slate">
                        <Hint label="When would I choose this?" align="left">
                            Order the glass on its own — useful when you already stock closures,
                            or want to buy caps separately. You can add components to the same
                            order as their own lines.
                        </Hint>
                    </span>
                    <div className="flex-1" />
                </footer>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------- sections */

/**
 * One closure type, sub-grouped by kind when it holds more than one.
 *
 * "Sprayer" is not one product. Grouping is what makes nine bulb colours
 * countable as nine, instead of reading as eight with a straggler.
 */
function TypeSection({ type, items, selectedSku, onPick }: {
    type: string;
    items: PickerComponent[];
    selectedSku?: string | null;
    onPick: (c: PickerComponent) => void;
}) {
    const subgroups = useMemo(() => {
        const by = new Map<string, PickerComponent[]>();
        for (const c of items) {
            const k = kindOf(c.itemName) ?? "";
            const xs = by.get(k);
            if (xs) xs.push(c); else by.set(k, [c]);
        }
        // one kind (or none identifiable) is a flat list, not a heading of one
        if (by.size <= 1) return [["", items] as [string, PickerComponent[]]];
        return [...by.entries()].sort((a, b) => kindRank(a[0]) - kindRank(b[0]));
    }, [items]);

    return (
        <section>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-champagne/50">
                <ClosureIcon type={type} size={22} className="text-obsidian" />
                <h3 className="text-md font-semibold text-obsidian">{type}</h3>
                <span className="text-caption text-ash tabular-nums">{items.length}</span>
            </div>

            <div className="flex flex-col gap-5">
                {subgroups.map(([kind, xs]) => (
                    <div key={kind || "_"}>
                        {kind && (
                            <p className="text-spec uppercase tracking-label font-semibold
                                          text-gold-dim mb-2.5">
                                {kind} <span className="text-ash tabular-nums">· {xs.length}</span>
                            </p>
                        )}
                        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                            {xs.map((c) => (
                                <li key={c.graceSku}>
                                    <Swatch
                                        component={{ ...c, groupKey: type }}
                                        selected={c.graceSku === selectedSku}
                                        onPick={onPick}
                                    />
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    );
}

/** One finish, shown big enough to judge. */
function Swatch({ component, selected, onPick }: {
    component: PickerComponent;
    selected: boolean;
    onPick: (c: PickerComponent) => void;
}) {
    const out = (component.stockStatus ?? "").toLowerCase().includes("out");
    const { color, detail } = describe(component);
    const hasPhoto = Boolean(component.imageUrl);
    const style = getMaterialSwatchStyle(color, {
        imageUrl: component.imageUrl,
        size: "contain",
    });

    return (
        <button
            type="button"
            disabled={out}
            onClick={() => onPick(component)}
            aria-pressed={selected}
            title={out ? "Currently unavailable" : component.itemName}
            className={cn(
                "group w-full h-full text-left rounded-[3px] border p-2 transition-colors duration-200",
                selected ? "border-[1.5px] border-obsidian bg-warm-white"
                         : "border-champagne hover:border-muted-gold",
                out && "opacity-55 cursor-not-allowed hover:border-champagne",
            )}
        >
            {/* a photograph sits on the white it was cut out on; only the
                gradient fallback fills the well itself */}
            <span className={cn(
                    "relative block w-full aspect-[4/3] rounded-[2px] overflow-hidden",
                    hasPhoto ? "bg-white" : "bg-product-well",
                )}
                  style={style}>
                {selected && (
                    <span className="absolute top-1.5 right-1.5 grid place-items-center
                                     w-5 h-5 rounded-full bg-obsidian text-white">
                        <Check size={12} weight="bold" />
                    </span>
                )}
                {out && (
                    <span className="absolute inset-x-0 bottom-0 bg-obsidian/70 text-white
                                     text-2xs text-center py-0.5">
                        Unavailable
                    </span>
                )}
            </span>

            {/* colour on its own line, then the clause that actually
                distinguishes this from its near-twin */}
            <span className="block mt-2 text-md font-semibold text-obsidian truncate">
                {color}
            </span>
            {detail && (
                <span className="block text-ui text-slate truncate">{detail}</span>
            )}
            <span className="block text-2xs text-ash truncate">{component.graceSku}</span>
        </button>
    );
}

/* --------------------------------------------------------------- tooltip */

/**
 * A tooltip, used sparingly. Jordan: "we need tooltips, not overwhelming, but
 * where it counts" — so this dialog has exactly two, on the two things a
 * first-time buyer genuinely cannot infer: what a neck finish is, and what
 * ordering the bottle alone means.
 *
 * Hover AND focus, so it is reachable from the keyboard, and a real element in
 * the flow rather than a title attribute that appears only after a second of
 * stillness and never appears on touch at all.
 */
function Hint({ label, children, align = "center" }: {
    label: string;
    children: React.ReactNode;
    align?: "center" | "left";
}) {
    return (
        <span className="relative inline-flex group/hint">
            <button type="button"
                className="inline-flex items-center gap-1 text-inherit underline decoration-dotted
                           underline-offset-2 decoration-champagne
                           hover:decoration-muted-gold focus:outline-none
                           focus-visible:ring-1 focus-visible:ring-muted-gold rounded-[2px]">
                {label}
                <Question size={13} className="shrink-0 opacity-60" />
            </button>
            <span
                role="tooltip"
                className={cn(
                    "pointer-events-none absolute bottom-full mb-2 z-10 w-[320px]",
                    "rounded-[3px] bg-obsidian px-4 py-3 text-md leading-relaxed text-white",
                    "opacity-0 translate-y-1 transition-all duration-200",
                    "group-hover/hint:opacity-100 group-hover/hint:translate-y-0",
                    "group-focus-within/hint:opacity-100 group-focus-within/hint:translate-y-0",
                    align === "left" ? "left-0" : "left-1/2 -translate-x-1/2",
                )}
            >
                {children}
            </span>
        </span>
    );
}

/* ----------------------------------------------------------------- naming */

/**
 * The sub-kind inside a closure type.
 *
 * TASSEL IS ITS OWN GROUP. Merging it into the bulb sprayers is what pushed
 * the black bulb to the bottom of the list: the nine plain bulbs and the nine
 * tasselled ones interleave in catalog order, and Black happens to sit last in
 * both runs. Split, each colourway is a complete row of nine.
 */
function kindOf(itemName: string): string | null {
    const n = itemName.toLowerCase();
    if (n.includes("bulb sprayer")) {
        return n.includes("tassel") ? "Antique bulb sprayer — with tassel" : "Antique bulb sprayer";
    }
    if (n.includes("collar sprayer")) return "Collar sprayer";
    return null;
}

/** Plain before decorated before plumbing, so the eye lands on the simplest
 *  form first. Anything unrecognised sorts last, never dropped. */
const KIND_ORDER = [
    "Antique bulb sprayer",
    "Antique bulb sprayer — with tassel",
    "Collar sprayer",
];
function kindRank(k: string) {
    const i = KIND_ORDER.indexOf(k);
    return i === -1 ? KIND_ORDER.length : i;
}

/**
 * Split a component name into the colour and the clause that distinguishes it.
 *
 * capColor is right when it exists — but on the row this was built against,
 * not one of 24 sprayers had it, so the fallback is not a rare path. The
 * itemName leads with the colour and puts the difference in a "with ..."
 * clause; truncating that clause is exactly what makes seven distinct products
 * look like duplicates.
 */
function describe(c: PickerComponent): { color: string; detail: string } {
    const name = c.itemName ?? "";

    // "... with silver fittings and tassel. Thread Size 18-415" -> the clause
    const withClause = /\bwith\s+([^.]+?)(?:\.|,\s*thread|$)/i.exec(name)?.[1]?.trim();

    // thread size is on the card's own header already; never in the label
    const bare = name
        .replace(/\bthread\s*size\s*[:\s]*\d{1,2}-?\d{3}/gi, "")
        .replace(/\b\d{1,2}-\d{3}\b/g, "")
        .replace(/[,\s.]+$/, "")
        .trim();

    // The catalogue writes names two ways round, and only one of them was
    // handled before:
    //   "Lavender Antique or Vintage style bulb sprayer ..."  colour first
    //   "Cap/Closure Shiny Black Clear"                       type first
    // For the second shape the old split returned "Cap/" and fell through to
    // capColor -- which on those rows is the single word "Clear". That is how
    // one bottle came to show 64 cards all labelled "Clear"; their names hold
    // 17 distinct finishes, and capColor was the LESS specific of the two.
    const leadingType = /^\s*(cap\s*\/\s*closure|closure|cap|antique\s+bulb\s+sprayer|bulb\s+sprayer|collar\s+sprayer|sprayer|lotion\s+pump|perfume\s+(?:spray\s+)?pump|pump|dropper|roll[-\s]?on\s+cap|metal\s+roller|plastic\s+roller|roller|reducer|atomizer|accessory|plug)\b/i;

    let label = "";
    if (leadingType.test(bare)) {
        label = bare.replace(leadingType, "").replace(/^[\s\-–—/]+/, "").trim();
    } else {
        label = bare
            .split(/\b(?:antique|vintage|collar|bulb|sprayer|cap|closure|pump|dropper|roller|reducer)\b/i)[0]
            .replace(/[,\s]+$/, "")
            .trim();
    }

    // capColor is the FALLBACK now, not the preference — it is reliable but
    // coarse, and a coarse label on a wall of cards is the same as no label.
    // "Sprayer thread 18-415" loses its size above and leaves a bare "Thread"
    // behind — a word that labels nothing. Drop it and fall through.
    label = label.replace(/^thread\b/i, "").replace(/\bthread$/i, "").replace(/[\s:.-]+$/, "").trim();

    const color = label || c.capColor || bare || name;
    return {
        color: trim(color, 26),
        detail: withClause ? trim(sentence(withClause), 30) : "",
    };
}

function sentence(s: string) {
    const t = s.replace(/\s+and\s+/gi, " · ").trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
}

function trim(s: string, max: number) {
    return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}
