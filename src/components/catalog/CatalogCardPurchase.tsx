"use client";

/**
 * Grid-card purchase block (master catalog design 8a): the live unit price,
 * a "Pack of" menu that picks a quantity break, a quantity stepper, and one
 * full-width "Add to cart · subtotal" button. Sits OUTSIDE the card's
 * product links so quantity, tier and cart clicks never navigate.
 *
 * The menu is the only tier UI: no modal and no accordion. Picking a break
 * sets the quantity to its first piece count; typing or stepping a quantity
 * moves the break. The menu is absolutely positioned, so neither the card nor
 * the grid may clip overflow.
 *
 * Pricing comes from the assembly's published ladder through
 * `catalog-card-purchase.ts` → `volumePricing.ts`; nothing here restates a
 * price. Every break's rate is shown as the price (Jordan, 2026-09-25: no
 * "Quote" marks on the card): the headline follows the active break and the
 * button total is that rate × quantity. Whether checkout bills the break is
 * `NEXT_PUBLIC_VOLUME_TIERS_HONORED_AT_CHECKOUT`'s concern, not the card's.
 */

import LocaleLink from "@/components/LocaleLink";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useCart } from "@/components/CartProvider";
import { analytics } from "@/lib/analytics";
import {
    CATALOG_QUANTITY_MAX,
    activeCatalogTier,
    buildCatalogCartItem,
    catalogCardTiers,
    catalogTierLabel,
    catalogVariantOrderBlocked,
    catalogVariantSoldOut,
    describeCatalogTier,
    isCatalogVariantPurchasable,
    parseCatalogQuantity,
    type CatalogCartContext,
    type CatalogPurchaseVariant,
} from "@/lib/products/catalog-card-purchase";
import { formatVolumeQtyRange, type DisplayVolumeTier } from "@/lib/volumePricing";
import { useRegion } from "@/components/RegionProvider";

/** Telemetry is best-effort: a tracking failure must never block or misreport a cart update. */
function track(send: () => void) {
    try {
        send();
    } catch {
        // Ignore — analytics outages are invisible to the customer.
    }
}

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1c1e]";
const STEP_BUTTON = `flex h-full w-8 shrink-0 items-center justify-center text-[15px] text-[#5d6b7e] transition-colors motion-reduce:transition-none hover:bg-[#f1ebe0] hover:text-[#1c1c1e] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${FOCUS_RING} focus-visible:outline-offset-[-2px]`;

export type CatalogCardPurchaseProps = {
    /** Product group slug — the cart's productGroupSlug and the analytics product ID. */
    productId: string;
    title: string;
    /** PDP link used when the card cannot sell the pictured assembly. */
    href: string;
    variant: CatalogPurchaseVariant | null;
    /** Lowest 1-unit price across the group; the fallback headline when the row carries no price. */
    groupStartingPrice: number | null;
    context: Omit<CatalogCartContext, "title" | "productGroupSlug">;
};

/** "1", "12", "500+": the break's first piece count, open-ended on the last break. */
export function catalogPackLabel(tier: DisplayVolumeTier | null | undefined): string {
    if (!tier) return "1";
    return `${tier.minQty.toLocaleString("en-US")}${tier.maxQty == null ? "+" : ""}`;
}

export default function CatalogCardPurchase({
    productId,
    title,
    href,
    variant,
    groupStartingPrice,
    context,
}: CatalogCardPurchaseProps) {
    const { formatPrice } = useRegion();
    const { addItems } = useCart();
    const baseId = useId();
    const menuId = `${baseId}-packs`;
    const qtyId = `${baseId}-qty`;

    const [qtyText, setQtyText] = useState("1");
    const [menuOpen, setMenuOpen] = useState(false);
    const [added, setAdded] = useState<number | null>(null);
    const committedQty = useRef(1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const addedTimer = useRef<number | null>(null);

    useEffect(() => () => {
        if (addedTimer.current != null) window.clearTimeout(addedTimer.current);
    }, []);

    const tiers = catalogCardTiers(variant);
    const soldOut = Boolean(variant && catalogVariantSoldOut(variant));
    const orderBlocked = Boolean(variant && catalogVariantOrderBlocked(variant));
    const canAdd = isCatalogVariantPurchasable(variant);
    const { qty, error } = parseCatalogQuantity(qtyText);
    const activeTier = activeCatalogTier(tiers, qty);
    const activeIndex = activeTier ? tiers.indexOf(activeTier) : -1;
    const sku = variant?.websiteSku ?? variant?.graceSku ?? null;
    const eventBase = { productId, sku, quantity: qty ?? 0, tier: catalogTierLabel(activeTier) };

    // Picking another cap swaps `variant` but keeps the quantity: caps in one
    // group share a ladder, and the buyer's pack size should survive the swap.

    // Close the menu on an outside press.
    useEffect(() => {
        if (!menuOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            if (event.target instanceof Node && wrapperRef.current?.contains(event.target)) return;
            setMenuOpen(false);
            track(() => analytics.catalogTierPricingToggled({ open: false, ...eventBase }));
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    });

    // Focus the active break once the list has rendered.
    const focusOnOpen = useRef(0);
    useEffect(() => {
        if (menuOpen) optionRefs.current[focusOnOpen.current]?.focus({ preventScroll: true });
    }, [menuOpen]);

    const openMenu = () => {
        if (menuOpen) return;
        focusOnOpen.current = Math.max(activeIndex, 0);
        setMenuOpen(true);
        track(() => analytics.catalogTierPricingToggled({ open: true, ...eventBase }));
    };

    const closeMenu = (returnFocus: boolean) => {
        if (!menuOpen) return;
        setMenuOpen(false);
        track(() => analytics.catalogTierPricingToggled({ open: false, ...eventBase }));
        if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
    };

    const commitQuantity = (next: number, source: "stepper" | "input" | "tier") => {
        const clamped = Math.min(Math.max(1, Math.round(next)), CATALOG_QUANTITY_MAX);
        setQtyText(String(clamped));
        if (clamped === committedQty.current) return;
        committedQty.current = clamped;
        const tier = catalogTierLabel(activeCatalogTier(tiers, clamped));
        if (source === "tier") track(() => analytics.catalogTierSelected({ productId, sku, quantity: clamped, tier }));
        else track(() => analytics.catalogQuantityChanged({ productId, sku, quantity: clamped, tier, source }));
    };

    const pickTier = (tier: DisplayVolumeTier) => {
        commitQuantity(tier.minQty, "tier");
        closeMenu(true);
    };

    const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const focused = optionRefs.current.findIndex((option) => option === document.activeElement);
        let next: number | null = null;
        if (event.key === "ArrowDown") next = Math.min(tiers.length - 1, focused + 1);
        else if (event.key === "ArrowUp") next = Math.max(0, focused - 1);
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tiers.length - 1;
        else if (event.key === "Escape") {
            event.preventDefault();
            closeMenu(true);
            return;
        } else if (event.key === "Tab") {
            closeMenu(false);
            return;
        }
        if (next == null) return;
        event.preventDefault();
        optionRefs.current[next]?.focus();
    };

    const handleAdd = () => {
        track(() => analytics.catalogQuickAdd({ stage: "clicked", ...eventBase }));
        if (!canAdd || qty == null) {
            track(() => analytics.catalogQuickAdd({
                stage: "error",
                ...eventBase,
                error: soldOut ? "sold-out" : orderBlocked ? "unavailable" : error ?? "not-purchasable",
            }));
            return;
        }
        // Only the cart mutation is inside the try: telemetry after it must not
        // turn a completed add into a reported error.
        try {
            addItems([buildCatalogCartItem(variant, qty, { ...context, title, productGroupSlug: productId })]);
        } catch (caught) {
            track(() => analytics.catalogQuickAdd({ stage: "error", ...eventBase, error: caught instanceof Error ? caught.message : "unknown" }));
            return;
        }
        track(() => analytics.cartItemAdded({
            sku: variant.graceSku,
            name: title,
            quantity: qty,
            unitPrice: variant.webPrice1pc,
            family: context.family ?? undefined,
            capacity: context.capacity ?? undefined,
            source: "catalog",
        }));
        track(() => analytics.catalogQuickAdd({ stage: "success", ...eventBase }));
        setAdded(qty);
        if (addedTimer.current != null) window.clearTimeout(addedTimer.current);
        addedTimer.current = window.setTimeout(() => setAdded(null), 4000);
    };

    if (!variant || variant.webPrice1pc == null || variant.webPrice1pc <= 0) {
        return (
            <div className="mt-auto flex flex-col gap-2.5" data-testid="catalog-card-purchase" data-state="unpriced">
                <p className="text-[18px] font-semibold leading-tight text-[#1c1c1e]" data-testid="catalog-card-price">
                    {groupStartingPrice != null
                        ? <>From {formatPrice(groupStartingPrice)}<span className="ml-1.5 text-[12px] font-normal text-[#5d6b7e]">/pc</span></>
                        : "Request pricing"}
                </p>
                <LocaleLink href={href} className={`flex min-h-11 w-full items-center justify-center border border-[#1c1c1e] px-3 text-[12px] font-medium uppercase tracking-[0.14em] text-[#1c1c1e] hover:bg-[#1c1c1e] hover:text-white ${FOCUS_RING}`}>
                    View options
                </LocaleLink>
            </div>
        );
    }

    // The active break's rate is the price: headline × quantity = button total.
    const activeUnitPrice = activeTier?.unitPrice ?? variant.webPrice1pc;
    const subtotal = (qty ?? 0) * activeUnitPrice;

    const addLabel = soldOut
        ? "Out of stock"
        : orderBlocked
            ? "Unavailable"
            : added != null
                ? "Added ✓"
                : `Add to cart · ${formatPrice(subtotal)}`;
    const addAriaLabel = soldOut
        ? `Out of stock: ${title}`
        : orderBlocked
            ? `${title} unavailable for checkout`
            : `Add ${qty ?? ""} ${title} to cart, ${formatPrice(subtotal)}`.replace(/\s+/g, " ");

    return (
        <div
            className="mt-auto flex flex-col gap-2.5"
            data-testid="catalog-card-purchase"
            data-state={soldOut ? "sold-out" : orderBlocked ? "unavailable" : "purchasable"}
        >
            <p className="flex items-baseline gap-1.5 tabular-nums" aria-live="polite" data-testid="catalog-card-price">
                <span className="text-[18px] font-semibold leading-tight text-[#1c1c1e]">{formatPrice(activeUnitPrice)}</span>
                <span className="whitespace-nowrap text-[12px] text-[#5d6b7e]" data-testid="catalog-card-active-tier">
                    /pc{activeTier && <> · {formatVolumeQtyRange(activeTier.minQty, activeTier.maxQty)} pcs</>}
                </span>
            </p>

            {soldOut && (
                <p className="-mt-1 text-[11px] font-semibold text-[#1c1c1e]" data-testid="catalog-card-stock">Out of stock</p>
            )}
            {orderBlocked && !soldOut && (
                <p className="-mt-1 text-[11px] text-[#5d6b7e]" data-testid="catalog-card-stock">
                    <span className="font-semibold text-[#1c1c1e]">Unavailable</span> for online checkout.
                </p>
            )}

            <div className="flex gap-2">
                {tiers.length > 0 && (
                    <div ref={wrapperRef} className="relative min-w-0 flex-1">
                        <button
                            ref={triggerRef}
                            type="button"
                            data-testid="catalog-card-pack-toggle"
                            aria-haspopup="listbox"
                            aria-expanded={menuOpen}
                            aria-controls={menuId}
                            disabled={orderBlocked}
                            onClick={() => (menuOpen ? closeMenu(false) : openMenu())}
                            onKeyDown={(event) => {
                                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                                    event.preventDefault();
                                    openMenu();
                                }
                            }}
                            className={`flex h-9 w-full items-center justify-between gap-2 border border-[#d9cdb9] bg-white px-2.5 text-[13px] text-[#1c1c1e] hover:border-[#1c1c1e] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                        >
                            <span className="truncate">Pack of <b className="font-semibold tabular-nums">{catalogPackLabel(activeTier)}</b></span>
                            <span aria-hidden className="text-[11px] text-[#5d6b7e]">{menuOpen ? "▴" : "▾"}</span>
                        </button>
                        {menuOpen && (
                            <div
                                id={menuId}
                                role="listbox"
                                aria-label={`Quantity breaks for ${title}`}
                                onKeyDown={onMenuKeyDown}
                                data-testid="catalog-card-pack-menu"
                                className="absolute left-0 top-full z-30 w-[200px] border border-[#1c1c1e] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
                            >
                                {tiers.map((tier, index) => {
                                    const active = index === activeIndex;
                                    return (
                                        <button
                                            key={tier.minQty}
                                            ref={(element) => { optionRefs.current[index] = element; }}
                                            type="button"
                                            role="option"
                                            aria-selected={active}
                                            aria-label={describeCatalogTier(tier, formatPrice)}
                                            onClick={() => pickTier(tier)}
                                            data-testid="catalog-card-tier-row"
                                            data-tier-min={tier.minQty}
                                            data-tier-active={active ? "true" : "false"}
                                            className={`flex w-full items-center justify-between gap-3 px-3 py-[9px] text-left text-[13px] tabular-nums focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#9a7a48] ${active ? "bg-[#1c1c1e] text-white" : "text-[#1c1c1e] hover:bg-[#f1ebe0]"}`}
                                        >
                                            <span className="whitespace-nowrap">{formatVolumeQtyRange(tier.minQty, tier.maxQty)}</span>
                                            <b className="whitespace-nowrap font-semibold">{formatPrice(tier.unitPrice)}</b>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                <div className={`flex h-9 shrink-0 items-stretch border border-[#d9cdb9] bg-white ${tiers.length > 0 ? "" : "mr-auto"}`} role="group" aria-label="Quantity">
                    <button
                        type="button"
                        className={STEP_BUTTON}
                        onClick={() => commitQuantity((qty ?? 1) - 1, "stepper")}
                        disabled={orderBlocked || (qty != null && qty <= 1)}
                        aria-label="Decrease quantity"
                    >
                        −
                    </button>
                    <label htmlFor={qtyId} className="sr-only">Quantity</label>
                    <input
                        id={qtyId}
                        data-testid="catalog-card-qty"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        value={qtyText}
                        disabled={orderBlocked}
                        onChange={(event) => setQtyText(event.target.value)}
                        onFocus={(event) => event.currentTarget.select()}
                        onBlur={() => { if (qty != null) commitQuantity(qty, "input"); }}
                        onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            if (qty != null) commitQuantity(qty, "input");
                        }}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? `${baseId}-error` : undefined}
                        className="w-11 min-w-0 border-x border-[#ece6dc] bg-transparent text-center text-[13px] tabular-nums text-[#1c1c1e] focus:outline-none focus-visible:bg-[#f8f6f2] [appearance:textfield]"
                    />
                    <button
                        type="button"
                        className={STEP_BUTTON}
                        onClick={() => commitQuantity((qty ?? 0) + 1, "stepper")}
                        disabled={orderBlocked}
                        aria-label="Increase quantity"
                    >
                        +
                    </button>
                </div>
            </div>

            {error && (
                <p id={`${baseId}-error`} role="alert" className="-mt-1 text-[11px] font-medium text-red-700" data-testid="catalog-card-qty-error">
                    {error}
                </p>
            )}
            <button
                type="button"
                data-testid="catalog-card-add"
                onClick={handleAdd}
                disabled={!canAdd || qty == null}
                aria-label={addAriaLabel}
                className={`w-full whitespace-nowrap bg-[#1c1c1e] p-3 text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-colors motion-reduce:transition-none hover:bg-[#3a3a3c] disabled:cursor-not-allowed disabled:bg-[#d9cdb9] disabled:text-[#5d6b7e] ${FOCUS_RING}`}
            >
                {addLabel}
            </button>

            {added != null && (
                <p role="status" className="-mt-1 flex items-center gap-2 text-[11px] text-[#1c1c1e]" data-testid="catalog-card-added">
                    <span>Added {added.toLocaleString("en-US")} to your cart.</span>
                    <button
                        type="button"
                        onClick={() => window.dispatchEvent(new Event("open-cart-drawer"))}
                        className={`min-h-8 font-semibold underline underline-offset-2 ${FOCUS_RING}`}
                    >
                        View cart
                    </button>
                </p>
            )}
        </div>
    );
}
