"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PageHeader, PortalButton } from "@/components/portal/ui";
import { savePriceListToDraftAction } from "../actions";
import { readFromPriceListStorage, clearPriceListStorage } from "@/lib/priceListStorage";

type LineItem = { sku: string; description: string; quantity: number; unitPrice: number };

const emptyRow: LineItem = { sku: "", description: "", quantity: 0, unitPrice: 0 };

function formatCurrency(value: number) {
    return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

const BROWSE_QUICK_LINKS = [
    { label: "Roll-On", term: "roller" },
    { label: "Spray", term: "spray" },
    { label: "Dropper", term: "dropper" },
    { label: "Boston Round", term: "boston round" },
    { label: "Cylinder", term: "cylinder" },
];

export default function PortalPriceList() {
    const [lineItems, setLineItems] = useState<LineItem[]>([{ ...emptyRow }]);
    const [draftName, setDraftName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchInput, setSearchInput] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [searchFocused, setSearchFocused] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    // When arriving from catalog "Add to Price List", read stored items and append
    useEffect(() => {
        const stored = readFromPriceListStorage();
        if (stored.length === 0) return;
        clearPriceListStorage();
        setLineItems((prev) => {
            const added = stored.map((item) => ({
                sku: item.sku,
                description: item.description,
                quantity: 1,
                unitPrice: item.unitPrice,
            }));
            const filtered = prev.filter((r) => r.sku.trim() || r.description.trim());
            return filtered.length > 0 ? [...filtered, ...added] : [...added, { ...emptyRow }];
        });
    }, []);

    const searchResults = useQuery(
        api.grace.searchCatalog,
        debouncedSearch.length >= 2 ? { searchTerm: debouncedSearch } : "skip"
    );

    const addRow = () => setLineItems((prev) => [...prev, { ...emptyRow }]);

    const addProductToQuote = useCallback(
        (product: { graceSku: string; itemName: string; webPrice1pc: number | null }) => {
            const price = product.webPrice1pc ?? 0;
            setLineItems((prev) => [...prev, { sku: product.graceSku, description: product.itemName, quantity: 1, unitPrice: price }]);
            setSearchInput("");
            setDebouncedSearch("");
            setSearchFocused(false);
        },
        []
    );

    const removeRow = (index: number) => {
        if (lineItems.length <= 1) return;
        setLineItems((prev) => prev.filter((_, i) => i !== index));
    };

    const updateRow = (index: number, field: keyof LineItem, value: string | number) => {
        setLineItems((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const validItems = lineItems.filter((r) => r.sku.trim() && r.description.trim() && r.quantity > 0);
    const subtotal = validItems.reduce((sum, r) => sum + r.quantity * (r.unitPrice || 0), 0);

    const handleSaveToDraft = async () => {
        if (validItems.length === 0) return;
        setIsSubmitting(true);
        try {
            await savePriceListToDraftAction(
                validItems.map((r) => ({
                    sku: r.sku.trim(),
                    description: r.description.trim(),
                    quantity: r.quantity,
                    unitPrice: r.unitPrice || undefined,
                })),
                draftName.trim() || undefined
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const showSearchResults = searchFocused && debouncedSearch.length >= 2;
    const results = (searchResults ?? []).slice(0, 12);

    return (
        <div className="px-6 py-6 max-w-[1200px]">
            <PageHeader
                eyebrow="Quote Builder"
                title="Price List"
                subtitle="Build your own line-item list with SKUs, descriptions, quantities, and pricing. Save to a draft or use as a reference for your quote request."
            />

            {/* Catalog search — add products directly to your quote */}
            <div className="mb-4 p-4 bg-white border border-neutral-200 rounded-lg">
                <p className="font-sans text-[11px] font-medium text-neutral-500 uppercase tracking-wide mb-2">
                    Add from catalog
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <input
                            type="text"
                            placeholder="Search by SKU, product name, or keyword…"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                            className="font-sans text-[13px] w-full px-3 py-2 border border-neutral-200 rounded-md placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:border-transparent"
                        />
                        {showSearchResults && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-20 max-h-[320px] overflow-y-auto">
                                {searchResults === undefined ? (
                                    <div className="px-4 py-6 text-center font-sans text-[13px] text-neutral-500">Searching…</div>
                                ) : results.length === 0 ? (
                                    <div className="px-4 py-6 text-center font-sans text-[13px] text-neutral-500">No products found. Try a different term.</div>
                                ) : (
                                    <ul className="py-1">
                                        {results.map((p) => (
                                            <li key={p.graceSku} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-neutral-50 border-b border-neutral-100 last:border-0">
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-sans text-[13px] font-medium text-neutral-900 truncate">{p.itemName}</p>
                                                    <p className="font-sans text-[11px] text-neutral-500">{p.graceSku}</p>
                                                </div>
                                                <div className="shrink-0 flex items-center gap-2">
                                                    <span className="font-sans text-[13px] text-neutral-600">
                                                        {(p.webPrice1pc ?? 0) > 0 ? formatCurrency(p.webPrice1pc!) : "—"}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => addProductToQuote(p)}
                                                        className="font-sans text-[12px] font-medium px-2.5 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                    <span className="font-sans text-[12px] text-neutral-400">or</span>
                    <div className="flex flex-wrap gap-1.5">
                        {BROWSE_QUICK_LINKS.map(({ label, term }) => (
                            <button
                                key={term}
                                type="button"
                                onClick={() => {
                                    setSearchInput(term);
                                    setSearchFocused(true);
                                }}
                                className="font-sans text-[12px] px-2.5 py-1 rounded border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mb-4 flex items-center gap-3">
                <input
                    type="text"
                    placeholder="Draft name (optional)"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="font-sans text-[13px] px-3 py-2 border border-neutral-200 rounded-md w-64 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:border-transparent"
                />
                <PortalButton variant="outline" size="sm" type="button" onClick={addRow}>
                    Add Row
                </PortalButton>
            </div>

            <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-neutral-50 border-b border-neutral-200">
                                <th className="px-5 py-3 text-left font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide w-[140px]">
                                    SKU
                                </th>
                                <th className="px-5 py-3 text-left font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide min-w-[200px]">
                                    Description
                                </th>
                                <th className="px-5 py-3 text-right font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide w-[100px]">
                                    Qty
                                </th>
                                <th className="px-5 py-3 text-right font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide w-[100px]">
                                    Unit $
                                </th>
                                <th className="px-5 py-3 text-right font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide w-[110px]">
                                    Extended
                                </th>
                                <th className="px-5 py-3 w-12" />
                            </tr>
                        </thead>
                        <tbody>
                            {lineItems.map((row, i) => (
                                <tr key={i} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50">
                                    <td className="px-5 py-2.5">
                                        <input
                                            type="text"
                                            placeholder="e.g. GB-CYL-CLR-10ML-MRL-GLD"
                                            value={row.sku}
                                            onChange={(e) => updateRow(i, "sku", e.target.value)}
                                            className="font-sans text-[13px] w-full px-2.5 py-1.5 border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-300"
                                        />
                                    </td>
                                    <td className="px-5 py-2.5">
                                        <input
                                            type="text"
                                            placeholder="Cylinder 10ml Clear Metal Roller Gold"
                                            value={row.description}
                                            onChange={(e) => updateRow(i, "description", e.target.value)}
                                            className="font-sans text-[13px] w-full px-2.5 py-1.5 border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-300"
                                        />
                                    </td>
                                    <td className="px-5 py-2.5 text-right">
                                        <input
                                            type="number"
                                            min={0}
                                            value={row.quantity || ""}
                                            onChange={(e) => updateRow(i, "quantity", parseInt(e.target.value, 10) || 0)}
                                            className="font-sans text-[13px] w-20 px-2.5 py-1.5 border border-neutral-200 rounded text-right focus:outline-none focus:ring-1 focus:ring-neutral-300"
                                        />
                                    </td>
                                    <td className="px-5 py-2.5 text-right">
                                        <input
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            value={row.unitPrice || ""}
                                            onChange={(e) => updateRow(i, "unitPrice", parseFloat(e.target.value) || 0)}
                                            className="font-sans text-[13px] w-20 px-2.5 py-1.5 border border-neutral-200 rounded text-right focus:outline-none focus:ring-1 focus:ring-neutral-300"
                                        />
                                    </td>
                                    <td className="px-5 py-2.5 text-right font-sans text-[13px] font-medium text-neutral-900">
                                        {row.quantity > 0 && (row.unitPrice || 0) > 0
                                            ? formatCurrency(row.quantity * (row.unitPrice || 0))
                                            : "—"}
                                    </td>
                                    <td className="px-2 py-2">
                                        <button
                                            type="button"
                                            onClick={() => removeRow(i)}
                                            disabled={lineItems.length <= 1}
                                            className="p-1.5 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            aria-label="Remove row"
                                        >
                                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                                <path d="M4 4l8 8M12 4l-8 8" />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-5 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
                    <div>
                        <p className="font-sans text-[12px] text-neutral-500">
                            {validItems.length} line item{validItems.length !== 1 ? "s" : ""}
                        </p>
                        <p className="font-sans text-[18px] font-semibold text-neutral-900 mt-0.5">
                            Subtotal: {formatCurrency(subtotal)}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Link href="/catalog">
                            <PortalButton variant="outline" size="sm" type="button">
                                Browse Catalog
                            </PortalButton>
                        </Link>
                        <Link href="/request-quote">
                            <PortalButton variant="outline" size="sm" type="button">
                                Request Quote
                            </PortalButton>
                        </Link>
                        <PortalButton
                            size="sm"
                            type="button"
                            onClick={handleSaveToDraft}
                            disabled={validItems.length === 0 || isSubmitting}
                        >
                            {isSubmitting ? "Saving…" : "Save to Draft"}
                        </PortalButton>
                    </div>
                </div>
            </div>

            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-sans text-[12px] text-amber-800">
                    <strong>Tip:</strong> Search above to add products directly to your list — SKU, description, and price fill in automatically. You can also browse the full catalog or paste from a spreadsheet.
                </p>
            </div>
        </div>
    );
}
