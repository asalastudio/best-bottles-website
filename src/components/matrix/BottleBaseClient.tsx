"use client";

/**
 * The Order Matrix as a configurator: one row per BOTTLE, not per SKU.
 *
 * Jordan: "1 physical bottle = 1 row. The 2,471 SKUs should remain underneath
 * the application as fulfillment records. They should largely disappear from
 * the browsing experience."
 *
 * WHAT CHANGED, AND WHY EACH PIECE IS HERE:
 *
 *  - COMPONENT TYPE IS GONE FROM THE FILTER BAR. Once the closure is something
 *    you choose inside a bottle, it stops being part of that row's identity;
 *    filtering by it would be filtering rows by a property they no longer have.
 *    Family / Size / Glass / Neck / Search are the whole bar.
 *
 *  - THE ROW PRICE IS "FROM". A BottleBase is not orderable and has no single
 *    price: on Bell 10 ml Clear the closure moves it between $0.60 and $0.90.
 *    Inventing a fixed price for the bottle would be fiction, so the row quotes
 *    the cheapest configuration and the exact price appears once one is chosen.
 *
 *  - "ADD" ONLY EXISTS AFTER A SKU RESOLVES. The row's action is Configure;
 *    Add to order appears in the drawer, next to the resolved SKU and its real
 *    price. No resolved SKU, no Add — an unconfigured bottle is not orderable
 *    and the interface should not pretend otherwise.
 *
 *  - BOTTLE ONLY IS OFFERED ONLY IF IT EXISTS. Every SKU in this catalogue has
 *    a closure fused into it, so for most bottles there is no bare-glass
 *    product to sell. Mapping "bottle only" onto the cheapest closure SKU would
 *    corrupt pricing, inventory and fulfilment, so the option simply does not
 *    appear unless a genuine bare SKU is found.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Check, Plus, Minus, Search, WarningCircle } from "@/components/icons";
import { cn } from "@/lib/utils";
import { getMaterialSwatchStyle } from "@/lib/products/material-swatches";
import { ClosureIcon, BottleOnlyIcon } from "./ClosureIcon";
import {
    toBottleBases, type BottleBase, type Configuration, type SkuRow,
} from "@/lib/matrix/bottleBase";

const ALL = "__all__";
const MIN_ORDER = 50;

type Family = { family: string; groups: number };
type Line = { config: Configuration; base: BottleBase; qty: number };

export default function BottleBaseClient({
    families, openFamily, rows,
}: {
    families: Family[];
    openFamily: string | null;
    rows: SkuRow[];
}) {
    const router = useRouter();
    const [size, setSize] = useState("");
    const [glass, setGlass] = useState("");
    const [neck, setNeck] = useState("");
    const [search, setSearch] = useState("");
    const [configuring, setConfiguring] = useState<BottleBase | null>(null);
    const [lines, setLines] = useState<Record<string, Line>>({});

    const bases = useMemo(() => toBottleBases(rows), [rows]);

    const options = useMemo(() => {
        const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];
        return {
            sizes: uniq(bases.map((b) => b.capacity))
                .sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)),
            glass: uniq(bases.map((b) => b.color)).sort(),
            necks: uniq(bases.map((b) => b.neck)).sort(),
        };
    }, [bases]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return bases.filter((b) => {
            if (size && b.capacity !== size) return false;
            if (glass && b.color !== glass) return false;
            if (neck && b.neck !== neck) return false;
            if (!q) return true;
            return `${b.family} ${b.capacity} ${b.color} ${b.neck}`.toLowerCase().includes(q);
        });
    }, [bases, size, glass, neck, search]);

    const order = useMemo(() => {
        const xs = Object.values(lines);
        const subtotal = xs.reduce((n, l) => n + (unitPrice(l.config, l.qty) ?? 0) * l.qty, 0);
        return { xs, subtotal, units: xs.reduce((n, l) => n + l.qty, 0) };
    }, [lines]);

    const filtered = Boolean(size || glass || neck || search.trim());

    return (
        <div className="max-w-[1760px] mx-auto px-4 sm:px-8 pb-40">
            <div className="flex items-end gap-4 pt-2 pb-4">
                <div>
                    <h1 className="font-serif font-medium text-[32px] leading-[1.12] tracking-[-0.02em] text-obsidian">
                        Order Matrix
                    </h1>
                    <p className="text-spec text-slate mt-1">
                        Choose a bottle, then its closure. Everyone pays the same price.
                    </p>
                </div>
                <div className="flex-1" />
                <a href="/matrix"
                   className="text-spec font-semibold text-slate border border-champagne rounded-[3px]
                              px-3 py-1.5 transition-colors duration-200 hover:border-muted-gold">
                    SKU view
                </a>
            </div>

            {/* 1 Bottle -> 2 Closure -> 3 Quantity. The interface teaches the rest. */}
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ui text-slate mb-3.5">
                {["Bottle", "Closure", "Quantity"].map((s, i) => (
                    <li key={s} className="flex items-center gap-2">
                        {i > 0 && <span className="text-ash">→</span>}
                        <span className="inline-flex items-center gap-1.5">
                            <span className="grid place-items-center w-5 h-5 rounded-full bg-obsidian
                                             text-white text-2xs font-bold tabular-nums">{i + 1}</span>
                            {s}
                        </span>
                    </li>
                ))}
            </ol>

            {/* NO COMPONENT TYPE FILTER — see the header comment */}
            <div className="bg-white border border-champagne/60 rounded-[3px] px-3 py-3 mb-3.5">
                <div className="flex flex-wrap items-end gap-x-2.5 gap-y-3">
                    <Field label="Bottle family">
                        <select
                            value={openFamily ?? ALL}
                            onChange={(e) => router.replace(
                                `/matrix?view=bottles&family=${encodeURIComponent(e.target.value)}`)}
                            className="w-full bg-white border-[1.5px] border-obsidian rounded-[3px]
                                       px-3 py-2.5 text-ui font-semibold text-obsidian"
                        >
                            <option value={ALL}>All families — search everything</option>
                            {families.map((f) => (
                                <option key={f.family} value={f.family}>{f.family}</option>
                            ))}
                        </select>
                    </Field>
                    <Filter field="Size" label="Any size" value={size} onChange={setSize} options={options.sizes} />
                    <Filter field="Glass" label="Any glass" value={glass} onChange={setGlass} options={options.glass} />
                    <Filter field="Neck" label="Any neck" value={neck} onChange={setNeck} options={options.necks} />
                    <Field label="Search bottles">
                        <span className="relative block">
                            <Search size={17} aria-hidden="true"
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ash" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)}
                                placeholder="Family, size or colour…"
                                className="w-[280px] bg-white border border-champagne rounded-[3px]
                                           pl-9 pr-3 py-2.5 text-ui text-obsidian placeholder:text-ash
                                           focus-visible:outline-2 focus-visible:outline-offset-2
                                           focus-visible:outline-muted-gold" />
                        </span>
                    </Field>
                    <div className="flex-1" />
                    <div className="flex items-center gap-3 pb-0.5">
                        <span className="text-caption text-slate tabular-nums">
                            Showing <strong className="font-semibold text-obsidian">{visible.length}</strong>
                            {" bottles · "}{bases.reduce((n, b) => n + b.skuCount, 0)} SKUs underneath
                        </span>
                        {filtered && (
                            <button type="button"
                                onClick={() => { setSize(""); setGlass(""); setNeck(""); setSearch(""); }}
                                className="inline-flex items-center gap-1.5 rounded-[3px] border border-champagne
                                           px-2.5 py-1.5 text-spec font-semibold text-gold-dim
                                           transition-colors duration-200 hover:border-muted-gold hover:text-obsidian">
                                <X size={12} weight="bold" />Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <section className="bg-white border border-champagne/60 rounded-[3px] overflow-hidden">
                <div className="hidden lg:grid grid-cols-[minmax(260px,1.1fr)_minmax(240px,1fr)_minmax(220px,1fr)_150px]
                                gap-4 px-6 py-3 bg-warm-white border-b border-champagne/60
                                text-2xs uppercase tracking-label font-bold text-ash">
                    <span>Bottle</span><span>Specification</span><span>Closures</span><span />
                </div>
                {visible.map((b) => (
                    <BaseRow key={b.key} base={b}
                        line={Object.values(lines).find((l) => l.base.key === b.key) ?? null}
                        onConfigure={() => setConfiguring(b)} />
                ))}
                {visible.length === 0 && (
                    <p className="px-4 py-8 text-center text-spec text-slate">No bottles match.</p>
                )}
            </section>

            {configuring && (
                <ConfigureDrawer
                    base={configuring}
                    existing={Object.values(lines).find((l) => l.base.key === configuring.key) ?? null}
                    onClose={() => setConfiguring(null)}
                    onAdd={(config, qty) => {
                        setLines((prev) => {
                            const next = { ...prev };
                            // one line per BottleBase — re-configuring replaces it
                            for (const [k, l] of Object.entries(next)) {
                                if (l.base.key === configuring.key) delete next[k];
                            }
                            next[config.sku] = { config, base: configuring, qty };
                            return next;
                        });
                        setConfiguring(null);
                    }}
                />
            )}

            <OrderBar order={order} />
        </div>
    );
}

/* --------------------------------------------------------------------- row */

function BaseRow({ base, line, onConfigure }: {
    base: BottleBase; line: Line | null; onConfigure: () => void;
}) {
    return (
        <div className={cn("border-b border-bone last:border-b-0",
                           line && "bg-[#F0F4EE] border-l-[3px] border-l-[#5B7B5D]")}>
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,1.1fr)_minmax(240px,1fr)_minmax(220px,1fr)_150px]
                            gap-4 items-center px-6 py-4">
                <div className="flex items-center gap-3.5 min-w-0">
                    <Thumb base={base} />
                    <div className="min-w-0">
                        <p className="text-md font-semibold leading-snug text-obsidian">
                            {base.color} {base.family}
                        </p>
                        <p className="text-caption text-ash mt-0.5 tabular-nums">
                            {base.skuCount} sellable {base.skuCount === 1 ? "SKU" : "SKUs"}
                        </p>
                    </div>
                </div>

                <div className="text-ui text-slate tabular-nums">
                    {base.capacity} · {base.color} · {base.neck}
                </div>

                <div className="min-w-0">
                    <p className="text-ui text-obsidian">
                        <strong className="font-semibold tabular-nums">{base.skuCount}</strong>
                        {" compatible "}{base.skuCount === 1 ? "closure" : "closures"}
                    </p>
                    <p className="text-caption text-slate tabular-nums mt-0.5">
                        {base.fromPrice != null ? `From ${money(base.fromPrice)} / unit` : "Price on request"}
                    </p>
                </div>

                <div>
                    {line ? (
                        <button type="button" onClick={onConfigure}
                            className="w-full rounded-[3px] bg-[#5B7B5D] text-white px-4 py-2.5
                                       text-ui font-semibold transition-colors duration-200">
                            <span className="flex items-center justify-center gap-1.5">
                                <Check size={13} weight="bold" />
                                {line.qty} × {line.config.label}
                            </span>
                        </button>
                    ) : (
                        <button type="button" onClick={onConfigure}
                            className="w-full rounded-[3px] border border-obsidian px-4 py-2.5
                                       text-ui font-semibold text-obsidian transition-colors duration-200
                                       hover:bg-obsidian hover:text-white">
                            Configure →
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function Thumb({ base }: { base: BottleBase }) {
    const [broken, setBroken] = useState(false);
    const src = base.imageUrl && !broken ? base.imageUrl : null;
    return (
        <span className="shrink-0 grid place-items-center w-[80px] h-[100px] rounded-[3px]
                         bg-product-well overflow-hidden">
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" loading="lazy" onError={() => setBroken(true)}
                     className="w-full h-full object-contain mix-blend-multiply" />
            ) : <BottleOnlyIcon size={34} className="text-ash/60" />}
        </span>
    );
}

/* ------------------------------------------------------------------ drawer */

function ConfigureDrawer({ base, existing, onClose, onAdd }: {
    base: BottleBase;
    existing: Line | null;
    onClose: () => void;
    onAdd: (c: Configuration, qty: number) => void;
}) {
    const [type, setType] = useState<string>(
        existing?.config.closureType ?? base.closureTypes[0]?.type ?? "");
    const [sku, setSku] = useState<string | null>(existing?.config.sku ?? null);
    const [qty, setQty] = useState(existing?.qty ?? 12);

    const group = base.closureTypes.find((g) => g.type === type) ?? base.closureTypes[0];
    const chosen = group?.options.find((o) => o.sku === sku) ?? null;
    const unit = chosen ? unitPrice(chosen, qty) : null;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end bg-obsidian/40 backdrop-blur-[2px]"
             onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div role="dialog" aria-modal="true"
                 className="w-full max-w-[520px] h-full flex flex-col bg-white
                            border-l border-champagne shadow-[0_0_60px_rgba(29,29,31,.25)]">
                <header className="px-6 pt-5 pb-4 border-b border-champagne/60 flex items-start gap-4">
                    <div className="min-w-0">
                        <p className="text-xs uppercase tracking-eyebrow font-semibold text-gold-dim">
                            Configure
                        </p>
                        <h2 className="font-serif text-[21px] leading-snug text-obsidian mt-1">
                            {base.capacity} {base.color} {base.family}
                        </h2>
                        <p className="text-caption text-slate mt-1 tabular-nums">{base.neck} neck</p>
                    </div>
                    <div className="flex-1" />
                    <button type="button" onClick={onClose} aria-label="Close"
                        className="shrink-0 rounded-[3px] p-1.5 text-slate hover:bg-warm-white hover:text-obsidian">
                        <X size={18} />
                    </button>
                </header>

                <div className="flex-1 overflow-auto px-6 py-5">
                    <p className="text-xs uppercase tracking-label font-bold text-ash mb-2.5">
                        Closure type
                    </p>
                    <div className="flex flex-col gap-1.5 mb-6">
                        {base.closureTypes.map((g) => (
                            <button key={g.type} type="button"
                                onClick={() => { setType(g.type); setSku(null); }}
                                className={cn(
                                    "flex items-center gap-3 rounded-[3px] border px-3 py-2.5 text-left",
                                    "transition-colors duration-200",
                                    g.type === type
                                        ? "border-[1.5px] border-obsidian bg-warm-white"
                                        : "border-champagne hover:border-muted-gold",
                                )}>
                                <ClosureIcon type={g.type} size={22} className="text-obsidian shrink-0" />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-ui font-semibold text-obsidian">{g.type}</span>
                                    <span className="block text-caption text-slate tabular-nums">
                                        {g.options.length} {g.options.length === 1 ? "finish" : "finishes"}
                                        {g.fromPrice != null && ` · from ${money(g.fromPrice)}`}
                                    </span>
                                </span>
                                {g.type === type && <Check size={15} weight="bold" className="text-obsidian" />}
                            </button>
                        ))}
                    </div>

                    {group && (
                        <>
                            <p className="text-xs uppercase tracking-label font-bold text-ash mb-2.5">
                                Finish
                            </p>
                            <ul className="grid grid-cols-3 gap-2.5">
                                {group.options.map((o) => (
                                    <li key={o.sku}>
                                        <button type="button" disabled={!o.inStock}
                                            onClick={() => setSku(o.sku)}
                                            className={cn(
                                                "w-full text-left rounded-[3px] border p-2 transition-colors duration-200",
                                                o.sku === sku
                                                    ? "border-[1.5px] border-obsidian bg-warm-white"
                                                    : "border-champagne hover:border-muted-gold",
                                                !o.inStock && "opacity-55 cursor-not-allowed",
                                            )}>
                                            <span className={cn("relative block w-full aspect-[4/3] rounded-[2px] overflow-hidden",
                                                                o.imageUrl ? "bg-white" : "bg-product-well")}
                                                  style={getMaterialSwatchStyle(o.finish, {
                                                      imageUrl: o.imageUrl, size: "contain" })} />
                                            <span className="block mt-1.5 text-caption font-semibold text-obsidian truncate">
                                                {o.label}
                                            </span>
                                            {o.price1 != null && (
                                                <span className="block text-2xs text-slate tabular-nums">
                                                    {money(o.price1)}
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            {group.options.some((o) => o.disambiguated) && (
                                <p className="flex items-start gap-1.5 mt-3 text-caption text-gold-dim">
                                    <WarningCircle size={13} weight="fill" className="shrink-0 mt-0.5" />
                                    Some finishes here share a name in the catalogue; the SKU is shown so
                                    the two can be told apart.
                                </p>
                            )}
                        </>
                    )}
                </div>

                {/* No resolved SKU, no Add. */}
                <footer className="border-t border-champagne/60 px-6 py-4">
                    {chosen ? (
                        <>
                            <div className="flex items-baseline gap-2 mb-1">
                                <p className="text-ui font-semibold text-obsidian">
                                    {chosen.closureType} · {chosen.label}
                                </p>
                            </div>
                            <p className="text-caption text-ash mb-3 tabular-nums">SKU {chosen.sku}</p>
                            <div className="flex items-center gap-3 mb-3">
                                <Stepper value={qty} onChange={setQty} />
                                <span className="text-ui text-slate tabular-nums">
                                    {unit != null ? `${money(unit)} / unit` : "price on request"}
                                </span>
                                <div className="flex-1" />
                                <span className="text-[18px] font-semibold text-obsidian tabular-nums">
                                    {unit != null ? money(unit * qty) : "—"}
                                </span>
                            </div>
                            <button type="button" onClick={() => onAdd(chosen, qty)}
                                className="w-full rounded-[3px] bg-obsidian text-white px-5 py-3
                                           text-ui font-semibold transition-colors duration-200
                                           hover:bg-muted-gold hover:text-obsidian">
                                Add to order
                            </button>
                        </>
                    ) : (
                        <p className="text-ui text-slate text-center py-2">
                            Choose a finish to see the price and add it.
                        </p>
                    )}
                </footer>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ pieces */

/** Volume pricing as the catalogue records it: the 12-piece tier at 12+. */
function unitPrice(c: Configuration, qty: number): number | null {
    if (qty >= 12 && c.price12 != null) return c.price12;
    return c.price1 ?? c.price12 ?? null;
}

const money = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <span className="inline-flex items-center border border-champagne rounded-[3px]">
            <button type="button" onClick={() => onChange(Math.max(1, value - 12))}
                className="px-2 py-1.5 text-slate hover:text-obsidian" aria-label="Fewer">
                <Minus size={13} />
            </button>
            <input type="number" min={1} value={value}
                onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
                className="w-14 text-center text-ui tabular-nums bg-transparent
                           focus-visible:outline-none" />
            <button type="button" onClick={() => onChange(value + 12)}
                className="px-2 py-1.5 text-slate hover:text-obsidian" aria-label="More">
                <Plus size={13} />
            </button>
        </span>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-spec uppercase tracking-label font-bold text-slate">{label}</span>
            {children}
        </label>
    );
}

function Filter({ field, label, value, onChange, options }: {
    field: string; label: string; value: string;
    onChange: (v: string) => void; options: string[];
}) {
    if (options.length <= 1) return null;
    return (
        <Field label={field}>
            <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={field}
                className={cn("w-full rounded-[3px] px-3 py-2.5 text-ui transition-colors duration-200",
                    value ? "bg-white border-[1.5px] border-obsidian font-semibold text-obsidian"
                          : "bg-warm-white border border-champagne text-slate")}>
                <option value="">{label}</option>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
        </Field>
    );
}

function OrderBar({ order }: {
    order: { xs: Line[]; subtotal: number; units: number };
}) {
    const met = order.subtotal >= MIN_ORDER;
    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-warm-white border-t border-champagne">
            <div className="max-w-[1760px] mx-auto px-4 sm:px-8 py-3 flex items-center gap-4">
                <div>
                    <p className="font-serif text-[15px] font-semibold text-obsidian">Your order</p>
                    <p className="text-caption text-slate tabular-nums">
                        {order.xs.length} configured · {order.units} units
                    </p>
                </div>
                <div className="flex-1" />
                <div className="text-right">
                    <p className="text-[18px] font-semibold text-obsidian tabular-nums">
                        {money(order.subtotal)}
                    </p>
                    <p className={cn("text-caption tabular-nums", met ? "text-slate" : "text-gold-dim")}>
                        {met ? "$50 order minimum met"
                             : `${money(MIN_ORDER - order.subtotal)} to reach the $50 minimum`}
                    </p>
                </div>
                <button type="button" disabled={!met || order.xs.length === 0}
                    title={order.xs.map((l) => `${l.qty} × ${l.config.sku}`).join("\n")}
                    className="rounded-[3px] bg-obsidian text-white px-5 py-2.5 text-spec font-semibold
                               transition-colors duration-200 hover:bg-muted-gold hover:text-obsidian
                               disabled:opacity-40 disabled:hover:bg-obsidian disabled:hover:text-white">
                    Add order to cart
                </button>
            </div>
        </div>
    );
}
