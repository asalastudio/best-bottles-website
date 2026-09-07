import type { CatalogRow } from "./model";

type ListedComponent = CatalogRow["components"][string][number];
export type ActiveComponent = {
    websiteSku?: string | null; graceSku?: string | null; neckThreadSize?: string | null;
    shopifySellable?: boolean | null; shopifyVariantId?: string | null; stockStatus?: string | null;
    itemName?: string | null; imageUrl?: string | null;
};

/** Only a retired, already-listed identity can request an exact replacement.
 * This is not a thread-based compatibility search. */
export function listedReplacementSku(part: ListedComponent): string | null {
    const marker = `__RETIRED__${part.graceSku}__`;
    const index = part.websiteSku?.indexOf(marker) ?? -1;
    return index > 0 ? part.websiteSku!.slice(0, index) : null;
}

export function restoreListedComponent(part: ListedComponent, active: ActiveComponent | null, neck: string | null | undefined): ListedComponent {
    const exactSku = listedReplacementSku(part);
    if (!exactSku || !active || active.websiteSku !== exactSku || !active.graceSku
        || active.graceSku === part.graceSku || active.neckThreadSize !== neck
        || /__RETIRED__/i.test(active.websiteSku) || active.shopifySellable === false
        || !active.shopifyVariantId || /out of stock|discontinued|unavailable/i.test(active.stockStatus ?? "")) return part;
    return { ...part, websiteSku: active.websiteSku, graceSku: active.graceSku,
        shopifySellable: active.shopifySellable ?? null, shopifyVariantId: active.shopifyVariantId,
        stockStatus: active.stockStatus ?? null, itemName: active.itemName ?? part.itemName,
        imageUrl: active.imageUrl ?? part.imageUrl, productGroupSlug: null };
}

export async function resolveListedComponents(rows: CatalogRow[], lookup: (sku: string) => Promise<ActiveComponent | null>): Promise<CatalogRow[]> {
    const skus = [...new Set(rows.flatMap(row => Object.values(row.components).flatMap(parts =>
        parts.map(listedReplacementSku).filter((sku): sku is string => Boolean(sku)))))];
    const products = new Map<string, ActiveComponent | null>();
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(8, skus.length) }, async () => {
        while (cursor < skus.length) { const sku = skus[cursor++]; products.set(sku, await lookup(sku)); }
    }));
    return rows.map(row => ({ ...row, components: Object.fromEntries(Object.entries(row.components).map(([kind, parts]) =>
        [kind, parts.map(part => restoreListedComponent(part, products.get(listedReplacementSku(part) ?? "") ?? null, row.neckThreadSize))])) }));
}
