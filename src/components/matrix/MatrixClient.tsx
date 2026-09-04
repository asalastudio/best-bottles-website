"use client";

/**
 * Build a Bottle — Product Compatibility Matrix, with a family accordion, compact configurable rows, an anchored
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

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Minus, WarningCircle, Check, X } from "@/components/icons";
import { ClosureIcon, BottleOnlyIcon } from "./ClosureIcon";
import { useCart } from "@/components/CartProvider";
import { cn } from "@/lib/utils";
import { summarizeMatrixOrder, type MatrixCartLine } from "@/lib/matrix/cart";
import {
    activeMatrixFilters,
    createMatrixFamilyState,
    emptyMatrixFilters,
    matrixCapacityMatches,
    matrixSizeOptions,
    switchMatrixFamily,
} from "@/lib/matrix/filters";
import { matrixProductHref } from "@/lib/matrix/product-identity";
import {
    reconcileRetainedMatrixRows,
    retainMatrixConfiguration,
    retainedMatrixCartLines,
    type RetainedMatrixConfigurations,
} from "@/lib/matrix/order-state";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import { analytics } from "@/lib/analytics";

/* ------------------------------------------------------------------ types */

type Component = {
    graceSku: string;
    itemName: string;
    imageUrl: string | null;
    capColor: string | null;
    stockStatus: string | null;
    websiteSku?: string | null;
    shopifyVariantId?: string | null;
    shopifySellable?: boolean | null;
    productGroupSlug?: string | null;
    webPrice1pc?: number | null;
    webPrice10pc?: number | null;
    webPrice12pc?: number | null;
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
    shopifyVariantId?: string | null;
    shopifySellable?: boolean | null;
    productGroupSlug?: string | null;
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

type RetainedConfigurations = RetainedMatrixConfigurations<MatrixRow, Component>;

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
    const searchParams = useSearchParams();
    const { addItems } = useCart();
    const trackedMatrixOpen = useRef(false);
    const [matrixState, setMatrixState] = useState(() =>
        ({
            ...createMatrixFamilyState(openFamily, {} as Record<string, Config>),
            retainedConfigurations: {} as RetainedConfigurations,
        }));
    const [cartMessage, setCartMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        if (trackedMatrixOpen.current) return;
        trackedMatrixOpen.current = true;
        const routeSource = searchParams.get("from");
        const source = routeSource === "finder" || routeSource === "pdp" || routeSource === "grace"
            ? routeSource
            : "nav";
        analytics.matrixOpened({ source, ...(openFamily ? { family: openFamily } : {}) });
    }, [openFamily, searchParams]);

    const rows = useMemo(() => initialRows?.rows ?? [], [initialRows]);
    const configs = matrixState.configs;
    const filters = activeMatrixFilters(matrixState, openFamily);
    const retainedConfigurations = useMemo(() => reconcileRetainedMatrixRows(
        matrixState.retainedConfigurations,
        rows,
        key,
        resolveCurrentComponent,
    ), [matrixState.retainedConfigurations, rows]);
    const { search, size, finish, neck, closure } = filters;
    const updateFilters = (patch: Partial<typeof filters>) => {
        setMatrixState((state) => ({
            ...state,
            family: openFamily,
            filters: { ...activeMatrixFilters(state, openFamily), ...patch },
        }));
    };

    /* FILTERS ARE FAMILY-SCOPED, and their OPTIONS come from the loaded family
       rather than the whole catalog. Jordan: "We should filter only at the
       family level... when they filter, it'll be for the whole family." A
       global option list would offer sizes and necks this family does not
       sell, and every one of them would return nothing. */
    const options = useMemo(() => {
        const uniq = (xs: (string | null | undefined)[]) =>
            [...new Set(xs.map((x) => (x ?? "").trim()).filter(Boolean))].sort();
        return {
            sizes: matrixSizeOptions(rows),
            finishes: uniq(rows.map((r) => r.color)),
            necks: uniq(rows.map((r) => r.neckThreadSize)),
            closures: uniq(rows.flatMap((r) => Object.keys(r.components))),
        };
    }, [rows]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (size && !matrixCapacityMatches(r, size)) return false;
            if (finish && (r.color ?? "") !== finish) return false;
            if (neck && (r.neckThreadSize ?? "") !== neck) return false;
            if (closure && !(r.components[closure]?.length)) return false;
            if (!q) return true;
            return `${r.itemName ?? ""} ${r.graceSku ?? ""} ${r.capacity ?? ""} ${r.color ?? ""}`
                .toLowerCase().includes(q);
        });
    }, [rows, search, size, finish, neck, closure]);

    const filtered = Boolean(size || finish || neck || closure || search.trim());
    const clearAll = () => setMatrixState((state) => ({
        ...state,
        family: openFamily,
        filters: emptyMatrixFilters(),
    }));
    const selectFamily = (family: string) => {
        // Clear all family-scoped values in one state update before routing so
        // no stale selection can apply while new server rows arrive, while
        // preserving configured rows and cart/minimum-order state.
        setMatrixState((state) => switchMatrixFamily(state, family));
        router.replace(`/matrix?family=${encodeURIComponent(family)}`);
    };

    /** Only rows with an EXPLICIT component decision count as configured. */
    const order = useMemo(() => {
        const cartLines = retainedMatrixCartLines(retainedConfigurations) as MatrixCartLine[];
        const configurations = cartLines;
        try {
            return {
                configurations,
                ...summarizeMatrixOrder(cartLines, MIN_ORDER),
                error: null as string | null,
            };
        } catch (error) {
            return {
                configurations,
                items: [],
                subtotal: 0,
                priced: false,
                units: 0,
                meetsMinimum: false,
                error: error instanceof Error ? error.message : "Unable to price this configuration.",
            };
        }
    }, [retainedConfigurations]);

    const setConfig = (r: MatrixRow, patch: Partial<Config>) =>
        setMatrixState((state) => {
            // 12 is the starting quantity for a row nobody has touched; once a
            // row HAS a quantity it must survive a component change
            const prev = state.configs[key(r)] ?? { qty: 12 };
            const configuration = { ...prev, ...patch };
            return {
                ...state,
                configs: { ...state.configs, [key(r)]: configuration },
                retainedConfigurations: retainMatrixConfiguration(
                    state.retainedConfigurations,
                    key(r),
                    r,
                    configuration,
                ),
            };
        });

    const addOrderToCart = () => {
        if (order.error) {
            setCartMessage({
                kind: "error",
                text: order.error,
            });
            return;
        }
        if (order.items.length === 0) {
            setCartMessage({ kind: "error", text: "Choose a bottle configuration before adding it to the cart." });
            return;
        }
        addItems(order.items);
        setCartMessage({
            kind: "success",
            text: `${order.items.length} item${order.items.length === 1 ? "" : "s"} added to your cart.`,
        });
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("open-cart-drawer"));
        }
    };

    return (
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pb-40">
            {/* header */}
            <div className="flex items-end gap-4 pt-2 pb-4">
                <div>
                    <h1 className="font-serif font-medium text-[32px] leading-[1.12] tracking-[-0.02em] text-obsidian">
                        Build a Bottle
                    </h1>
                    <p className="text-spec text-slate mt-1">
                        Product Compatibility Matrix. Compare bottles and compatible components.
                        {" "}Everyone pays the same price.
                    </p>
                </div>
                <div className="flex-1" />
                <Link href="/catalog"
                      className="text-spec font-semibold text-slate border border-champagne rounded-[3px]
                                 px-3 py-1.5 transition-colors duration-200 hover:border-muted-gold">
                    Visual Catalog
                </Link>
            </div>

            {/* toolbar — every filter is scoped to the open family */}
            <div className="bg-white border border-champagne/60 rounded-[3px] p-2.5
                            flex flex-wrap items-center gap-2 mb-3.5">
                <select
                    value={openFamily ?? ""}
                    onChange={(e) => selectFamily(e.target.value)}
                    className="bg-white border border-obsidian rounded-[3px] px-2.5 py-1.5
                               text-spec font-semibold text-obsidian"
                >
                    {families.map((f) => (
                        <option key={f.family} value={f.family}>{f.family}</option>
                    ))}
                </select>

                <Filter label="All sizes" value={size} onChange={(value) => updateFilters({ size: value })} options={options.sizes} />
                <Filter label="All finishes" value={finish} onChange={(value) => updateFilters({ finish: value })} options={options.finishes} />
                <Filter label="All necks" value={neck} onChange={(value) => updateFilters({ neck: value })} options={options.necks} />
                <Filter label="All closures" value={closure} onChange={(value) => updateFilters({ closure: value })} options={options.closures} />

                <input
                    value={search}
                    onChange={(e) => updateFilters({ search: e.target.value })}
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
                            canAddOrder={order.meetsMinimum && order.configurations.length > 0 && !order.error}
                            onAddOrder={addOrderToCart}
                        />
                    ))}
                </section>
            ) : (
                <p className="text-spec text-slate">No families available.</p>
            )}

            <OrderBar order={order} onAddToCart={addOrderToCart} cartMessage={cartMessage} />
        </div>
    );
}

/* -------------------------------------------------------------------- row */

function Row({ row, config, onChange, canAddOrder, onAddOrder }: {
    row: MatrixRow;
    config?: Config;
    onChange: (patch: Partial<Config>) => void;
    canAddOrder: boolean;
    onAddOrder: () => void;
}) {
    const qty = config?.qty ?? 12;
    // undefined = undecided; null = Bottle Only, chosen on purpose
    const decided = config?.component !== undefined;
    const unknown = row.resolution === "unknown";
    const productHref = matrixProductHref(row);

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
                        {productHref ? (
                            <Link href={productHref} className="text-sm font-semibold leading-snug text-obsidian hover:text-muted-gold">
                                {getCustomerFacingProductName({ variant: row }).displayName}
                            </Link>
                        ) : (
                            <p className="text-sm font-semibold leading-snug text-obsidian">
                                {getCustomerFacingProductName({ variant: row }).displayName}
                            </p>
                        )}
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
                    disabled={!decided || !canAddOrder}
                    onClick={onAddOrder}
                    className={cn(
                        "rounded-[3px] px-4 py-2 text-ui font-semibold transition-colors duration-200",
                        decided && canAddOrder
                            ? "bg-obsidian text-white hover:bg-muted-gold hover:text-obsidian"
                            : decided
                                ? "bg-[#5B7B5D] text-white disabled:opacity-100"
                                : "border border-obsidian text-obsidian hover:bg-obsidian hover:text-white disabled:opacity-40",
                    )}
                >
                    {decided ? (canAddOrder ? "Add to cart" : "In order") : "Choose a closure"}
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
 * Only. Choosing a type with a single variant selects it immediately; a type
 * with several opens a focused modal so the row stays readable.
 */
function ComponentChips({ row, config, onChange }: {
    row: MatrixRow;
    config?: Config;
    onChange: (patch: Partial<Config>) => void;
}) {
    const [modalType, setModalType] = useState<string | null>(null);
    const types = Object.entries(row.components).filter(([, xs]) => xs.length > 0);

    const closeModal = useCallback(() => setModalType(null), []);
    const pickComponent = useCallback((c: Component, groupKey: string) => {
        onChange({ component: { ...c, groupKey } });
        setModalType(null);
    }, [onChange]);

    // ── Chosen state ────────────────────────────────────────────────────────
    if (config?.component) {
        const componentHref = matrixProductHref(config.component);
        return (
            <div className="inline-flex items-center gap-2 max-w-full rounded-[3px]
                           bg-white border border-obsidian px-2.5 py-1.5 text-caption
                           font-semibold text-obsidian">
                <button
                    type="button"
                    aria-label={`Change component — currently ${shortName(config.component.itemName)}`}
                    title="Click to change component"
                    onClick={() => {
                        // Re-open to the same type so the customer swaps finish, not type
                        setModalType(config.component!.groupKey ?? null);
                    }}
                    className="shrink-0 hover:opacity-70 transition-opacity"
                >
                    <ClosureIcon type={config.component.groupKey ?? ""} size={20} />
                </button>
                {componentHref ? (
                    <Link href={componentHref} className="truncate hover:text-muted-gold">
                        {shortName(config.component.itemName)}
                    </Link>
                ) : (
                    <span className="truncate">{shortName(config.component.itemName)}</span>
                )}
                <Check size={12} weight="bold" className="shrink-0 text-[#5B7B5D]" />
                {/* modal re-opens to the selected type for a finish swap */}
                {modalType && (
                    <ComponentPickerModal
                        row={row}
                        initialType={modalType}
                        currentComponent={config.component}
                        onSelect={pickComponent}
                        onClose={closeModal}
                        onBottleOnly={() => { onChange({ component: null }); closeModal(); }}
                        onClear={() => { onChange({ component: undefined }); closeModal(); }}
                    />
                )}
            </div>
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
        <>
            <div className="flex flex-wrap items-center gap-1">
                {types.map(([t, xs]) => (
                    <button key={t} type="button"
                        title={`${t} · ${xs.length} compatible`}
                        onClick={() => {
                            // single variant: select immediately, no modal needed
                            if (xs.length === 1) onChange({ component: { ...xs[0], groupKey: t } });
                            else setModalType(t);
                        }}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-[3px] px-2 py-1.5",
                            "text-caption font-semibold transition-colors duration-200",
                            "border border-champagne text-slate hover:border-obsidian hover:text-obsidian",
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

            {modalType && (
                <ComponentPickerModal
                    row={row}
                    initialType={modalType}
                    currentComponent={config?.component}
                    onSelect={pickComponent}
                    onClose={closeModal}
                    onBottleOnly={() => { onChange({ component: null }); closeModal(); }}
                    onClear={() => { onChange({ component: undefined }); closeModal(); }}
                />
            )}
        </>
    );
}

/* ------------------------------------------------- component picker modal */

/**
 * Full-screen modal for picking a component.
 *
 * Layout:
 *   Header  — bottle identity (name, SKU, neck size)
 *   Type tabs — one per closure group (Cap, Sprayer, Lotion Pump, …) + Bottle Only
 *   Grid — one card per variant in the active tab, showing thumbnail,
 *           finish name, SKU, price, stock badge
 *   Footer — selected preview + Confirm / Cancel
 *
 * The modal never shows ALL variants at once; it is always scoped to one
 * type tab. Types with 1 variant skip the modal entirely (chips select them).
 */
function ComponentPickerModal({
    row,
    initialType,
    currentComponent,
    onSelect,
    onClose,
    onBottleOnly,
    onClear,
}: {
    row: MatrixRow;
    initialType: string;
    currentComponent?: Component | null;
    onSelect: (c: Component, groupKey: string) => void;
    onClose: () => void;
    onBottleOnly: () => void;
    onClear: () => void;
}) {
    const [activeType, setActiveType] = useState(initialType);
    const [pending, setPending] = useState<Component | null>(
        // pre-select current if it belongs to this type
        currentComponent?.groupKey === initialType ? currentComponent : null,
    );

    const types = Object.entries(row.components).filter(([, xs]) => xs.length > 0);
    const variants = row.components[activeType] ?? [];
    const bottleName = row.itemName ?? row.graceSku ?? "This bottle";

    // Trap focus + Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [onClose]);

    const confirm = () => {
        if (pending) onSelect(pending, activeType);
    };

    const inStock = (c: Component) => !(c.stockStatus ?? "").toLowerCase().includes("out");

    return (
        // Backdrop
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                       bg-obsidian/40 backdrop-blur-[2px]"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            role="dialog"
            aria-modal="true"
            aria-label={`Choose component for ${bottleName}`}
        >
            {/* Panel */}
            <div className="relative w-full sm:w-[640px] max-h-[90dvh] flex flex-col
                            bg-warm-white rounded-t-[8px] sm:rounded-[8px]
                            shadow-[0_8px_48px_rgba(0,0,0,0.18)]
                            overflow-hidden">

                {/* ── Header ── */}
                <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-champagne/60">
                    <div className="flex-1 min-w-0">
                        <p className="text-caption text-ash uppercase tracking-label font-bold mb-0.5">
                            Choose component
                        </p>
                        <p className="text-sm font-semibold text-obsidian leading-snug truncate">
                            {shortName(bottleName, 60)}
                        </p>
                        <p className="text-caption text-ash mt-0.5 tabular-nums">
                            {row.capacity && <span>{row.capacity} · </span>}
                            {row.color && <span>{row.color} · </span>}
                            {row.neckThreadSize && <span>{row.neckThreadSize} neck</span>}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close component picker"
                        className="shrink-0 p-1.5 rounded-[3px] text-ash
                                   hover:bg-champagne/40 transition-colors duration-150"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* ── Type tabs ── */}
                <div className="flex items-center gap-1.5 px-5 pt-3 pb-0 flex-wrap">
                    {types.map(([t, xs]) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => {
                                setActiveType(t);
                                // keep pending if it belongs to the new tab, else clear
                                setPending((prev) => prev?.groupKey === t ? prev : null);
                            }}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-[3px] px-3 py-1.5",
                                "text-caption font-semibold transition-colors duration-150",
                                activeType === t
                                    ? "bg-obsidian text-white"
                                    : "border border-champagne text-slate hover:border-obsidian hover:text-obsidian",
                            )}
                        >
                            <ClosureIcon type={t} size={16} />
                            {t}
                            <span className="opacity-50 tabular-nums">{xs.length}</span>
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={onBottleOnly}
                        className="inline-flex items-center gap-1.5 rounded-[3px] px-3 py-1.5
                                   text-caption font-semibold border border-dashed border-champagne
                                   text-ash hover:border-muted-gold hover:text-gold-dim
                                   transition-colors duration-150"
                    >
                        <BottleOnlyIcon size={16} />
                        Bottle only
                    </button>
                </div>

                {/* ── Variant grid ── */}
                <div className="flex-1 overflow-y-auto px-5 py-3">
                    {variants.length === 0 ? (
                        <p className="text-caption text-ash py-6 text-center">
                            No compatible {activeType.toLowerCase()} options for this bottle.
                        </p>
                    ) : (
                        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {variants.map((c) => {
                                const available = inStock(c);
                                const chosen = pending?.graceSku === c.graceSku;
                                const href = matrixProductHref(c);
                                return (
                                    <li key={c.graceSku}>
                                        <button
                                            type="button"
                                            disabled={!available}
                                            onClick={() => setPending({ ...c, groupKey: activeType })}
                                            className={cn(
                                                "w-full text-left rounded-[4px] border p-2.5",
                                                "transition-colors duration-150 group",
                                                chosen
                                                    ? "border-obsidian bg-white ring-1 ring-obsidian"
                                                    : available
                                                    ? "border-champagne bg-white hover:border-obsidian"
                                                    : "border-champagne/40 bg-warm-white cursor-not-allowed opacity-50",
                                            )}
                                        >
                                            {/* thumbnail */}
                                            <div className="w-full aspect-square rounded-[3px] bg-product-well
                                                            overflow-hidden mb-2 flex items-center justify-center">
                                                {c.imageUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={c.imageUrl}
                                                        alt=""
                                                        className="w-full h-full object-contain mix-blend-multiply"
                                                    />
                                                ) : (
                                                    <ClosureIcon type={activeType} size={32}
                                                        className="text-ash/40" />
                                                )}
                                            </div>
                                            {/* name */}
                                            <p className="text-caption font-semibold text-obsidian
                                                          leading-snug line-clamp-2 mb-0.5">
                                                {finishLabel(c)}
                                            </p>
                                            {/* SKU */}
                                            <p className="text-[10px] text-ash tabular-nums truncate">
                                                {c.graceSku ?? c.websiteSku}
                                            </p>
                                            {/* price */}
                                            {c.webPrice1pc != null && (
                                                <p className="text-[10px] text-slate tabular-nums mt-0.5">
                                                    {c.webPrice1pc.toLocaleString("en-US", {
                                                        style: "currency", currency: "USD",
                                                    })} / pc
                                                </p>
                                            )}
                                            {/* stock */}
                                            {!available && (
                                                <span className="inline-block mt-1 text-[10px] font-semibold
                                                                 text-gold-dim bg-gold-dim/10 rounded px-1 py-0.5">
                                                    Out of stock
                                                </span>
                                            )}
                                            {/* PDP link */}
                                            {href && (
                                                <a
                                                    href={href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="hidden group-hover:block mt-1
                                                               text-[10px] text-muted-gold underline"
                                                >
                                                    View product ↗
                                                </a>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="flex items-center gap-3 px-5 py-4 border-t border-champagne/60 bg-white">
                    {pending ? (
                        <div className="flex-1 min-w-0">
                            <p className="text-caption text-ash">Selected</p>
                            <p className="text-sm font-semibold text-obsidian truncate">
                                {finishLabel(pending)}
                            </p>
                        </div>
                    ) : (
                        <p className="flex-1 text-caption text-ash">
                            Select a {activeType.toLowerCase()} above
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={onClear}
                        className="text-caption text-slate underline hover:text-obsidian
                                   transition-colors duration-150"
                    >
                        Clear
                    </button>
                    <button
                        type="button"
                        disabled={!pending}
                        onClick={confirm}
                        className={cn(
                            "rounded-[3px] px-5 py-2 text-spec font-semibold",
                            "transition-colors duration-150",
                            pending
                                ? "bg-obsidian text-white hover:bg-muted-gold hover:text-obsidian"
                                : "bg-champagne/40 text-ash cursor-not-allowed",
                        )}
                    >
                        Confirm
                    </button>
                </div>
            </div>
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

function OrderBar({ order, onAddToCart, cartMessage }: {
    order: {
        configurations: unknown[];
        items: unknown[];
        subtotal: number;
        units: number;
        priced: boolean;
        meetsMinimum: boolean;
        error: string | null;
    };
    onAddToCart: () => void;
    cartMessage: { kind: "success" | "error"; text: string } | null;
}) {
    const met = order.meetsMinimum;
    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-warm-white border-t border-champagne">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
                <div>
                    <p className="font-serif text-[15px] font-semibold text-obsidian">Your order</p>
                    <p className="text-caption text-slate tabular-nums">
                        {order.configurations.length} configuration{order.configurations.length === 1 ? "" : "s"}
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
                        {!order.priced
                            ? "Price unavailable — check item details"
                            : met
                            ? "$50 order minimum met"
                            : `$${(MIN_ORDER - order.subtotal).toFixed(2)} to reach the $50 minimum`}
                    </p>
                </div>
                {cartMessage && (
                    <p role="status" aria-live="polite" className={cn(
                        "text-caption max-w-[220px]",
                        cartMessage.kind === "success" ? "text-[#5B7B5D]" : "text-gold-dim",
                    )}>
                        {cartMessage.text}
                    </p>
                )}
                <button type="button" disabled={!met || order.configurations.length === 0} onClick={onAddToCart}
                    className="rounded-[3px] bg-obsidian text-white px-5 py-2.5 text-spec font-semibold
                               transition-colors duration-200 hover:bg-muted-gold hover:text-obsidian
                               disabled:opacity-40 disabled:hover:bg-obsidian disabled:hover:text-white">
                    Add to cart
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

function resolveCurrentComponent(row: MatrixRow, selected: Component): Component | undefined {
    for (const [groupKey, components] of Object.entries(row.components)) {
        const current = components.find((component) => (
            (Boolean(selected.graceSku) && component.graceSku === selected.graceSku)
            || (Boolean(selected.websiteSku) && component.websiteSku === selected.websiteSku)
        ));
        if (current) return { ...current, groupKey };
    }
    return undefined;
}
