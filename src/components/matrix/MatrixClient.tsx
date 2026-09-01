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

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, WarningCircle, Check } from "@/components/icons";
import { ClosureIcon, BottleOnlyIcon } from "./ClosureIcon";
import { cn } from "@/lib/utils";
import { resolveChargedUnitPrice } from "@/lib/volumePricing";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";

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

    const rows = useMemo(() => initialRows?.rows ?? [], [initialRows]);

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
            necks: uniq(rows.map((r) => r.neckThreadSize)),
            closures: uniq(rows.flatMap((r) => Object.keys(r.components))),
        };
    }, [rows]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (size && (r.capacity ?? "") !== size) return false;
            if (finish && (r.color ?? "") !== finish) return false;
            if (neck && (r.neckThreadSize ?? "") !== neck) return false;
            if (closure && !(r.components[closure]?.length)) return false;
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
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pb-40">
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

            {/* toolbar — every filter is scoped to the open family */}
            <div className="bg-white border border-champagne/60 rounded-[3px] p-2.5
                            flex flex-wrap items-center gap-2 mb-3.5">
                <select
                    value={openFamily ?? ""}
                    onChange={(e) => router.replace(`/matrix?family=${encodeURIComponent(e.target.value)}`)}
                    className="bg-white border border-obsidian rounded-[3px] px-2.5 py-1.5
                               text-spec font-semibold text-obsidian"
                >
                    {families.map((f) => (
                        <option key={f.family} value={f.family}>{f.family}</option>
                    ))}
                </select>

                <Filter label="All sizes" value={size} onChange={setSize} options={options.sizes} />
                <Filter label="All finishes" value={finish} onChange={setFinish} options={options.finishes} />
                <Filter label="All necks" value={neck} onChange={setNeck} options={options.necks} />
                <Filter label="All closures" value={closure} onChange={setClosure} options={options.closures} />

                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search within family…"
                    className="w-[190px] bg-warm-white border border-champagne rounded-[3px]
                               px-2.5 py-1.5 text-spec text-obsidian placeholder:text-ash
                               focus-visible:outline-2 focus-visible:outline-offset-2
                               focus-visible:outline-muted-gold"
                />

                {filtered && (
                    <button type="button" onClick={clearAll}
                        className="text-spec font-semibold text-gold-dim underline
                                   transition-colors duration-200 hover:text-muted-gold">
                        Clear
                    </button>
                )}

                <div className="flex-1" />
                {initialRows && (
                    <span className="text-caption text-ash tabular-nums">
                        {visible.length} of {initialRows.rowCount}
                        {initialRows.truncated && " · truncated"}
                    </span>
                )}
            </div>

            {/* the open family */}
            {initialRows ? (
                <section className="bg-white border border-champagne/60 rounded-[3px] overflow-hidden">
                    <header className="flex items-center gap-3 px-4 py-3 border-b border-champagne/60">
                        <h2 className="font-serif text-[18px] font-semibold text-obsidian">
                            {initialRows.family} Family
                        </h2>
                        <span className="text-caption text-slate">
                            {initialRows.rowCount} variants
                        </span>
                    </header>

                    <div className="hidden lg:grid grid-cols-[400px_112px_112px_88px_1fr_132px_104px]
                                    gap-4 px-5 py-2.5 bg-warm-white border-b border-champagne/60
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
            <div className="grid grid-cols-1 lg:grid-cols-[400px_112px_112px_88px_1fr_132px_104px]
                            gap-4 items-center px-5 py-3.5 text-ui">
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
                    onClick={() => onChange({})}
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
    const [openType, setOpenType] = useState<string | null>(null);
    const types = Object.entries(row.components).filter(([, xs]) => xs.length > 0);

    if (config?.component) {
        return (
            <button type="button"
                onClick={() => { onChange({ component: undefined }); setOpenType(null); }}
                className="inline-flex items-center gap-2 max-w-full rounded-[3px]
                           bg-white border border-obsidian px-2.5 py-1.5 text-caption
                           font-semibold text-obsidian transition-colors duration-200
                           hover:border-muted-gold">
                <ClosureIcon type={config.component.groupKey ?? ""} size={20} />
                <span className="truncate">{shortName(config.component.itemName)}</span>
                <Check size={12} weight="bold" className="shrink-0 text-[#5B7B5D]" />
            </button>
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

    const variants = openType ? row.components[openType] ?? [] : [];

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1">
                {types.map(([t, xs]) => (
                    <button key={t} type="button"
                        title={`${t} · ${xs.length} compatible`}
                        onClick={() => {
                            // one variant needs no second step
                            if (xs.length === 1) onChange({ component: { ...xs[0], groupKey: t } });
                            else setOpenType(openType === t ? null : t);
                        }}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-[3px] px-2 py-1.5",
                            "text-caption font-semibold transition-colors duration-200",
                            openType === t
                                ? "bg-obsidian text-white"
                                : "border border-champagne text-slate hover:border-muted-gold hover:text-obsidian",
                        )}>
                        <ClosureIcon type={t} size={20} />
                        <span>{t}</span>
                        <span className="tabular-nums opacity-60">{xs.length}</span>
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

            {openType && (
                <ul className="flex flex-wrap gap-1">
                    {variants.map((c) => {
                        const out = (c.stockStatus ?? "").toLowerCase().includes("out");
                        return (
                            <li key={c.graceSku}>
                                <button type="button" disabled={out}
                                    onClick={() => onChange({ component: { ...c, groupKey: openType } })}
                                    className={cn(
                                        "rounded-[3px] border px-2 py-1 text-caption transition-colors duration-200",
                                        out
                                            ? "border-champagne/60 text-ash line-through cursor-not-allowed"
                                            : "border-champagne text-slate hover:border-obsidian hover:text-obsidian",
                                    )}
                                    title={out ? "Currently unavailable" : c.graceSku}>
                                    {finishLabel(c)}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
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
function Filter({ label, value, onChange, options }: {
    label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
    if (options.length <= 1) return null;   // a filter with one choice is furniture
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
            className={cn(
                "rounded-[3px] px-2.5 py-1.5 text-spec transition-colors duration-200",
                value
                    ? "bg-white border border-obsidian font-semibold text-obsidian"
                    : "bg-warm-white border border-champagne text-slate",
            )}
        >
            <option value="">{label}</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
    );
}

/** The row's photograph. A buying grid is scanned by eye before it is read,
 *  so the image well is reserved even when a product has no photo yet —
 *  otherwise rows jump horizontally as images load or fail. */
function BottleThumb({ row }: { row: MatrixRow }) {
    const [broken, setBroken] = useState(false);
    const src = row.imageUrl && !broken ? row.imageUrl : null;
    return (
        <span className="shrink-0 grid place-items-center w-[76px] h-[96px] rounded-[3px]
                         bg-product-well overflow-hidden">
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" loading="lazy" onError={() => setBroken(true)}
                     className="w-full h-full object-contain mix-blend-multiply" />
            ) : (
                <BottleOnlyIcon size={34} className="text-ash/60" />
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

/** A variant chip is the SECOND step — the type is already chosen, so the
 *  chip only has to say which finish. capColor when the catalog has it,
 *  otherwise the distinguishing words before the boilerplate ("Brown Faux
 *  Leather caps for glass bottles, Threaded…" is a finish plus a paragraph). */
function finishLabel(c: { capColor: string | null; itemName: string }) {
    if (c.capColor) return c.capColor;
    const head = c.itemName.split(/[.,·—]/)[0]
        .replace(/\s+(caps?|closures?|sprayers?|pumps?|droppers?)\s+for\b.*$/i, "")
        .replace(/\s+for\s+glass\b.*$/i, "")
        .trim();
    return shortName(head || c.itemName, 24);
}

function key(r: MatrixRow) {
    return r.graceSku ?? r.websiteSku ?? r.itemName ?? Math.random().toString();
}
