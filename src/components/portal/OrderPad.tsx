"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { PortalButton } from "@/components/portal/ui";

export type PadSearchHit = {
    sku: string;
    itemName: string;
    capacity: string | null;
    imageUrl: string | null;
    startingPrice: number | null;
    orderable: boolean;
};

export type PadLine = {
    sku: string;
    description: string;
    quantity: number;
    unitPrice?: number;
    shopifyVariantId?: string;
};

type SaveResult = {
    rejected: Array<{ sku: string; reason: string }>;
    lineCount: number;
    totalAmount: number;
};

function money(value: number | undefined) {
    if (typeof value !== "number") return "—";
    return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

/**
 * The order pad.
 *
 * Deliberately a SKU-and-quantity grid rather than a catalogue browser: a
 * wholesale buyer reordering knows their SKUs, and the fastest path for them
 * is typing or pasting rather than clicking through families. Browsing lives
 * in the catalogue, one link away.
 *
 * Prices are never computed here. The client sends SKUs and quantities; the
 * server resolves the ladder from Convex and sends back what will actually be
 * charged, so what the pad shows and what Shopify bills are the same number.
 */
export default function OrderPad({
    draftId,
    initialLines,
    readOnly,
    saveLines,
    searchProducts,
}: {
    draftId: string;
    initialLines: PadLine[];
    readOnly: boolean;
    saveLines: (draftId: string, lines: Array<{ sku: string; quantity: number }>) => Promise<SaveResult>;
    searchProducts: (term: string) => Promise<PadSearchHit[]>;
}) {
    const [lines, setLines] = useState<PadLine[]>(initialLines);
    const [sku, setSku] = useState("");
    const [qty, setQty] = useState("1");
    const [bulk, setBulk] = useState("");
    const [showBulk, setShowBulk] = useState(false);
    const [problems, setProblems] = useState<string[]>([]);
    const [pending, startTransition] = useTransition();
    const [hits, setHits] = useState<PadSearchHit[]>([]);
    // Many product rows still carry Shopify URLs for files that have since been
    // deleted, so a thumbnail 404 is normal rather than exceptional. A row of
    // broken-image glyphs reads as a broken page; a plain tile does not.
    const [brokenThumbs, setBrokenThumbs] = useState<Set<string>>(new Set());
    const [searching, setSearching] = useState(false);
    // Every keystroke fires a request otherwise, and a stale slow response can
    // land after a newer fast one and overwrite it.
    const searchSeq = useRef(0);

    useEffect(() => {
        const term = sku.trim();
        if (readOnly || term.length < 2) { setHits([]); setSearching(false); return; }

        const seq = ++searchSeq.current;
        setSearching(true);
        const timer = setTimeout(async () => {
            try {
                const found = await searchProducts(term);
                if (seq === searchSeq.current) setHits(found);
            } catch {
                if (seq === searchSeq.current) setHits([]);
            } finally {
                if (seq === searchSeq.current) setSearching(false);
            }
        }, 220);
        return () => clearTimeout(timer);
    }, [sku, readOnly, searchProducts]);

    const total = lines.reduce((sum, l) => sum + (l.unitPrice ?? 0) * l.quantity, 0);

    const commit = (next: Array<{ sku: string; quantity: number }>) => {
        setProblems([]);
        startTransition(async () => {
            const result = await saveLines(draftId, next);
            if (result.rejected.length > 0) {
                setProblems(result.rejected.map((r) =>
                    r.reason === "unknown_sku"
                        ? `${r.sku} — we don't recognise that SKU`
                        : `${r.sku} — no published price, ask your account manager`,
                ));
            }
            // The server is the authority on what a line costs, so re-read from
            // its answer rather than trusting the optimistic local copy.
            const accepted = next.filter((n) =>
                !result.rejected.some((r) => r.sku.toLowerCase() === n.sku.toLowerCase()));
            setLines((prev) => {
                const bySku = new Map(prev.map((l) => [l.sku.toLowerCase(), l]));
                return accepted.map((a) => {
                    const existing = bySku.get(a.sku.toLowerCase());
                    return existing
                        ? { ...existing, quantity: a.quantity }
                        : { sku: a.sku, description: "Resolving…", quantity: a.quantity };
                });
            });
            // Pull the authoritative descriptions and prices back.
            if (accepted.length > 0) window.location.reload();
        });
    };

    const currentAsInput = () => lines.map((l) => ({ sku: l.sku, quantity: l.quantity }));

    const addOne = () => {
        const trimmed = sku.trim();
        const quantity = Math.max(1, Math.floor(Number(qty) || 1));
        if (!trimmed) return;
        const existing = currentAsInput();
        const match = existing.find((l) => l.sku.toLowerCase() === trimmed.toLowerCase());
        const next = match
            ? existing.map((l) => (l === match ? { ...l, quantity: l.quantity + quantity } : l))
            : [...existing, { sku: trimmed, quantity }];
        setSku("");
        setQty("1");
        setHits([]);
        commit(next);
    };

    const addHit = (hit: PadSearchHit) => {
        const quantity = Math.max(1, Math.floor(Number(qty) || 1));
        const existing = currentAsInput();
        const match = existing.find((l) => l.sku.toLowerCase() === hit.sku.toLowerCase());
        const next = match
            ? existing.map((l) => (l === match ? { ...l, quantity: l.quantity + quantity } : l))
            : [...existing, { sku: hit.sku, quantity }];
        setSku("");
        setQty("1");
        setHits([]);
        commit(next);
    };

    const addBulk = () => {
        // "SKU, qty" per line — the shape people already keep in a spreadsheet.
        const parsed = bulk.split("\n").map((row) => {
            const [rawSku, rawQty] = row.split(/[,\t]/);
            const s = (rawSku ?? "").trim();
            const q = Math.max(1, Math.floor(Number((rawQty ?? "1").trim()) || 1));
            return s ? { sku: s, quantity: q } : null;
        }).filter((row): row is { sku: string; quantity: number } => row !== null);
        if (parsed.length === 0) return;

        const merged = [...currentAsInput()];
        for (const row of parsed) {
            const match = merged.find((l) => l.sku.toLowerCase() === row.sku.toLowerCase());
            if (match) match.quantity += row.quantity;
            else merged.push(row);
        }
        setBulk("");
        setShowBulk(false);
        commit(merged);
    };

    const setQuantity = (target: PadLine, quantity: number) => {
        if (quantity < 1) return;
        commit(currentAsInput().map((l) =>
            l.sku.toLowerCase() === target.sku.toLowerCase() ? { ...l, quantity } : l));
    };

    const remove = (target: PadLine) => {
        commit(currentAsInput().filter((l) => l.sku.toLowerCase() !== target.sku.toLowerCase()));
    };

    return (
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
            {!readOnly && (
                <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50">
                    <div className="flex items-end gap-2">
                        <div className="flex-1 min-w-0">
                            <label htmlFor="pad-sku" className="block font-sans text-[12px] text-neutral-500 mb-1.5">
                                Add by SKU or product name
                            </label>
                            <input
                                id="pad-sku"
                                value={sku}
                                onChange={(e) => setSku(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOne(); } }}
                                placeholder="GBCyl9SpryGl, or &ldquo;9ml cylinder sprayer&rdquo;"
                                autoComplete="off"
                                className="w-full h-9 px-3 font-sans text-[13px] rounded-md border border-neutral-300 bg-white text-neutral-900 outline-none focus:border-neutral-500"
                            />
                        </div>
                        <div className="w-24">
                            <label htmlFor="pad-qty" className="block font-sans text-[12px] text-neutral-500 mb-1.5">
                                Qty
                            </label>
                            <input
                                id="pad-qty"
                                value={qty}
                                inputMode="numeric"
                                onChange={(e) => setQty(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOne(); } }}
                                className="w-full h-9 px-3 font-sans text-[13px] tabular-nums rounded-md border border-neutral-300 bg-white text-neutral-900 outline-none focus:border-neutral-500"
                            />
                        </div>
                        <PortalButton size="sm" type="button" onClick={addOne} disabled={pending || !sku.trim()}>
                            Add
                        </PortalButton>
                    </div>

                    {(searching || hits.length > 0) && (
                        <div className="mt-2 rounded-md border border-neutral-200 bg-white overflow-hidden">
                            {searching && hits.length === 0 && (
                                <p className="px-3 py-2.5 font-sans text-[12.5px] text-neutral-400">Searching…</p>
                            )}
                            {hits.map((hit) => (
                                <div
                                    key={hit.sku}
                                    className="flex items-center gap-3 px-3 py-2 border-b border-neutral-100 last:border-b-0"
                                >
                                    {hit.imageUrl && !brokenThumbs.has(hit.sku) ? (
                                        // eslint-disable-next-line @next/next/no-img-element -- Shopify CDN URL; Next/Image needs whitelisted domain config
                                        <img
                                            src={hit.imageUrl}
                                            alt=""
                                            className="h-9 w-9 shrink-0 rounded object-cover bg-neutral-100"
                                            onError={() => setBrokenThumbs((prev) => new Set(prev).add(hit.sku))}
                                        />
                                    ) : (
                                        <span className="h-9 w-9 shrink-0 rounded bg-neutral-100" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide">
                                            {hit.sku}{hit.capacity ? ` · ${hit.capacity}` : ""}
                                        </p>
                                        <p className="font-sans text-[13px] text-neutral-900 truncate" title={hit.itemName}>
                                            {hit.itemName}
                                        </p>
                                    </div>
                                    <p className="shrink-0 font-sans text-[12px] text-neutral-500 tabular-nums">
                                        {hit.startingPrice !== null ? `from ${money(hit.startingPrice)}` : "—"}
                                    </p>
                                    {hit.orderable ? (
                                        <PortalButton size="sm" variant="outline" type="button" onClick={() => addHit(hit)} disabled={pending}>
                                            Add
                                        </PortalButton>
                                    ) : (
                                        <span className="shrink-0 font-sans text-[11px] text-neutral-400">Quote only</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowBulk((v) => !v)}
                        className="mt-2.5 font-sans text-[12px] text-neutral-500 hover:text-neutral-800 cursor-pointer"
                    >
                        {showBulk ? "Hide paste box" : "Paste a list from a spreadsheet"}
                    </button>

                    {showBulk && (
                        <div className="mt-2.5">
                            <textarea
                                value={bulk}
                                onChange={(e) => setBulk(e.target.value)}
                                rows={4}
                                placeholder={"GBCyl9SpryGl, 500\nGB-ELG-CLR-30ML, 250"}
                                className="w-full px-3 py-2 font-mono text-[12px] rounded-md border border-neutral-300 bg-white text-neutral-900 outline-none focus:border-neutral-500"
                            />
                            <PortalButton size="sm" type="button" onClick={addBulk} disabled={pending || !bulk.trim()}>
                                Add all
                            </PortalButton>
                        </div>
                    )}
                </div>
            )}

            {problems.length > 0 && (
                <div className="px-5 py-3 border-b border-neutral-200 bg-amber-50">
                    {problems.map((p) => (
                        <p key={p} className="font-sans text-[12.5px] text-amber-800">{p}</p>
                    ))}
                </div>
            )}

            {lines.length === 0 ? (
                <div className="px-5 py-10 text-center">
                    <p className="font-sans text-[13px] text-neutral-500">
                        Nothing on this order yet. Add a SKU above, or paste your list.
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-[1fr_110px_100px_110px_40px] gap-3 px-5 py-2.5 border-b border-neutral-200">
                        {["Item", "Qty", "Unit", "Line total", ""].map((h, i) => (
                            <p key={h || i} className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide">
                                {h}
                            </p>
                        ))}
                    </div>
                    {lines.map((line, i) => (
                        <div
                            key={line.sku}
                            className={`grid grid-cols-[1fr_110px_100px_110px_40px] gap-3 items-center px-5 py-3 ${
                                i < lines.length - 1 ? "border-b border-neutral-100" : ""
                            }`}
                        >
                            <div className="min-w-0">
                                <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide">
                                    {line.sku}
                                </p>
                                <p className="font-sans text-[13px] text-neutral-900 truncate" title={line.description}>
                                    {line.description}
                                </p>
                            </div>
                            {readOnly ? (
                                <p className="font-sans text-[13px] text-neutral-900 tabular-nums">
                                    {line.quantity.toLocaleString()}
                                </p>
                            ) : (
                                <input
                                    aria-label={`Quantity for ${line.sku}`}
                                    defaultValue={line.quantity}
                                    inputMode="numeric"
                                    disabled={pending}
                                    onBlur={(e) => {
                                        const next = Math.max(1, Math.floor(Number(e.target.value) || 1));
                                        if (next !== line.quantity) setQuantity(line, next);
                                    }}
                                    className="w-full h-8 px-2 font-sans text-[13px] tabular-nums rounded-md border border-neutral-200 bg-white text-neutral-900 outline-none focus:border-neutral-500"
                                />
                            )}
                            <p className="font-sans text-[13px] text-neutral-500 tabular-nums">{money(line.unitPrice)}</p>
                            <p className="font-sans text-[13px] font-medium text-neutral-900 tabular-nums">
                                {money((line.unitPrice ?? 0) * line.quantity)}
                            </p>
                            {readOnly ? <span /> : (
                                <button
                                    type="button"
                                    aria-label={`Remove ${line.sku}`}
                                    onClick={() => remove(line)}
                                    disabled={pending}
                                    className="justify-self-end text-neutral-400 hover:text-neutral-800 cursor-pointer disabled:opacity-40"
                                >
                                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                        <path d="M4 4l8 8M12 4l-8 8" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    ))}
                    <div className="flex items-center justify-between px-5 py-3.5 border-t border-neutral-200 bg-neutral-50">
                        <p className="font-sans text-[13px] text-neutral-500">
                            {lines.length} line{lines.length === 1 ? "" : "s"}
                        </p>
                        <p className="font-sans text-[15px] font-semibold text-neutral-900 tabular-nums">
                            {money(total)}
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}
