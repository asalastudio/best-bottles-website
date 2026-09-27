import type { PendingCartProduct, ProductCard } from "@/components/GraceContext";
import { isCheckoutReady } from "@/lib/checkout";
import { hasCatalogSourceHold, isHiddenCatalogGroup } from "@/lib/products/catalog-listing-visibility";

export type OrderListLine = { sku: string; quantity: number };
export type OrderListError = "empty" | "format" | "quantity" | "tooMany" | "tooLarge";
export class OrderListParseError extends Error {
    constructor(public code: OrderListError) { super(code); }
}

/** CSV/TSV parsing is local: only SKU and quantity are sent for catalog lookup. */
export function parseOrderList(text: string): OrderListLine[] {
    if (text.length > 262144) throw new OrderListParseError("tooLarge");
    const source = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    const separator = source.split("\n")[0].includes("\t") ? "\t" : ",";
    const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false; let closedQuote = false;
    for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        if (closedQuote && ch !== separator && ch !== "\n" && !/\s/.test(ch)) throw new OrderListParseError("format");
        if (closedQuote && ch !== separator && ch !== "\n") continue;
        if (ch === '"') {
            if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
            else if (!quoted && cell.trim()) throw new OrderListParseError("format");
            else { closedQuote = quoted; quoted = !quoted; }
        } else if (!quoted && (ch === separator || ch === "\n")) {
            row.push(cell.trim()); cell = ""; closedQuote = false;
            if (ch === "\n") { if (row.some(Boolean)) rows.push(row); row = []; }
        } else cell += ch;
    }
    if (quoted) throw new OrderListParseError("format");
    row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
    if (!rows.length) throw new OrderListParseError("empty");
    const first = rows[0].map(value => value.toLowerCase().replace(/[ _-]/g, ""));
    const skuIndex = first.findIndex(value => ["sku", "websitesku", "gracesku"].includes(value));
    const qtyIndex = first.findIndex(value => ["qty", "quantity", "cantidad"].includes(value));
    const hasHeader = skuIndex >= 0 || qtyIndex >= 0;
    if (hasHeader && (skuIndex < 0 || qtyIndex < 0)) throw new OrderListParseError("format");
    const data = hasHeader ? rows.slice(1) : rows;
    if (data.length > 50) throw new OrderListParseError("tooMany");
    if (!data.length) throw new OrderListParseError("empty");
    const merged = new Map<string, OrderListLine>();
    for (const values of data) {
        const sku = values[hasHeader ? skuIndex : 0] ?? "";
        const rawQuantity = values[hasHeader ? qtyIndex : 1] ?? "";
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}$/.test(sku)) throw new OrderListParseError("format");
        if (!/^\d+$/.test(rawQuantity)) throw new OrderListParseError("quantity");
        const quantity = Number(rawQuantity);
        const key = sku.toUpperCase(); const previous = merged.get(key);
        const total = quantity + (previous?.quantity ?? 0);
        if (!Number.isSafeInteger(quantity) || quantity < 1 || total > 100000) throw new OrderListParseError("quantity");
        merged.set(key, { sku: previous?.sku ?? sku, quantity: total });
    }
    return [...merged.values()];
}

export function resolveOrderListProduct(line: OrderListLine, value: unknown): PendingCartProduct | null {
    if (!value || typeof value !== "object") return null;
    const p = value as ProductCard;
    if (typeof p.graceSku !== "string" || typeof p.itemName !== "string") return null;
    const exact = [p.graceSku, p.websiteSku].some(sku => typeof sku === "string" && sku.toLowerCase() === line.sku.toLowerCase());
    if (!exact || !isCheckoutReady(p) || /__RETIRED__/.test(p.websiteSku ?? "") || /^discontinued$/i.test(p.stockStatus ?? "")) return null;
    if (p.slug && (hasCatalogSourceHold(p.slug) || isHiddenCatalogGroup(p.slug))) return null;
    if (typeof p.webPrice1pc !== "number" || !Number.isFinite(p.webPrice1pc) || p.webPrice1pc <= 0) return null;
    return { ...p, quantity: line.quantity, unitPrice: p.webPrice1pc };
}
