"use client";

/**
 * The Order Matrix — family accordion, compact configurable rows, an anchored
 * component picker, and a sticky order bar.
 *
 * ONE PRICE, AND THAT IS WHY IT IS NOT CALLED "WHOLESALE". Jordan: "they sell
 * at the same price for everyone. It's just that for business owners, they
 * will remove the tax." So there is no price column, no MOQ column and no volume ladder in
 * the rows — the single charged price appears once, in the order bar, and it
 * comes from resolveChargedUnitPrice() so this page can never quote a number
 * checkout will not honour.
 *
 * A COMPONENT IS NEVER IMPLIED. "Bottle Only" is an explicit choice; an unset
 * component cannot be added to an order. And a row whose compatibility could
 * not be resolved says so rather than showing an empty list that reads as
 * "takes nothing" — the matrix must not be the reason someone buys a cap that
 * does not fit.
 *
 * The picker only ever receives server-resolved compatible components
 * (convex/matrix.ts, which composes the same componentUtils the PDP uses).
 * Precedence lives on the server: exclusion → inclusion → exact fitment →
 * family inference, and unknown is never compatible.
 */

import { useMemo, useState, useSyncExternalStore } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { Plus, Minus, WarningCircle, Check, X, Search } from "@/components/icons";
import { ClosureIcon, BottleOnlyIcon } from "./ClosureIcon";
import { ComponentPickerModal } from "./ComponentPickerModal";
import { cn } from "@/lib/utils";
import { resolveChargedUnitPrice } from "@/lib/volumePricing";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import { getMaterialSwatchStyle } from "@/lib/products/material-swatches";

/* ------------------------------------------------------------------ types */

type Component = {
    graceSku: string;
    itemName: string;
    imageUrl: string | null;
    capColor: string | null;
    stockStatus: string | null;
    /** which closure group it came from — carried so the chosen chip can keep
     *  its icon after the type list collapses */
    groupKey?: string;
};

export type MatrixRow = {
    graceSku?: string | null;
    websiteSku?: string | null;
    itemName?: string | null;
    family?: string | null;
    applicator?: string | null;
    category?: string | null;
    capColor?: string | null;
    capStyle?: string | null;
    imageUrl?: string | null;
    capacity?: string | null;
    capacityMl?: number | null;
    neckThreadSize?: string | null;
    color?: string | null;
    shape?: string | null;
    stockStatus?: string | null;
    caseQuantity?: number | null;
    webPrice1pc?: number | null;
    webPrice10pc?: number | null;
    webPrice12pc?: number | null;
    components: Record<string, Component[]>;
    /** all-families mode ships counts instead of the lists — see page.tsx */
    componentCounts?: Record<string, number>;
    resolution: "fitment_rule" | "bottle_listed" | "unknown";
    bottleOnly: boolean;
};

type Family = { family: string; groups: number };

/** what the customer has configured on one row */
type Config = {
    /** null = Bottle Only, chosen explicitly. undefined = nothing chosen yet. */
    component?: Component | null;
    qty: number;
};

const MIN_ORDER = 50;

/** The sentinel for "every family", matching src/app/matrix/page.tsx. */
const ALL = "__all__";

/* --------------------------------------------------- the "seen it" flag ---
   A three-line external store so the instructions banner can be read during
   render without an effect, and so dismissing it updates every reader. */
const STEPS_KEY = "bb-matrix-steps";
let stepsListeners: Array<() => void> = [];
function subscribeSteps(cb: () => void) {
    stepsListeners = [...stepsListeners, cb];
    return () => { stepsListeners = stepsListeners.filter((x) => x !== cb); };
}
function readSteps() {
    try { return localStorage.getItem(STEPS_KEY) !== "done"; }
    catch { return true; }   // private mode — just show them
}
function dismissSteps() {
    try { localStorage.setItem(STEPS_KEY, "done"); } catch { /* ignore */ }
    for (const cb of stepsListeners) cb();
}

/* ------------------------------------------------------------------- page */

export default function MatrixClient({
    families, openFamily, initialRows,
}: {
    families: Family[];
    openFamily: string | null;
    initialRows: { family: string; rowCount: number; truncated: boolean; rows: MatrixRow[] } | null;
}) {
    const router = useRouter();
    const [configs, setConfigs] = useState<Record<string, Config>>({});
    const [search, setSearch] = useState("");
    const [size, setSize] = useState("");
    const [finish, setFinish] = useState("");
    const [neck, setNeck] = useState("");
    const [closure, setClosure] = useState("");

    /* THE THREE STEPS. Jordan: "Once they arrive there for the first time, it
       should surface very simple instructions." Shown by default and
       remembered once dismissed — a returning buyer who already knows the page
       should not scroll past the tutorial every visit.

       Read through useSyncExternalStore rather than an effect: localStorage
       does not exist during the server render, so the server snapshot is
       "show", and the client reconciles on hydration without a setState
       cascade. */
    const showSteps = useSyncExternalStore(subscribeSteps, readSteps, () => true);

    /* ORDER IS ASCENDING BY SIZE, ALWAYS. Jordan: "We are starting with a
       100 mL clear cylinder lotion pump first. Doesn't really make sense...
       We should have a consistent descending or ascending format per family."
       Convex returns rows in insertion order, which is arbitrary to a buyer;
       size then neck then name gives every family the same predictable shape,
       and makes a long family scannable without the filters. */
    const rows = useMemo(() => {
        const xs = [...(initialRows?.rows ?? [])];
        xs.sort((a, b) =>
            ml(a) - ml(b)
            || neckRank(a.neckThreadSize) - neckRank(b.neckThreadSize)
            || (a.itemName ?? "").localeCompare(b.itemName ?? ""));
        return xs;
    }, [initialRows]);

    /* FILTERS ARE FAMILY-SCOPED, and their OPTIONS come from the loaded family
       rather than the whole catalog. Jordan: "We should filter only at the
       family level... when they filter, it'll be for the whole family." A
       global option list would offer sizes and necks this family does not
       sell, and every one of them would return nothing. */
    const options = useMemo(() => {
        const uniq = (xs: (string | null | undefined)[]) =>
            [...new Set(xs.map((x) => (x ?? "").trim()).filter(Boolean))].sort();
        return {
            sizes: uniq(rows.map((r) => r.capacity))
                // "9 ml" before "100 ml" — string sort would not
                .sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)),
            finishes: uniq(rows.map((r) => r.color)),
            // GCMI codes first in numeric order, then plain mm, then the
            // non-thread necks (Ground, Plug, Press-Fit). A plain string sort
            // interleaves all three vocabularies.
            necks: uniq(rows.map((r) => r.neckThreadSize))
                .sort((a, b) => neckRank(a) - neckRank(b) || a.localeCompare(b)),
            closures: uniq(rows.flatMap((r) => Object.keys(componentsOf(r)))),
        };
    }, [rows]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (size && (r.capacity ?? "") !== size) return false;
            if (finish && (r.color ?? "") !== finish) return false;
            if (neck && (r.neckThreadSize ?? "") !== neck) return false;
            if (closure && !componentsOf(r)[closure]) return false;
            if (!q) return true;
            return `${r.itemName ?? ""} ${r.graceSku ?? ""} ${r.capacity ?? ""} ${r.color ?? ""}`
                .toLowerCase().includes(q);
        });
    }, [rows, search, size, finish, neck, closure]);

    const filtered = Boolean(size || finish || neck || closure || search.trim());
    const clearAll = () => { setSize(""); setFinish(""); setNeck(""); setClosure(""); setSearch(""); };

    /** Only rows with an EXPLICIT component decision count as configured. */
    const order = useMemo(() => {
        const lines = rows
            .map((r) => ({ row: r, cfg: configs[key(r)] }))
            .filter((l): l is { row: MatrixRow; cfg: Config } =>
                Boolean(l.cfg) && l.cfg!.component !== undefined && l.cfg!.qty > 0);
        let subtotal = 0;
        let priced = true;
        for (const { row, cfg } of lines) {
            const unit = resolveChargedUnitPrice(cfg.qty, row);
            if (unit == null) { priced = false; continue; }
            subtotal += unit * cfg.qty;
        }
        const units = lines.reduce((n, l) => n + l.cfg.qty, 0);
        return { lines, subtotal, units, priced };
    }, [rows, configs]);

    const setConfig = (r: MatrixRow, patch: Partial<Config>) =>
        setConfigs((c) => {
            // 12 is the starting quantity for a row nobody has touched; once a
            // row HAS a quantity it must survive a component change
            const prev = c[key(r)] ?? { qty: 12 };
            return { ...c, [key(r)]: { ...prev, ...patch } };
        });

    return (
        <div className="max-w-[1760px] mx-auto px-4 sm:px-8 pb-40">
            {/* header */}
            <div className="flex items-end gap-4 pt-2 pb-4">
                <div>
                    <h1 className="font-serif font-medium text-[32px] leading-[1.12] tracking-[-0.02em] text-obsidian">
                        Order Matrix
                    </h1>
                    <p className="text-spec text-slate mt-1">
                        Configure bottles and compatible components quickly.
                        {" "}Everyone pays the same price.
                    </p>
                </div>
                <div className="flex-1" />
                <a href="/catalog"
                   className="text-spec font-semibold text-slate border border-champagne rounded-[3px]
                              px-3 py-1.5 transition-colors duration-200 hover:border-muted-gold">
                    Visual Catalog
                </a>
            </div>

            {showSteps && (
                <div className="relative bg-white border border-champagne/60 rounded-[3px]
                                px-5 py-4 mb-3.5">
                    <button type="button" onClick={dismissSteps} aria-label="Hide these instructions"
                        className="absolute top-2.5 right-2.5 rounded-[3px] p-1 text-ash
                                   transition-colors duration-200 hover:bg-warm-white hover:text-obsidian">
                        <X size={15} />
                    </button>
                    <p className="text-xs uppercase tracking-eyebrow font-semibold text-gold-dim mb-3">
                        How to order here
                    </p>
                    <ol className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
                        <Step n={1} title="Find your bottle">
                            Choose a family, then narrow by size, colour or neck. Every row
                            shows one bottle at one size.
                        </Step>
                        <Step n={2} title="Choose a component">
                            Click a closure to open the picker. It only ever shows the caps,
                            sprayers and pumps that fit that bottle.
                        </Step>
                        <Step n={3} title="Set quantity, add">
                            Add as many rows as you like to one order. {"\u0024"}{MIN_ORDER} minimum,
                            and everyone pays the same price.
                        </Step>
                    </ol>
                </div>
            )}

            {/* TOOLBAR. Jordan: "the filter system needs to be extremely clear
                and self-evident from a user experience." Every control now
                carries a standing label above it rather than hiding the field
                name inside a placeholder option — with a bare select reading
                "All sizes", you cannot tell whether it is a filter, a sort or
                a jump, and once a value is chosen the field name disappears
                entirely. Each filter is scoped to the open family. */}
            <div className="bg-white border border-champagne/60 rounded-[3px] px-3 py-3 mb-3.5">
                <div className="flex flex-wrap items-end gap-x-2.5 gap-y-3">
                    {/* The family select sits in the same row as its siblings and is
                        styled like them — a heavier border and a helper line made it
                        read as a separate control bolted onto the toolbar. First-time
                        attention is carried by a ring that runs three times and stops,
                        plus a small annotation, both of which go away for good once
                        the instructions are dismissed. */}
                    <div className="relative">
                        {showSteps && (
                            <span className="animate-annotation-in absolute -top-9 left-0 z-20
                                             inline-flex items-center rounded-[3px] bg-obsidian
                                             px-2.5 py-1.5 text-spec font-semibold text-white
                                             whitespace-nowrap shadow-[0_4px_14px_rgba(29,29,31,.18)]">
                                Start here — pick your bottle
                                <span aria-hidden="true"
                                      className="absolute top-full left-5 border-[5px]
                                                 border-transparent border-t-obsidian" />
                            </span>
                        )}
                        <Field label="Bottle family" active>
                            <select
                                value={openFamily ?? ALL}
                                onChange={(e) => {
                                    dismissSteps();
                                    router.replace(`/matrix?family=${encodeURIComponent(e.target.value)}`);
                                }}
                                className={cn(
                                    "w-full bg-white border-[1.5px] border-obsidian rounded-[3px]",
                                    "px-3 py-2.5 text-ui font-semibold text-obsidian",
                                    showSteps && "animate-pick-ring",
                                )}
                            >
                                {/* the default, and first — a buyer who does not
                                    know our family names must not have to guess
                                    one before they can search */}
                                <option value={ALL}>All families — search everything</option>
                                {families.map((f) => (
                                    <option key={f.family} value={f.family}>{f.family}</option>
                                ))}
                            </select>
                        </Field>
                    </div>

                    <Filter field="Size" label="Any size" value={size} onChange={setSize} options={options.sizes} />
                    <Filter field="Glass colour" label="Any colour" value={finish} onChange={setFinish} options={options.finishes} />
                    <Filter field="Neck" label="Any neck" value={neck} onChange={setNeck} options={options.necks} />
                    <Filter field="Component type" label="Any component" value={closure} onChange={setClosure} options={options.closures} />

                    {/* SEARCH IS THE PRIMARY TOOL now that the page opens on every
                        family: a buyer who does not know our family names finds
                        their bottle by typing, not by guessing a category. Sized
                        to match. */}
                    <Field label="Search all products">
                        <span className="relative block">
                            <Search size={17} aria-hidden="true"
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ash" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Bottle name, colour or SKU…"
                                className="w-[300px] bg-white border border-champagne rounded-[3px]
                                           pl-9 pr-3 py-2.5 text-ui text-obsidian placeholder:text-ash
                                           focus-visible:outline-2 focus-visible:outline-offset-2
                                           focus-visible:outline-muted-gold"
                            />
                        </span>
                    </Field>

                    <div className="flex-1" />

                    <div className="flex items-center gap-3 pb-0.5">
                        {initialRows && (
                            <span className="text-caption text-slate tabular-nums">
                                Showing <strong className="font-semibold text-obsidian">{visible.length}</strong>
                                {" of "}{initialRows.rowCount}
                                {initialRows.truncated && " · truncated"}
                            </span>
                        )}
                        {filtered && (
                            <button type="button" onClick={clearAll}
                                className="inline-flex items-center gap-1.5 rounded-[3px] border border-champagne
                                           px-2.5 py-1.5 text-spec font-semibold text-gold-dim
                                           transition-colors duration-200 hover:border-muted-gold hover:text-obsidian">
                                <X size={12} weight="bold" />
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* the open family */}
            {initialRows ? (
                <section className="bg-white border border-champagne/60 rounded-[3px] overflow-hidden">
                    <header className="flex items-center gap-3 px-4 py-3 border-b border-champagne/60">
                        <h2 className="font-serif text-[18px] font-semibold text-obsidian">
                            {initialRows.family === ALL ? "All families" : `${initialRows.family} Family`}
                        </h2>
                        <span className="text-caption text-slate">
                            {initialRows.rowCount} variants
                        </span>
                    </header>

                    <div className="hidden xl:grid grid-cols-[minmax(280px,1.4fr)_92px_108px_84px_minmax(240px,1.5fr)_128px_96px]
                                    gap-4 px-6 py-3 bg-warm-white border-b border-champagne/60
                                    text-2xs uppercase tracking-label font-bold text-ash">
                        <span>Bottle</span><span>Size</span><span>Finish</span><span>Neck</span>
                        <span>Component</span><span>Qty</span><span />
                    </div>

                    {visible.length === 0 && (
                        <p className="px-4 py-8 text-center text-spec text-slate">
                            Nothing matches “{search}”.
                        </p>
                    )}

                    {visible.map((r) => (
                        <Row
                            key={key(r)} row={r}
                            config={configs[key(r)]}
                            onChange={(patch) => setConfig(r, patch)}
                        />
                    ))}
                </section>
            ) : (
                <p className="text-spec text-slate">No families available.</p>
            )}

            <OrderBar order={order} />
        </div>
    );
}

/* -------------------------------------------------------------------- row */

function Row({ row, config, onChange }: {
    row: MatrixRow;
    config?: Config;
    onChange: (patch: Partial<Config>) => void;
}) {
    const qty = config?.qty ?? 12;
    // undefined = undecided; null = Bottle Only, chosen on purpose
    const decided = config?.component !== undefined;
    const unknown = row.resolution === "unknown";

    return (
        <div className={cn(
            "relative border-b border-bone last:border-b-0",
            decided && "bg-[#F0F4EE] border-l-[3px] border-l-[#5B7B5D]",
        )}>
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,1.4fr)_92px_108px_84px_minmax(240px,1.5fr)_128px_96px]
                            gap-4 items-center px-6 py-4 text-ui">
                <div className="flex items-center gap-3.5 min-w-0">
                    <BottleThumb row={row} />
                    <div className="min-w-0">
                        {/* named the way the PDP names the same product —
                            capacity + colour + family + type — so the matrix
                            does not invent a second vocabulary for one catalog */}
                        <p className="text-sm font-semibold leading-snug text-obsidian">
                            {getCustomerFacingProductName({ variant: row }).displayName}
                        </p>
                        <p className="text-caption text-ash truncate mt-0.5">
                            {row.graceSku ?? row.websiteSku}
                        </p>
                    </div>
                </div>
                <span className="text-slate tabular-nums">{row.capacity ?? "—"}</span>
                <span className="text-slate">{row.color ?? "—"}</span>
                <span className="text-caption text-ash tabular-nums">
                    {row.neckThreadSize ?? "—"}
                </span>

                {/* COMPONENT — inline, not a popover. Jordan: "The components
                    would just be inline. We could probably just use icons."
                    In a dense grid a popover hides the one thing being
                    compared across rows; icons let the whole column be read
                    at a glance. */}
                <div className="min-w-0">
                    {unknown ? (
                        // NOT an empty list. Nothing is recorded for this bottle, and
                        // saying "no components" would read as "takes none".
                        <span className="inline-flex items-center gap-1.5 text-caption text-gold-dim">
                            <WarningCircle size={13} weight="fill" />
                            Compatibility not mapped — bottle only
                        </span>
                    ) : (
                        <ComponentChips row={row} config={config} onChange={onChange} />
                    )}
                </div>

                <Stepper value={qty} onChange={(q) => onChange({ qty: q })} />

                <button
                    type="button"
                    disabled={!decided}
                    // an empty patch merges no keys and left the row added
                    onClick={() => onChange({ component: undefined })}
                    className={cn(
                        "rounded-[3px] px-4 py-2 text-ui font-semibold transition-colors duration-200",
                        decided
                            ? "bg-[#5B7B5D] text-white"
                            : "border border-obsidian text-obsidian hover:bg-obsidian hover:text-white disabled:opacity-40",
                    )}
                >
                    {decided ? "Added" : "Add"}
                </button>
            </div>
        </div>
    );
}

/* ------------------------------------------------------- inline component */

/**
 * The closure choice, inline.
 *
 * One chip per closure type this bottle actually resolves to, plus Bottle
 * Only. Choosing a type with a single variant selects it outright; a type with
 * several opens its variants inline beneath, so the row never covers its
 * neighbours the way a popover does.
 *
 * The list is whatever the server resolved and nothing else — precedence
 * (exclusion → inclusion → exact fitment → family inference) lives in Convex,
 * and unknown is never compatible.
 */
function ComponentChips({ row, config, onChange }: {
    row: MatrixRow;
    config?: Config;
    onChange: (patch: Partial<Config>) => void;
}) {
    // Which type was clicked, or null when the picker is closed. The picker
    // shows EVERY compatible type, not only the one clicked — a buyer looking
    // at sprayers routinely leaves with a roll-on — and the clicked one is
    // simply ordered first.
    const [openType, setOpenType] = useState<string | null>(null);

    /* THE CHIPS NEED COUNTS; ONLY THE PICKER NEEDS THE LISTS. In all-families
       mode page.tsx ships componentCounts and an empty components map, because
       the full lists are 92% of a 24.59 MB payload. The one open row fetches
       its own — ~10 KB — and "skip" means no request until a picker opens. */
    const inline = Object.entries(row.components).filter(([, xs]) => xs.length > 0);
    const lean = inline.length === 0 && row.componentCounts !== undefined;

    const fetched = useQuery(
        api.matrix.getRowComponents,
        lean && openType !== null && row.graceSku ? { graceSku: row.graceSku } : "skip",
    );

    const types: [string, number][] = lean
        ? Object.entries(row.componentCounts ?? {}).filter(([, n]) => n > 0)
        : inline.map(([t, xs]) => [t, xs.length]);

    const pickerGroups = useMemo(() => {
        const source: Record<string, Component[]> = lean
            ? ((fetched?.components ?? {}) as Record<string, Component[]>)
            : row.components;
        const out: Record<string, Component[]> = {};
        if (openType && source[openType]?.length) out[openType] = source[openType];
        for (const [t, xs] of Object.entries(source)) {
            if (t !== openType && xs.length > 0) out[t] = xs;
        }
        return out;
    }, [lean, fetched, row.components, openType]);

    const picker = (
        <ComponentPickerModal
            open={openType !== null}
            loading={lean && openType !== null && fetched === undefined}
            bottleName={getCustomerFacingProductName({ variant: row }).displayName}
            neck={row.neckThreadSize}
            groups={pickerGroups}
            selectedSku={config?.component?.graceSku ?? null}
            onPick={(c) => {
                onChange({ component: c ? { ...c, groupKey: c.groupKey ?? openType ?? undefined } : null });
                setOpenType(null);
            }}
            onClose={() => setOpenType(null)}
        />
    );

    if (config?.component) {
        const chosen = config.component;
        return (
            <>
                <button type="button"
                    title="Change component"
                    onClick={() => setOpenType(chosen.groupKey ?? types[0]?.[0] ?? null)}
                    className="inline-flex items-center gap-2 max-w-full rounded-[3px]
                               bg-white border border-obsidian px-2.5 py-1.5 text-caption
                               font-semibold text-obsidian transition-colors duration-200
                               hover:border-muted-gold">
                    <ClosureIcon type={chosen.groupKey ?? ""} size={20} />
                    <span
                        aria-hidden="true"
                        className="shrink-0 w-5 h-5 rounded-full border border-champagne"
                        style={getMaterialSwatchStyle(chosen.capColor ?? null, {
                            imageUrl: chosen.imageUrl, size: "cover",
                        })}
                    />
                    <span className="truncate">{shortName(chosen.itemName)}</span>
                    <Check size={12} weight="bold" className="shrink-0 text-[#5B7B5D]" />
                </button>
                {picker}
            </>
        );
    }
    if (config?.component === null) {
        return (
            <button type="button" onClick={() => onChange({ component: undefined })}
                className="inline-flex items-center gap-2 rounded-[3px] bg-white
                           border border-champagne px-2.5 py-1.5 text-caption text-slate
                           transition-colors duration-200 hover:border-muted-gold">
                <BottleOnlyIcon size={20} />
                Bottle only
                <Check size={12} weight="bold" className="text-[#5B7B5D]" />
            </button>
        );
    }

    if (types.length === 0) {
        return <span className="text-caption text-ash">No compatible components</span>;
    }

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1">
                {types.map(([t, n]) => (
                    <button key={t} type="button"
                        title={`${t} — ${n} compatible, choose a finish`}
                        onClick={() => setOpenType(t)}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-[3px] px-2 py-1.5",
                            "text-caption font-semibold transition-colors duration-200",
                            "border border-champagne text-slate hover:border-muted-gold hover:text-obsidian",
                        )}>
                        <ClosureIcon type={t} size={20} />
                        <span>{t}</span>
                        {/* the finishes behind the chip, so the colour is
                            legible before the modal is ever opened */}
                        <span className="flex items-center -space-x-1 ml-0.5">
                            {(row.components[t] ?? []).slice(0, 4).map((c) => (
                                <span key={c.graceSku} aria-hidden="true"
                                    className="w-3.5 h-3.5 rounded-full border border-white
                                               ring-[0.5px] ring-champagne"
                                    style={getMaterialSwatchStyle(
                                        c.capColor ?? null,
                                        { imageUrl: c.imageUrl, size: "cover" },
                                    )} />
                            ))}
                        </span>
                        <span className="tabular-nums opacity-60">{n}</span>
                    </button>
                ))}
                <button type="button" title="Bottle only — no component"
                    onClick={() => onChange({ component: null })}
                    className="inline-flex items-center gap-1.5 rounded-[3px] px-2 py-1.5
                               text-caption font-semibold border border-dashed border-champagne
                               text-ash transition-colors duration-200
                               hover:border-muted-gold hover:text-gold-dim">
                    <BottleOnlyIcon size={20} />
                    <span>Bottle only</span>
                </button>
            </div>

            {picker}
        </div>
    );
}

/* ---------------------------------------------------------------- pieces */

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <div className="inline-flex items-center border border-champagne rounded-[3px] overflow-hidden">
            <button type="button" aria-label="Decrease"
                onClick={() => onChange(Math.max(1, value - 1))}
                className="px-2.5 py-2 text-slate hover:bg-warm-white transition-colors duration-200">
                <Minus size={13} />
            </button>
            <span className="px-2.5 text-ui font-semibold tabular-nums text-obsidian">{value}</span>
            <button type="button" aria-label="Increase"
                onClick={() => onChange(value + 1)}
                className="px-2.5 py-2 text-slate hover:bg-warm-white transition-colors duration-200">
                <Plus size={13} />
            </button>
        </div>
    );
}

function OrderBar({ order }: {
    order: { lines: unknown[]; subtotal: number; units: number; priced: boolean };
}) {
    const met = order.subtotal >= MIN_ORDER;
    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-warm-white border-t border-champagne">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
                <div>
                    <p className="font-serif text-[15px] font-semibold text-obsidian">Your order</p>
                    <p className="text-caption text-slate tabular-nums">
                        {order.lines.length} configuration{order.lines.length === 1 ? "" : "s"}
                        {" · "}{order.units} units
                    </p>
                </div>
                <div className="flex-1" />
                <div className="text-right">
                    <p className="text-[18px] font-semibold text-obsidian tabular-nums">
                        {order.priced
                            ? order.subtotal.toLocaleString("en-US", { style: "currency", currency: "USD" })
                            : "—"}
                    </p>
                    {/* the $50 rule is per ORDER, not per SKU — there is no MOQ */}
                    <p className={cn("text-caption tabular-nums",
                                     met ? "text-slate" : "text-gold-dim")}>
                        {met
                            ? "$50 order minimum met"
                            : `$${(MIN_ORDER - order.subtotal).toFixed(2)} to reach the $50 minimum`}
                    </p>
                </div>
                <button type="button" disabled={!met || order.lines.length === 0}
                    className="rounded-[3px] bg-obsidian text-white px-5 py-2.5 text-spec font-semibold
                               transition-colors duration-200 hover:bg-muted-gold hover:text-obsidian
                               disabled:opacity-40 disabled:hover:bg-obsidian disabled:hover:text-white">
                    Add order to cart
                </button>
            </div>
        </div>
    );
}

/** A family-scoped filter. Shows its own count so an option that would
 *  return nothing is visible as such before it is chosen. */
/** A labelled filter. `field` is the standing name of the column it filters;
 *  `label` is the "no choice made" option inside it. */
function Filter({ field, label, value, onChange, options }: {
    field: string; label: string; value: string;
    onChange: (v: string) => void; options: string[];
}) {
    if (options.length <= 1) return null;   // a filter with one choice is furniture
    return (
        <Field label={field} active={Boolean(value)}>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-label={field}
                className={cn(
                    "w-full rounded-[3px] px-3 py-2.5 text-ui transition-colors duration-200",
                    value
                        ? "bg-white border-[1.5px] border-obsidian font-semibold text-obsidian"
                        : "bg-warm-white border border-champagne text-slate",
                )}
            >
                <option value="">{label}</option>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
        </Field>
    );
}

/** A control with its name standing above it, always visible. A filter whose
 *  only label is its own placeholder loses that label the moment it is used. */
function Field({ label, active, children }: {
    label: string;
    active?: boolean;
    children: React.ReactNode;
}) {
    return (
        <label className="flex flex-col gap-1">
            <span className={cn(
                "text-spec uppercase tracking-label font-bold transition-colors duration-200",
                active ? "text-obsidian" : "text-slate",
            )}>
                {label}
                {active && <span className="ml-1 text-muted-gold">●</span>}
            </span>
            {children}
        </label>
    );
}

/** One of the three arrival instructions. */
function Step({ n, title, children }: {
    n: number; title: string; children: React.ReactNode;
}) {
    return (
        <li className="flex gap-3">
            <span className="shrink-0 grid place-items-center w-7 h-7 rounded-full
                             bg-obsidian text-white text-spec font-bold tabular-nums">
                {n}
            </span>
            <span className="min-w-0">
                <span className="block text-md font-semibold text-obsidian leading-snug">{title}</span>
                <span className="block text-md text-slate leading-relaxed mt-1">{children}</span>
            </span>
        </li>
    );
}

/** The row's photograph. A buying grid is scanned by eye before it is read,
 *  so the image well is reserved even when a product has no photo yet —
 *  otherwise rows jump horizontally as images load or fail. */
function BottleThumb({ row }: { row: MatrixRow }) {
    const [broken, setBroken] = useState(false);
    const src = row.imageUrl && !broken ? row.imageUrl : null;
    return (
        <span className="shrink-0 grid place-items-center w-[92px] h-[116px] rounded-[3px]
                         bg-product-well overflow-hidden">
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" loading="lazy" onError={() => setBroken(true)}
                     className="w-full h-full object-contain mix-blend-multiply" />
            ) : (
                <BottleOnlyIcon size={40} className="text-ash/60" />
            )}
        </span>
    );
}

/** The catalog's itemName is a marketing paragraph ("Cylinder shaped, matte
 *  aluminum 250 ml bottle with black sprayer. For use with cologne...").
 *  A picker row needs a NAME, so take the first clause and let the SKU carry
 *  the precision underneath it. */
function shortName(itemName: string, max = 46) {
    const first = itemName.split(/[.,·—]|\bFor use\b/i)[0].trim();
    return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first || itemName;
}

/** Capacity in ml for sorting. capacityMl is authoritative where present;
 *  otherwise the leading number of the printed capacity. Unsized rows sort
 *  last rather than pretending to be 0 ml. */
function ml(r: MatrixRow): number {
    if (typeof r.capacityMl === "number" && r.capacityMl > 0) return r.capacityMl;
    const n = parseFloat((r.capacity ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : Number.MAX_SAFE_INTEGER;
}

/**
 * One sortable number for a neck, across the three vocabularies the catalog
 * actually uses: GCMI finishes ("18-415"), bare millimetres ("16mm") and
 * closure methods with no size at all ("Ground", "Plug", "Press-Fit").
 */
function neckRank(neck: string | null | undefined): number {
    const n = (neck ?? "").trim();
    if (!n) return 9e8;
    const gcmi = /^(\d+)\s*[-/]\s*(\d+)$/.exec(n);
    if (gcmi) return Number(gcmi[1]) * 1000 + Number(gcmi[2]) / 1000;
    const mm = /^([\d.]+)\s*mm$/i.exec(n);
    if (mm) return 5e7 + parseFloat(mm[1]);
    return 8e8;   // Ground, Plug, Press-Fit, Snap-On, Specialty
}

/** Which closure types a row offers, and how many of each — from the counts in
 *  all-families mode, from the lists when a single family is loaded. */
function componentsOf(r: MatrixRow): Record<string, number> {
    if (r.componentCounts) return r.componentCounts;
    const out: Record<string, number> = {};
    for (const [t, xs] of Object.entries(r.components)) if (xs.length) out[t] = xs.length;
    return out;
}

function key(r: MatrixRow) {
    return r.graceSku ?? r.websiteSku ?? r.itemName ?? Math.random().toString();
}
