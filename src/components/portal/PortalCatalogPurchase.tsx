"use client";

import Link from "next/link";
import { useId } from "react";
import type { CatalogLineItem } from "@/lib/products/catalog-line-items";
import { activeCatalogTier, catalogCardTiers, CATALOG_QUANTITY_MAX, isCatalogVariantPurchasable } from "@/lib/products/catalog-card-purchase";
import { formatVolumeQtyRange } from "@/lib/volumePricing";
import { portalCatalogPrice } from "@/lib/portal/catalog-pricing";

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function PortalCatalogPurchase({ item, quantityText, onQuantityChange, onAdd, pending, justAdded }: {
    item: CatalogLineItem; quantityText: string; onQuantityChange: (value: string) => void;
    onAdd: (quantity: number) => void; pending: boolean; justAdded: boolean;
}) {
    const id = useId(), variant = item.purchaseVariant;
    const price = portalCatalogPrice(variant, quantityText);
    const tiers = catalogCardTiers(variant);
    const active = activeCatalogTier(tiers, price.quantity);
    if (!item.orderableSku || !variant || !isCatalogVariantPurchasable(variant)) {
        return <Link href={`/products/${item.slug}`} className="text-sm underline underline-offset-4">View options and availability</Link>;
    }
    return (
        <div className="min-w-[240px] space-y-2 text-left" data-testid="portal-catalog-purchase">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm tabular-nums" aria-live="polite">
                    {price.unitPrice !== null ? `${money(price.unitPrice)} / ea` : "Enter quantity"}
                </span>
                {tiers.length > 0 && <label className="flex items-center gap-2 text-xs" htmlFor={`${id}-pack`}>
                    Pack of
                    <select id={`${id}-pack`} aria-label={`Quantity pricing for ${item.displayName}`}
                        value={active?.minQty ?? tiers[0].minQty} disabled={pending}
                        onChange={event => onQuantityChange(event.target.value)}
                        className="min-h-11 max-w-[200px] rounded-md border border-neutral-400 bg-white px-2 text-neutral-900">
                        {tiers.map(tier => <option key={tier.minQty} value={tier.minQty}>
                            {formatVolumeQtyRange(tier.minQty, tier.maxQty)} · {money(tier.unitPrice)} / ea
                        </option>)}
                    </select>
                </label>}
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center rounded-md border border-neutral-400">
                    <button type="button" disabled={pending || price.quantity === null || price.quantity <= 1}
                        aria-label={`Decrease quantity for ${item.displayName}`} className="h-11 w-9 disabled:opacity-40"
                        onClick={() => onQuantityChange(String((price.quantity ?? 1) - 1))}>−</button>
                    <input id={`${id}-quantity`} aria-label={`Quantity for ${item.displayName}`} inputMode="numeric"
                        value={quantityText} disabled={pending} aria-invalid={Boolean(price.error)} aria-describedby={price.error ? `${id}-error` : undefined}
                        onChange={event => onQuantityChange(event.target.value)} className="h-11 w-16 bg-transparent text-center text-sm tabular-nums" />
                    <button type="button" disabled={pending || price.quantity === null || price.quantity >= CATALOG_QUANTITY_MAX}
                        aria-label={`Increase quantity for ${item.displayName}`} className="h-11 w-9 disabled:opacity-40"
                        onClick={() => onQuantityChange(String((price.quantity ?? 1) + 1))}>+</button>
                </div>
                <button type="button" disabled={pending || price.quantity === null || price.total === null}
                    onClick={() => { if (price.quantity !== null && price.total !== null) onAdd(price.quantity); }}
                    className="min-h-11 flex-1 rounded-md bg-neutral-900 px-3 text-sm text-white disabled:opacity-50">
                    {justAdded ? "Added" : pending ? "Adding…" : `Add${price.total !== null ? ` · ${money(price.total)}` : ""}`}
                </button>
            </div>
            {price.error && <p id={`${id}-error`} role="alert" className="text-xs text-red-700">{price.error}</p>}
            <p className="text-[11px] text-neutral-600">Published volume pricing. Account pricing and checkout availability are confirmed separately.</p>
        </div>
    );
}
