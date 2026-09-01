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
import { Plus, Minus, WarningCircle } from "@/components/icons";
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
    const [picker, setPicker] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const rows = initialRows?.rows ?? [];
    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) =>
            `${r.itemName ?? ""} ${r.graceSku ?? ""} ${r.capacity ?? ""} ${r.color ?? ""}`
                .toLowerCase().includes(q));
    }, [rows, search]);

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

            {/* toolbar */}
            <div className="bg-white border border-champagne/60 rounded-[3px] p-2.5 flex items-center gap-2.5 mb-3.5">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search within results…"
                    className="w-[230px] bg-warm-white border border-champagne rounded-[3px]
                               px-2.5 py-1.5 text-spec text-obsidian placeholder:text-ash
                               focus-visible:outline-2 focus-visible:outline-offset-2
                               focus-visible:outline-muted-gold"
                />
                <select
                    value={openFamily ?? ""}
                    onChange={(e) => router.replace(`/matrix?family=${encodeURIComponent(e.target.value)}`)}
                    className="bg-warm-white border border-champagne rounded-[3px] px-2.5 py-1.5
                               text-spec text-obsidian"
                >
                    {families.map((f) => (
                        <option key={f.family} value={f.family}>
                            {f.family} · {f.groups} groups
                        </option>
                    ))}
                </select>
                <div className="flex-1" />
                {initialRows && (
                    <span className="text-caption text-ash tabular-nums">
                        {visible.length} of {initialRows.rowCount} rows
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

                    <div className="hidden lg:grid grid-cols-[356px_104px_104px_84px_1fr_120px_92px]
                                    gap-3 px-4 py-2 bg-warm-white border-b border-champagne/60
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
                            pickerOpen={picker === key(r)}
                            onTogglePicker={() => setPicker(picker === key(r) ? null : key(r))}
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

function Row({ row, config, pickerOpen, onTogglePicker, onChange }: {
    row: MatrixRow;
    config?: Config;
    pickerOpen: boolean;
    onTogglePicker: () => void;
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
            <div className="grid grid-cols-1 lg:grid-cols-[356px_104px_104px_84px_1fr_120px_92px]
                            gap-3 items-center px-4 py-2 text-spec">
                <div className="flex items-center gap-2.5 min-w-0">
                    <BottleThumb row={row} />
                    <div className="min-w-0">
                        {/* named the way the PDP names the same product —
                            capacity + colour + family + type — so the matrix
                            does not invent a second vocabulary for one catalog */}
                        <p className="font-semibold text-obsidian truncate">
                            {getCustomerFacingProductName({ variant: row }).displayName}
                        </p>
                        <p className="text-2xs text-ash truncate">
                            {row.graceSku ?? row.websiteSku}
                        </p>
                    </div>
                </div>
                <span className="text-slate tabular-nums">{row.capacity ?? "—"}</span>
                <span className="text-slate">{row.color ?? "—"}</span>
                <span className="text-caption text-ash tabular-nums">
                    {row.neckThreadSize ?? "—"}
                </span>

                {/* component cell */}
                <div className="relative">
                    {unknown ? (
                        // NOT an empty list. Nothing is recorded for this bottle, and
                        // saying "no components" would read as "takes none".
                        <span className="inline-flex items-center gap-1.5 text-caption text-gold-dim">
                            <WarningCircle size={13} weight="fill" />
                            Compatibility not mapped — bottle only
                        </span>
                    ) : (
                        <button
                            type="button"
                            onClick={onTogglePicker}
                            aria-expanded={pickerOpen}
                            className={cn(
                                "w-full text-left rounded-[3px] px-2.5 py-1.5 truncate transition-colors duration-200",
                                config?.component
                                    ? "bg-white border border-obsidian font-semibold text-obsidian"
                                    : config?.component === null
                                    ? "bg-white border border-champagne text-slate"
                                    : "border border-dashed border-muted-gold text-gold-dim font-semibold",
                            )}
                        >
                            {config?.component
                                ? shortName(config.component.itemName)
                                : config?.component === null
                                ? "Bottle Only — no component"
                                : "+ Choose Component"}
                        </button>
                    )}
                    {pickerOpen && (
                        <Picker
                            row={row}
                            onPick={(c) => { onChange({ component: c }); onTogglePicker(); }}
                            onClose={onTogglePicker}
                        />
                    )}
                </div>

                <Stepper value={qty} onChange={(q) => onChange({ qty: q })} />

                <button
                    type="button"
                    disabled={!decided}
                    onClick={() => onChange({})}
                    className={cn(
                        "rounded-[3px] px-3 py-1.5 text-spec font-semibold transition-colors duration-200",
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

/* ----------------------------------------------------------------- picker */

function Picker({ row, onPick, onClose }: {
    row: MatrixRow;
    onPick: (c: Component | null) => void;
    onClose: () => void;
}) {
    // only types that actually have a compatible variant
    const types = Object.entries(row.components).filter(([, xs]) => xs.length > 0);
    const total = types.reduce((n, [, xs]) => n + xs.length, 0);
    const [type, setType] = useState<string | null>(types[0]?.[0] ?? null);
    const items = type ? row.components[type] ?? [] : [];

    return (
        <div
            role="listbox"
            aria-label="Compatible components"
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
            className="absolute z-30 left-0 top-[calc(100%+6px)] w-[300px] bg-white
                       border border-champagne rounded-[3px] shadow-[0_18px_44px_rgba(29,29,31,.16)]"
        >
            <div className="px-3 py-2 border-b border-champagne/60 flex items-baseline gap-2">
                <span className="text-caption font-semibold text-obsidian">Compatible components</span>
                <span className="text-2xs text-ash ml-auto tabular-nums">
                    {row.neckThreadSize ?? "—"} · resolved
                </span>
            </div>

            {total === 0 ? (
                <p className="px-3 py-4 text-caption text-slate">
                    No compatible components.
                </p>
            ) : (
                <>
                    <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-champagne/60">
                        {types.map(([t, xs]) => (
                            <button key={t} type="button" onClick={() => setType(t)}
                                className={cn(
                                    "rounded-[3px] px-2 py-1 text-2xs font-semibold transition-colors duration-200",
                                    t === type
                                        ? "bg-obsidian text-white"
                                        : "border border-champagne text-slate hover:border-muted-gold",
                                )}>
                                {t} · {xs.length}
                            </button>
                        ))}
                    </div>
                    <ul className="max-h-[220px] overflow-auto">
                        {items.map((c) => {
                            const out = (c.stockStatus ?? "").toLowerCase().includes("out");
                            return (
                                <li key={c.graceSku}>
                                    <button type="button" disabled={out} onClick={() => onPick(c)}
                                        className={cn(
                                            "w-full text-left px-3 py-2 text-caption transition-colors duration-200",
                                            out ? "opacity-50 cursor-not-allowed"
                                                : "hover:bg-warm-white",
                                        )}>
                                        <span className="block text-obsidian">
                                            {shortName(c.itemName)}
                                        </span>
                                        <span className="block text-2xs text-ash">
                                            {c.graceSku}
                                            {out && " · Currently unavailable"}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}

            {/* Explicit, never implied — an unset field cannot be ordered. */}
            <button type="button" onClick={() => onPick(null)}
                className="w-full text-left px-3 py-2 border-t border-champagne/60
                           text-caption font-semibold text-slate hover:bg-warm-white
                           transition-colors duration-200">
                Bottle Only — no component
            </button>
        </div>
    );
}

/* ---------------------------------------------------------------- pieces */

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <div className="inline-flex items-center border border-champagne rounded-[3px] overflow-hidden">
            <button type="button" aria-label="Decrease"
                onClick={() => onChange(Math.max(1, value - 1))}
                className="px-2 py-1.5 text-slate hover:bg-warm-white transition-colors duration-200">
                <Minus size={11} />
            </button>
            <span className="px-2 text-spec font-semibold tabular-nums text-obsidian">{value}</span>
            <button type="button" aria-label="Increase"
                onClick={() => onChange(value + 1)}
                className="px-2 py-1.5 text-slate hover:bg-warm-white transition-colors duration-200">
                <Plus size={11} />
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

/** The row's photograph. A buying grid is scanned by eye before it is read,
 *  so the image well is reserved even when a product has no photo yet —
 *  otherwise rows jump horizontally as images load or fail. */
function BottleThumb({ row }: { row: MatrixRow }) {
    const [broken, setBroken] = useState(false);
    const src = row.imageUrl && !broken ? row.imageUrl : null;
    return (
        <span className="shrink-0 grid place-items-center w-11 h-14 rounded-[2px]
                         bg-product-well overflow-hidden">
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" loading="lazy" onError={() => setBroken(true)}
                     className="w-full h-full object-contain mix-blend-multiply" />
            ) : (
                <span className="text-2xs text-ash">—</span>
            )}
        </span>
    );
}

/** The catalog's itemName is a marketing paragraph ("Cylinder shaped, matte
 *  aluminum 250 ml bottle with black sprayer. For use with cologne...").
 *  A picker row needs a NAME, so take the first clause and let the SKU carry
 *  the precision underneath it. */
function shortName(itemName: string) {
    const first = itemName.split(/[.·—]|\bFor use\b/i)[0].trim();
    return first.length > 46 ? `${first.slice(0, 45).trimEnd()}…` : first || itemName;
}

function key(r: MatrixRow) {
    return r.graceSku ?? r.websiteSku ?? r.itemName ?? Math.random().toString();
}
