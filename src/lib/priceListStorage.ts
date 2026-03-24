/**
 * Session storage for items to add to the Price List when user navigates from catalog.
 * When user clicks "Add to Price List" on catalog/PDP, we store here and redirect to /portal/price-list.
 * The Price List page reads on load and appends to line items.
 */

const STORAGE_KEY = "bestbottles_price_list_add_items";

export type PriceListAddItem = {
    sku: string;
    description: string;
    unitPrice: number;
};

export function addToPriceListStorage(items: PriceListAddItem[]): void {
    if (typeof window === "undefined") return;
    const existing = readFromPriceListStorage();
    const merged = [...existing, ...items];
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
        // quota exceeded or private mode
    }
}

export function readFromPriceListStorage(): PriceListAddItem[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (x): x is PriceListAddItem =>
                typeof x === "object" &&
                x !== null &&
                typeof (x as PriceListAddItem).sku === "string" &&
                typeof (x as PriceListAddItem).description === "string" &&
                typeof (x as PriceListAddItem).unitPrice === "number"
        );
    } catch {
        return [];
    }
}

export function clearPriceListStorage(): void {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
}
