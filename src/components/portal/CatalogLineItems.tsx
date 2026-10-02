"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { CatalogLineItem } from "@/lib/products/catalog-line-items";
import PortalCatalogPurchase from "./PortalCatalogPurchase";

export type AddToOrderResult =
    | { ok: true; draftId: string; draftName: string; quantity: number }
    | { ok: false; message: string };

const cell = "px-3 py-2.5 font-sans text-[13px] align-middle";
const headCell =
    "px-3 py-2.5 font-sans text-[11px] font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]";

/**
 * A product thumbnail that yields rather than shouts.
 *
 * Many rows still carry Shopify URLs for files that were deleted, so a 404 is
 * ordinary here. A grid of broken-image glyphs reads as a broken page, so a
 * failed load falls back to a plain tile. Plain <img> rather than next/image:
 * these URLs span several hosts, and routing them through /_next/image buys
 * nothing for a 44px tile while adding a host allowlist to maintain.
 */
function Thumb({ item }: { item: CatalogLineItem }) {
    const [broken, setBroken] = useState(false);
    const usable = item.thumbnailUrl && !broken;
    return (
        <span
            className="h-11 w-11 shrink-0 rounded-md border flex items-center justify-center overflow-hidden"
            style={{ borderColor: "var(--color-rule)", background: "var(--color-surface-sunken)" }}
        >
            {usable ? (
                // eslint-disable-next-line @next/next/no-img-element -- see note above
                <img
                    src={item.thumbnailUrl as string}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-contain p-0.5"
                    onError={() => setBroken(true)}
                />
            ) : null}
        </span>
    );
}

/**
 * The catalogue as line items.
 *
 * This is the same table the storefront serves at /catalog?view=line, in the
 * portal's own register: a wholesale buyer reading down a column of SKUs,
 * capacities and prices, adding quantities as they go. The order it adds to is
 * chosen server-side — the newest open one — so browsing never stops to ask
 * which document to file against.
 */
export default function CatalogLineItems({
    items,
    totalCount,
    initialSearch,
    addToOrder,
}: {
    items: CatalogLineItem[];
    totalCount: number;
    initialSearch: string;
    addToOrder: (input: { sku: string; quantity: number }) => Promise<AddToOrderResult>;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [term, setTerm] = useState(initialSearch);
    const [quantities, setQuantities] = useState<Record<string, string>>({});
    const [pendingSku, setPendingSku] = useState<string | null>(null);
    const [addedSku, setAddedSku] = useState<string | null>(null);
    const [notice, setNotice] = useState<
        { kind: "ok"; text: string; draftId: string } | { kind: "error"; text: string } | null
    >(null);
    const [, startTransition] = useTransition();
    const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => setTerm(initialSearch), [initialSearch]);
    useEffect(() => () => { if (addedTimer.current) clearTimeout(addedTimer.current); }, []);

    const runSearch = (next: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next.trim()) params.set("q", next.trim());
        else params.delete("q");
        startTransition(() => router.push(`/portal/catalog${params.toString() ? `?${params}` : ""}`));
    };

    const add = async (item: CatalogLineItem, quantity: number) => {
        if (!item.orderableSku) return;
        setPendingSku(item.orderableSku);
        setNotice(null);
        try {
            const result = await addToOrder({ sku: item.orderableSku, quantity });
            if (result.ok) {
                setNotice({
                    kind: "ok",
                    text: `${quantity.toLocaleString()} × ${item.displayName} added to ${result.draftName}.`,
                    draftId: result.draftId,
                });
                setAddedSku(item.orderableSku);
                if (addedTimer.current) clearTimeout(addedTimer.current);
                addedTimer.current = setTimeout(() => setAddedSku(null), 2200);
            } else {
                setNotice({ kind: "error", text: result.message });
            }
        } catch {
            setNotice({ kind: "error", text: "We couldn't add that just now. Try again." });
        } finally {
            setPendingSku(null);
        }
    };

    return (
        <div>
            {/* Search */}
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runSearch(term); } }}
                    placeholder="Search the catalogue — SKU, capacity, colour, family"
                    aria-label="Search the catalogue"
                    className="h-11 flex-1 rounded-md border px-3 font-sans text-[16px] outline-none sm:h-9 sm:text-[13px]"
                    style={{
                        borderColor: "var(--color-rule)",
                        background: "var(--color-surface)",
                        color: "var(--color-text-primary)",
                    }}
                />
                <button
                    type="button"
                    onClick={() => runSearch(term)}
                    className="h-11 px-4 font-sans text-[13px] font-medium rounded-md sm:h-9"
                    style={{ background: "var(--color-text-primary)", color: "var(--color-surface)" }}
                >
                    Search
                </button>
                {initialSearch && (
                    <button
                        type="button"
                        onClick={() => { setTerm(""); runSearch(""); }}
                        className="h-9 px-3 font-sans text-[13px] rounded-md"
                        style={{ color: "var(--color-text-secondary)" }}
                    >
                        Clear
                    </button>
                )}
            </div>

            {notice && (
                <div
                    className="mb-3 px-4 py-2.5 rounded-md flex items-center justify-between gap-3"
                    style={
                        notice.kind === "ok"
                            ? {
                                  background: "var(--color-status-positive-surface)",
                                  color: "var(--color-status-positive-text)",
                              }
                            : {
                                  background: "var(--color-status-warning-surface)",
                                  color: "var(--color-status-warning-text)",
                              }
                    }
                >
                    <p className="font-sans text-[13px]">{notice.text}</p>
                    {notice.kind === "ok" && (
                        <Link
                            href={`/portal/drafts/${notice.draftId}`}
                            className="font-sans text-[13px] font-medium underline shrink-0"
                        >
                            Open order
                        </Link>
                    )}
                </div>
            )}

            <p className="font-sans text-[12.5px] mb-2 text-[color:var(--color-text-muted)]">
                {totalCount.toLocaleString()} product{totalCount === 1 ? "" : "s"}
                {items.length < totalCount ? ` · showing ${items.length.toLocaleString()}` : ""}
            </p>

            {/* Desktop table */}
            <div
                className="hidden md:block rounded-lg border overflow-hidden"
                style={{ borderColor: "var(--color-rule)", background: "var(--color-surface)" }}
            >
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] border-collapse">
                        <thead>
                            <tr style={{ background: "var(--color-surface-sunken)" }}>
                                <th className={`${headCell} text-left`}>Product</th>
                                <th className={`${headCell} text-left`}>SKU</th>
                                <th className={`${headCell} text-left`}>Capacity</th>
                                <th className={`${headCell} text-left`}>Colour</th>
                                <th className={`${headCell} text-left`}>Neck</th>
                                <th className={`${headCell} text-right`}>Add to order</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.groupId} style={{ borderTop: "1px solid var(--color-rule)" }}>
                                    <td className={cell}>
                                        <Link
                                            href={`/products/${item.slug}`}
                                            target="_blank"
                                            className="flex items-center gap-3 min-w-0 group"
                                        >
                                            <Thumb item={item} />
                                            <span className="min-w-0">
                                                <span
                                                    className="block font-sans text-[13px] truncate max-w-[300px] group-hover:underline"
                                                    style={{ color: "var(--color-text-primary)" }}
                                                    title={item.displayName}
                                                >
                                                    {item.displayName}
                                                </span>
                                                <span
                                                    className="block font-sans text-[11.5px]"
                                                    style={{ color: "var(--color-text-muted)" }}
                                                >
                                                    {[item.family, item.variantCount > 1 ? `${item.variantCount} variants` : null]
                                                        .filter(Boolean)
                                                        .join(" · ")}
                                                </span>
                                            </span>
                                        </Link>
                                    </td>
                                    <td className={`${cell} font-mono text-[12px]`} style={{ color: "var(--color-text-secondary)" }}>
                                        {item.skuLabel}
                                    </td>
                                    <td className={cell} style={{ color: "var(--color-text-secondary)" }}>{item.capacity ?? "—"}</td>
                                    <td className={cell} style={{ color: "var(--color-text-secondary)" }}>{item.color ?? "—"}</td>
                                    <td className={cell} style={{ color: "var(--color-text-secondary)" }}>{item.neckThreadSize ?? "—"}</td>
                                    <td className={`${cell} text-right`}>
                                        <PortalCatalogPurchase
                                            item={item}
                                            quantityText={quantities[item.groupId] ?? "1"}
                                            onQuantityChange={(value) => setQuantities(current => ({ ...current, [item.groupId]: value }))}
                                            pending={pendingSku === item.orderableSku}
                                            justAdded={addedSku === item.orderableSku}
                                            onAdd={(quantity) => void add(item, quantity)}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile cards — the same rows, stacked */}
            <div className="md:hidden flex flex-col gap-2">
                {items.map((item) => (
                    <div
                        key={item.groupId}
                        className="rounded-lg border px-3 py-3"
                        style={{ borderColor: "var(--color-rule)", background: "var(--color-surface)" }}
                    >
                        <Link href={`/products/${item.slug}`} target="_blank" className="flex items-start gap-3">
                            <Thumb item={item} />
                            <span className="min-w-0">
                                <span className="block font-sans text-[13px]" style={{ color: "var(--color-text-primary)" }}>
                                    {item.displayName}
                                </span>
                                <span className="block font-mono text-[11.5px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                                    {item.skuLabel}
                                </span>
                            </span>
                        </Link>
                        <p className="font-sans text-[12px] mt-2" style={{ color: "var(--color-text-secondary)" }}>
                            {[item.capacity, item.color, item.neckThreadSize].filter(Boolean).join(" · ") || "—"}
                        </p>
                        <div className="flex items-center justify-between gap-2 mt-2.5">
                            <PortalCatalogPurchase
                                item={item}
                                quantityText={quantities[item.groupId] ?? "1"}
                                onQuantityChange={(value) => setQuantities(current => ({ ...current, [item.groupId]: value }))}
                                pending={pendingSku === item.orderableSku}
                                justAdded={addedSku === item.orderableSku}
                                onAdd={(quantity) => void add(item, quantity)}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {items.length === 0 && (
                <div
                    className="rounded-lg border px-5 py-10 text-center"
                    style={{ borderColor: "var(--color-rule)", background: "var(--color-surface)" }}
                >
                    <p className="font-sans text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                        Nothing matched {initialSearch ? `“${initialSearch}”` : "that"}. Try a SKU, a capacity, or a family name.
                    </p>
                </div>
            )}
        </div>
    );
}
