"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CatalogLineItem } from "@/lib/products/catalog-line-items";
import { STOCK_STATUSES, validateGroupPatch, validateProductPatch, type PriceRung } from "../../../convex/staffProductEditRules";
import { loadGroupForEditAction, retryPricePushAction, revertChangeAction, saveGroupAction, saveProductAction } from "@/app/team/products/actions";

type View = NonNullable<Extract<Awaited<ReturnType<typeof loadGroupForEditAction>>, { ok: true }>["view"]>;
type Variant = View["variants"][number];
type HistoryEntry = View["history"][number];
type Notice = { kind: "ok" | "warn" | "error"; text: string } | null;

const money = (value: number | null) => typeof value === "number" ? value.toLocaleString("en-US", { style: "currency", currency: "USD" }) : "—";
const cell = "px-3 py-2.5 align-middle text-[13px]";
const head = "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate";
const input = "w-full border border-champagne bg-white px-2.5 py-2 text-[13px] text-obsidian outline-none focus:border-obsidian";
const label = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate";

const FIELD_NAMES: Record<string, string> = { itemName: "Item name", itemDescription: "Item description", stockStatus: "Stock status", caseQuantity: "Case quantity",
    priceTiers: "Price ladder", displayName: "Display name", groupDescription: "Product description" };
function readable(field: string, json: string) {
    const value = JSON.parse(json);
    if (value === null || value === "") return "—";
    if (field === "priceTiers") return (value as PriceRung[]).map(r => `${r.minQty}+ ${money(r.unitPrice)}`).join(" · ");
    return String(value).length > 90 ? `${String(value).slice(0, 90)}…` : String(value);
}

function Thumb({ item }: { item: CatalogLineItem }) {
    const [broken, setBroken] = useState(false);
    return (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden border border-champagne/70 bg-linen">
            {/* eslint-disable-next-line @next/next/no-img-element -- hosts vary and a 44px tile gains nothing from /_next/image (see CatalogLineItems) */}
            {item.thumbnailUrl && !broken ? <img src={item.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-contain p-0.5" onError={() => setBroken(true)} /> : null}
        </span>
    );
}

/** One SKU: the fields staff may change, validated with the same rules the server applies. */
function VariantEditor({ variant, shopifyProductId, onSaved }: { variant: Variant; shopifyProductId: string | null; onSaved: (notice: Notice) => void }) {
    const [name, setName] = useState(variant.itemName);
    const [description, setDescription] = useState(variant.itemDescription ?? "");
    const [stock, setStock] = useState(variant.stockStatus ?? "");
    const [caseQty, setCaseQty] = useState(variant.caseQuantity == null ? "" : String(variant.caseQuantity));
    const [rungs, setRungs] = useState(variant.priceTiers.map(r => ({ minQty: String(r.minQty), unitPrice: String(r.unitPrice) })));
    const [error, setError] = useState<string | null>(null);
    const [pending, start] = useTransition();

    const parsedRungs: PriceRung[] = rungs.map(r => ({ minQty: Number(r.minQty), unitPrice: Number(r.unitPrice) }));
    const patch = {
        ...(name.trim() !== variant.itemName ? { itemName: name } : {}),
        ...((description.trim() || null) !== variant.itemDescription ? { itemDescription: description.trim() || null } : {}),
        ...(stock !== (variant.stockStatus ?? "") ? { stockStatus: stock } : {}),
        ...((caseQty.trim() === "" ? null : Number(caseQty)) !== variant.caseQuantity ? { caseQuantity: caseQty.trim() === "" ? null : Number(caseQty) } : {}),
        ...(JSON.stringify(parsedRungs) !== JSON.stringify(variant.priceTiers) ? { priceTiers: parsedRungs } : {}),
    };
    const dirty = Object.keys(patch).length > 0;

    function save() {
        const invalid = validateProductPatch(patch);
        if (invalid) { setError(invalid); return; }
        setError(null);
        const expect = { itemName: variant.itemName, itemDescription: variant.itemDescription, ...(variant.stockStatus ? { stockStatus: variant.stockStatus } : {}), caseQuantity: variant.caseQuantity, priceTiers: variant.priceTiers };
        start(async () => {
            const result = await saveProductAction({ productId: String(variant.id), shopifyProductId, expect, patch });
            if (!result.ok) {
                const conflict = "conflicts" in result && Array.isArray(result.conflicts) && result.conflicts.length > 0;
                setError(conflict ? `${result.error} Close and reopen this product to see the current value.` : result.error ?? "That didn't save.");
                return;
            }
            const push = "shopifyPush" in result ? result.shopifyPush : null;
            onSaved(push?.status === "failed" ? { kind: "warn", text: `${variant.websiteSku} saved on the website. Shopify was NOT updated: ${push.detail}` }
                : push?.status === "off" ? { kind: "warn", text: `${variant.websiteSku} saved on the website. Shopify price updates are switched off, so checkout still charges the old price.` }
                : { kind: "ok", text: `${variant.websiteSku} saved${push?.status === "ok" ? " — Shopify updated too" : ""}.` });
        });
    }

    return (
        <div className="border-t border-champagne/60 bg-white px-4 py-4" data-variant={variant.websiteSku}>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-[12.5px] text-obsidian">{variant.websiteSku}</span>
                <span className="text-[12px] text-slate">{[variant.applicator, variant.capColor].filter(Boolean).join(" · ")}</span>
                {variant.shopifySellable === false ? <span className="bg-linen px-2 py-0.5 text-[11px] text-slate">not sellable in Shopify</span> : null}
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <div className="space-y-3">
                    <div><label className={label}>Item name</label><textarea className={input} rows={2} value={name} onChange={e => setName(e.target.value)} /></div>
                    <div><label className={label}>Item description</label><textarea className={input} rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Shown on the product page" /></div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className={label}>Stock status</label>
                            <select className={input} value={stock} onChange={e => setStock(e.target.value)}>
                                {variant.stockStatus == null ? <option value="">— not set —</option> : null}
                                {[...new Set([...STOCK_STATUSES, ...(stock ? [stock] : [])])].map(s => <option key={s} value={s}>{s}</option>)}
                            </select></div>
                        <div><label className={label}>Case quantity</label><input className={input} inputMode="numeric" value={caseQty} onChange={e => setCaseQty(e.target.value)} /></div>
                    </div>
                </div>
                <div>
                    <span className={label}>Price ladder</span>
                    <div className="space-y-1.5">
                        {rungs.map((rung, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input aria-label={`Rung ${index + 1} quantity`} className={`${input} w-20 text-right tabular-nums`} inputMode="numeric" value={rung.minQty} disabled={index === 0}
                                    onChange={e => setRungs(rs => rs.map((r, i) => i === index ? { ...r, minQty: e.target.value } : r))} />
                                <span className="text-[12px] text-slate">or more, each</span>
                                <input aria-label={`Rung ${index + 1} price each`} className={`${input} w-28 text-right tabular-nums`} inputMode="decimal" value={rung.unitPrice}
                                    onChange={e => setRungs(rs => rs.map((r, i) => i === index ? { ...r, unitPrice: e.target.value } : r))} />
                                {index > 0 ? <button type="button" className="text-[12px] text-slate underline" onClick={() => setRungs(rs => rs.filter((_, i) => i !== index))}>remove</button> : null}
                            </div>
                        ))}
                    </div>
                    {rungs.length < 5 ? <button type="button" className="mt-2 text-[12px] font-semibold text-obsidian underline" onClick={() => setRungs(rs => [...rs, { minQty: "", unitPrice: "" }])}>Add a quantity break</button> : null}
                </div>
            </div>
            {error ? <p role="alert" className="mt-3 border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-800">{error}</p> : null}
            <div className="mt-3 flex items-center gap-3">
                <button type="button" disabled={!dirty || pending} onClick={save} className="bg-obsidian px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-bone disabled:opacity-40">{pending ? "Saving…" : "Save this SKU"}</button>
                {dirty ? <span className="text-[12px] text-slate">Changing: {Object.keys(patch).map(f => FIELD_NAMES[f]).join(", ")}</span> : null}
            </div>
        </div>
    );
}

function GroupEditor({ view, onSaved }: { view: View; onSaved: (notice: Notice) => void }) {
    const [displayName, setDisplayName] = useState(view.group.displayName);
    const [description, setDescription] = useState(view.group.groupDescription ?? "");
    const [error, setError] = useState<string | null>(null);
    const [pending, start] = useTransition();
    const patch = { ...(displayName.trim() !== view.group.displayName ? { displayName } : {}), ...((description.trim() || null) !== view.group.groupDescription ? { groupDescription: description.trim() || null } : {}) };
    const dirty = Object.keys(patch).length > 0;
    function save() {
        const invalid = validateGroupPatch(patch);
        if (invalid) { setError(invalid); return; }
        setError(null);
        start(async () => {
            const result = await saveGroupAction({ groupId: String(view.group.id), expect: { displayName: view.group.displayName, groupDescription: view.group.groupDescription }, patch });
            if (!result.ok) { setError(result.error); return; }
            onSaved({ kind: "ok", text: `${view.group.slug} saved.` });
        });
    }
    return (
        <div className="bg-linen/60 px-4 py-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
                <div><label className={label}>Display name</label><input className={input} value={displayName} onChange={e => setDisplayName(e.target.value)} /></div>
                <div><label className={label}>Product description (all SKUs)</label><textarea className={input} rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Shown on the product page" /></div>
            </div>
            {error ? <p role="alert" className="mt-3 border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-800">{error}</p> : null}
            <button type="button" disabled={!dirty || pending} onClick={save} className="mt-3 border border-obsidian px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-obsidian disabled:opacity-40">{pending ? "Saving…" : "Save product"}</button>
        </div>
    );
}

function History({ view, onChanged }: { view: View; onChanged: (notice: Notice) => void }) {
    const [pending, start] = useTransition();
    if (view.history.length === 0) return <p className="border-t border-champagne/60 bg-white px-4 py-3 text-[12.5px] text-slate">No edits recorded for this product yet.</p>;
    const variantOf = (entry: HistoryEntry) => view.variants.find(v => String(v.id) === entry.targetId) ?? null;
    return (
        <div className="border-t border-champagne/60 bg-white px-4 py-3">
            <p className={label}>History</p>
            <ul className="divide-y divide-champagne/50">
                {view.history.map(entry => (
                    <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-[12.5px]">
                        <span className="w-36 shrink-0 text-slate">{new Date(entry.at).toLocaleString()}</span>
                        <span className="font-mono text-[12px] text-obsidian">{entry.label}</span>
                        <span className="text-obsidian">{FIELD_NAMES[entry.field] ?? entry.field}: <span className="text-slate line-through">{readable(entry.field, entry.before)}</span> → {readable(entry.field, entry.after)}</span>
                        <span className="text-slate">{entry.actorEmail ?? "staff"}{entry.source === "team-hub-revert" ? " (revert)" : ""}</span>
                        {entry.shopifyPush ? <span className={entry.shopifyPush.status === "ok" ? "text-green-800" : "text-amber-800"}>Shopify {entry.shopifyPush.status === "ok" ? "updated" : entry.shopifyPush.status === "off" ? "not updated (switched off)" : `not updated: ${entry.shopifyPush.detail}`}</span> : null}
                        {entry.shopifyPush?.status === "failed" && variantOf(entry) ? (
                            <button type="button" disabled={pending} className="underline" onClick={() => start(async () => {
                                const v = variantOf(entry)!; const result = await retryPricePushAction({ changeId: String(entry.id), shopifyProductId: view.group.shopifyProductId, shopifyVariantId: v.shopifyVariantId, price: v.priceTiers[0]?.unitPrice ?? 0 });
                                onChanged(result.ok && result.push.status === "ok" ? { kind: "ok", text: "Shopify updated." } : { kind: "warn", text: `Shopify still not updated${result.ok ? `: ${result.push.detail}` : ""}` });
                            })}>Retry</button>) : null}
                        {entry.reverted ? <span className="text-slate">reverted</span> : (
                            <button type="button" disabled={pending} className="underline" onClick={() => start(async () => {
                                const result = await revertChangeAction({ changeId: String(entry.id), shopifyProductId: view.group.shopifyProductId });
                                onChanged(result.ok ? { kind: "ok", text: `${entry.label}: ${FIELD_NAMES[entry.field] ?? entry.field} put back.` } : { kind: "error", text: result.error });
                            })}>Revert</button>)}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function TeamProductSheet({ items, totalCount, search, pricePush, previewMode }: { items: CatalogLineItem[]; totalCount: number; search: string; pricePush: boolean; previewMode: boolean }) {
    const router = useRouter();
    const [query, setQuery] = useState(search);
    const [open, setOpen] = useState<string | null>(null);
    const [view, setView] = useState<View | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [notice, setNotice] = useState<Notice>(null);
    const [loading, start] = useTransition();

    function load(slug: string) {
        setLoadError(null);
        start(async () => {
            const result = await loadGroupForEditAction(slug);
            if (!result.ok) { setView(null); setLoadError(result.error); return; }
            if (!result.view) { setView(null); setLoadError("That product could not be found."); return; }
            setView(result.view);
        });
    }
    function toggle(slug: string) {
        if (open === slug) { setOpen(null); setView(null); return; }
        setOpen(slug); setView(null); load(slug);
    }
    const afterChange = (slug: string) => (next: Notice) => { setNotice(next); load(slug); router.refresh(); };

    return (
        <div>
            <form className="mb-4 flex gap-2" onSubmit={e => { e.preventDefault(); router.push(`/team/products?${new URLSearchParams({ ...(query.trim() ? { q: query.trim() } : {}), ...(previewMode ? { preview: "1" } : {}) })}`); }}>
                <input className={`${input} max-w-xl`} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, SKU, family, capacity…" aria-label="Search products" />
                <button className="bg-obsidian px-4 text-xs font-semibold uppercase tracking-[0.14em] text-bone">Search</button>
            </form>
            {!pricePush ? <p className="mb-3 border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">Shopify price updates are switched off. A price saved here changes the website; checkout keeps charging Shopify&rsquo;s price until they are switched on.</p> : null}
            {notice ? <p role="status" className={`mb-3 border px-3 py-2 text-[13px] ${notice.kind === "ok" ? "border-green-300 bg-green-50 text-green-900" : notice.kind === "warn" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-red-300 bg-red-50 text-red-800"}`}>{notice.text}</p> : null}
            <p className="mb-2 text-[12.5px] text-slate">{totalCount.toLocaleString()} product{totalCount === 1 ? "" : "s"}{items.length < totalCount ? ` · showing ${items.length}` : ""}</p>

            <div className="overflow-x-auto border border-champagne/70 bg-white">
                <table className="w-full min-w-[920px] border-collapse">
                    <thead><tr className="bg-linen">
                        <th className={head}>Product</th><th className={head}>SKU</th><th className={head}>Capacity</th><th className={head}>Colour</th><th className={head}>Neck</th>
                        <th className={`${head} text-right`}>From</th><th className={`${head} text-right`}>Edit</th>
                    </tr></thead>
                    <tbody>
                        {items.map(item => (
                            <Fragment key={item.groupId}>
                                <tr className="border-t border-champagne/60" data-row={item.slug}>
                                    <td className={cell}><span className="flex min-w-0 items-center gap-3"><Thumb item={item} /><span className="min-w-0">
                                        <span className="block max-w-[320px] truncate text-obsidian" title={item.displayName}>{item.displayName}</span>
                                        <span className="block text-[11.5px] text-slate">{[item.family, item.variantCount > 1 ? `${item.variantCount} variants` : null].filter(Boolean).join(" · ")}</span></span></span></td>
                                    <td className={`${cell} font-mono text-[12px] text-slate`}>{item.skuLabel}</td>
                                    <td className={`${cell} text-slate`}>{item.capacity ?? "—"}</td><td className={`${cell} text-slate`}>{item.color ?? "—"}</td><td className={`${cell} text-slate`}>{item.neckThreadSize ?? "—"}</td>
                                    <td className={`${cell} text-right tabular-nums text-obsidian`}>{money(item.priceFrom)}</td>
                                    <td className={`${cell} text-right`}><button type="button" aria-expanded={open === item.slug} onClick={() => toggle(item.slug)} className="border border-obsidian px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-obsidian hover:bg-obsidian hover:text-bone">{open === item.slug ? "Close" : "Edit"}</button></td>
                                </tr>
                                {open === item.slug ? (
                                    <tr><td colSpan={7} className="border-t border-champagne/60 bg-bone p-0">
                                        {loading && !view ? <p className="px-4 py-4 text-[13px] text-slate">Loading SKUs…</p> : null}
                                        {loadError ? <p role="alert" className="px-4 py-4 text-[13px] text-red-800">{loadError}</p> : null}
                                        {view && view.group.slug === item.slug ? (
                                            // keyed by the newest history entry, so a save or revert remounts the editors with fresh values
                                            <div key={`${view.history[0]?.id ?? "none"}`}>
                                                <GroupEditor view={view} onSaved={afterChange(item.slug)} />
                                                {view.variants.map(variant => <VariantEditor key={String(variant.id)} variant={variant} shopifyProductId={view.group.shopifyProductId} onSaved={afterChange(item.slug)} />)}
                                                <History view={view} onChanged={afterChange(item.slug)} />
                                            </div>) : null}
                                    </td></tr>) : null}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
            {items.length === 0 ? <p className="mt-4 text-[13px] text-slate">No products match that search.</p> : null}
        </div>
    );
}
