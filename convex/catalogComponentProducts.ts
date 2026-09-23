import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { NormalizedComponent } from "./componentUtils";

/** Resolve the product behind a recorded compatibility edge. An imported
 * retired duplicate may resolve only to its exact active website SKU. Never
 * substitute another finish, another thread, or an assembled bottle. */
export function createComponentProductResolver(ctx: QueryCtx) {
    const records = new Map<string, Promise<Doc<"products"> | null>>();
    const replacements = new Map<string, Promise<Doc<"products">[]>>();
    return async (item: NormalizedComponent, neck: string) => {
        if (!records.has(item.graceSku)) records.set(item.graceSku, ctx.db.query("products")
            .withIndex("by_graceSku", q => q.eq("graceSku", item.graceSku)).take(2)
            .then(matches => matches.length === 1 ? matches[0] : null));
        let product = await records.get(item.graceSku)!;
        if (!product) return null;
        const marker = `__RETIRED__${item.graceSku}__`;
        const index = product.websiteSku.indexOf(marker);
        if (index > 0) {
            const sku = product.websiteSku.slice(0, index);
            if (!replacements.has(sku)) replacements.set(sku, ctx.db.query("products")
                .withIndex("by_websiteSku", q => q.eq("websiteSku", sku)).take(2));
            const matches = await replacements.get(sku)!;
            if (matches.length !== 1) return null;
            product = matches[0];
        }
        if (product.category !== "Component" || /__RETIRED__/i.test(product.websiteSku)
            || (product.neckThreadSize && product.neckThreadSize !== neck)) return null;
        return {
            ...item, graceSku: product.graceSku, websiteSku: product.websiteSku || item.websiteSku || null,
            itemName: product.itemName, imageUrl: product.imageUrl ?? item.imageUrl,
            webPrice1pc: product.webPrice1pc ?? item.webPrice1pc,
            webPrice12pc: product.webPrice12pc ?? item.webPrice12pc,
            capColor: product.capColor ?? item.capColor, stockStatus: product.stockStatus,
            shopifyVariantId: product.shopifyVariantId ?? null, shopifySellable: product.shopifySellable ?? null,
            productGroupId: product.productGroupId ?? null,
        };
    };
}
