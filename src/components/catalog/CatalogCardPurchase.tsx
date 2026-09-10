"use client";

/**
 * Grid-card purchase block: headline rate, quantity stepper with the live
 * rate and subtotal, a "View tier pricing +" trigger, and a full-width Add
 * to cart. Sits OUTSIDE the card's product links so quantity, tier, and cart
 * clicks never navigate.
 *
 * The five-tier ladder opens in a native <dialog> (focus trap, Esc, backdrop
 * click) instead of expanding inline, so opening it never pushes the grid
 * below the fold or hides the bottle photo. Picking a tier in the dialog
 * prepopulates the card's quantity; Add to cart works from either place.
 *
 * Pricing comes from the assembly's published ladder through
 * `catalog-card-purchase.ts` → `volumePricing.ts`; nothing here restates a
 * price. The cart keeps its own charging policy (`resolveChargedUnitPrice`).
 */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Check, Minus, Plus, X } from "@/components/icons";
import { useCart } from "@/components/CartProvider";
import { analytics } from "@/lib/analytics";
import {
    CATALOG_QUANTITY_MAX,
    activeCatalogTier,
    buildCatalogCartItem,
    catalogCardStartingPrice,
    catalogCardTiers,
    catalogTierLabel,
    describeCatalogTier,
    isCatalogVariantPurchasable,
    parseCatalogQuantity,
    type CatalogCartContext,
    type CatalogPurchaseVariant,
} from "@/lib/products/catalog-card-purchase";
import { formatVolumeQtyRange, type DisplayVolumeTier } from "@/lib/volumePricing";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold";
const STEP_BUTTON = `flex h-11 w-11 shrink-0 items-center justify-center text-slate transition-colors motion-reduce:transition-none hover:bg-travertine hover:text-obsidian disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent sm:h-9 sm:w-9 ${FOCUS_RING} focus-visible:outline-offset-[-2px]`;
const PRIMARY_BUTTON = `inline-flex min-h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-sm bg-obsidian px-4 text-xs font-bold uppercase tracking-wider text-white transition-colors motion-reduce:transition-none hover:bg-muted-gold disabled:cursor-not-allowed disabled:bg-champagne/70 disabled:text-slate sm:min-h-10 ${FOCUS_RING}`;
const SECONDARY_BUTTON = `inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-sm border border-obsidian px-4 text-xs font-bold uppercase tracking-wider text-obsidian transition-colors motion-reduce:transition-none hover:bg-obsidian hover:text-white sm:min-h-10 ${FOCUS_RING}`;

export type CatalogCardPurchaseProps = {
    /** Product group slug — the cart's productGroupSlug and the analytics product ID. */
    productId: string;
    title: string;
    /** PDP link used when the card cannot sell the pictured assembly. */
    href: string;
    variant: CatalogPurchaseVariant | null;
    /** Lowest 1-unit price across the group; the fallback headline when the row carries no ladder. */
    groupStartingPrice: number | null;
    context: Omit<CatalogCartContext, "title" | "productGroupSlug">;
    /** The card's bottle photo, repeated in the ladder dialog so the product stays in view. */
    imageUrl?: string | null;
};

type Scope = "card" | "dialog";

export default function CatalogCardPurchase({
    productId,
    title,
    href,
    variant,
    groupStartingPrice,
    context,
    imageUrl,
}: CatalogCardPurchaseProps) {
    const { addItems } = useCart();
    const baseId = useId();
    const dialogId = `${baseId}-tiers`;
    const titleId = `${baseId}-tiers-title`;
    const scopedId = (scope: Scope, part: string) => `${baseId}-${scope}-${part}`;

    const [qtyText, setQtyText] = useState("1");
    const [tiersOpen, setTiersOpen] = useState(false);
    const [added, setAdded] = useState<number | null>(null);
    const committedQty = useRef(1);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const tierRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const addedTimer = useRef<number | null>(null);

    useEffect(() => () => {
        if (addedTimer.current != null) window.clearTimeout(addedTimer.current);
    }, []);

    const tiers = catalogCardTiers(variant);
    const purchasable = isCatalogVariantPurchasable(variant);
    const { qty, error } = parseCatalogQuantity(qtyText);
    const activeTier = activeCatalogTier(tiers, qty);
    const activeIndex = activeTier ? tiers.indexOf(activeTier) : -1;
    const startingPrice = catalogCardStartingPrice(variant, tiers, groupStartingPrice);
    const sku = variant?.websiteSku ?? variant?.graceSku ?? null;
    const eventBase = { productId, sku, quantity: qty ?? 0, tier: catalogTierLabel(activeTier) };

    const openTiers = () => {
        const dialog = dialogRef.current;
        if (!dialog || dialog.open) return;
        dialog.showModal();
        setTiersOpen(true);
        analytics.catalogTierPricingToggled({ open: true, ...eventBase });
        tierRefs.current[Math.max(activeIndex, 0)]?.focus({ preventScroll: true });
    };

    const closeTiers = () => {
        const dialog = dialogRef.current;
        if (dialog?.open) dialog.close();
    };

    // Fires for the close button, Esc, backdrop clicks, and a successful add.
    const handleDialogClose = () => {
        setTiersOpen(false);
        analytics.catalogTierPricingToggled({ open: false, ...eventBase });
        triggerRef.current?.focus({ preventScroll: true });
    };

    const onDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
        if (event.target === event.currentTarget) closeTiers();
    };

    const commitQuantity = (next: number, source: "stepper" | "input" | "tier") => {
        const clamped = Math.min(Math.max(1, Math.round(next)), CATALOG_QUANTITY_MAX);
        setQtyText(String(clamped));
        if (clamped === committedQty.current) return;
        committedQty.current = clamped;
        const tier = catalogTierLabel(activeCatalogTier(tiers, clamped));
        if (source === "tier") analytics.catalogTierSelected({ productId, sku, quantity: clamped, tier });
        else analytics.catalogQuantityChanged({ productId, sku, quantity: clamped, tier, source });
    };

    const selectTier = (tier: DisplayVolumeTier) => {
        if (tier === activeTier) return;
        commitQuantity(tier.minQty, "tier");
    };

    const onTierKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        let nextIndex: number | null = null;
        if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = Math.min(tiers.length - 1, activeIndex + 1);
        else if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = Math.max(0, activeIndex - 1);
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = tiers.length - 1;
        if (nextIndex == null || !tiers[nextIndex]) return;
        event.preventDefault();
        selectTier(tiers[nextIndex]);
        tierRefs.current[nextIndex]?.focus();
    };

    const handleAdd = () => {
        analytics.catalogQuickAdd({ stage: "clicked", ...eventBase });
        if (!isCatalogVariantPurchasable(variant) || qty == null) {
            analytics.catalogQuickAdd({ stage: "error", ...eventBase, error: error ?? "not-purchasable" });
            return;
        }
        try {
            addItems([buildCatalogCartItem(variant, qty, { ...context, title, productGroupSlug: productId })]);
            analytics.cartItemAdded({
                sku: variant.graceSku,
                name: title,
                quantity: qty,
                unitPrice: variant.webPrice1pc,
                family: context.family ?? undefined,
                capacity: context.capacity ?? undefined,
                source: "catalog",
            });
            analytics.catalogQuickAdd({ stage: "success", ...eventBase });
            setAdded(qty);
            if (addedTimer.current != null) window.clearTimeout(addedTimer.current);
            addedTimer.current = window.setTimeout(() => setAdded(null), 4000);
            closeTiers();
        } catch (caught) {
            analytics.catalogQuickAdd({ stage: "error", ...eventBase, error: caught instanceof Error ? caught.message : "unknown" });
        }
    };

    if (!variant || variant.webPrice1pc == null || variant.webPrice1pc <= 0) {
        return (
            <div className="border-t border-champagne/55 px-4 pb-5 pt-4 sm:px-5" data-testid="catalog-card-purchase" data-state="unpriced">
                <p className="text-lg font-semibold text-obsidian" data-testid="catalog-card-price">
                    {groupStartingPrice != null
                        ? <>From {usd.format(groupStartingPrice)}<span className="text-sm font-normal text-slate">/ea</span></>
                        : "Request pricing"}
                </p>
                <Link href={href} className={`mt-2 inline-flex min-h-11 items-center text-xs font-semibold uppercase tracking-wider text-obsidian underline-offset-4 hover:underline sm:min-h-9 ${FOCUS_RING}`}>
                    View options
                </Link>
            </div>
        );
    }

    const p1 = tiers[0]?.unitPrice ?? variant.webPrice1pc;
    const activeUnitPrice = activeTier?.unitPrice ?? variant.webPrice1pc;
    const firstQuoteTier = tiers.find((tier) => !tier.appliesAtCheckout) ?? null;
    const nextTier = activeIndex >= 0 ? tiers[activeIndex + 1] : undefined;
    const unitsToNext = nextTier && qty != null ? nextTier.minQty - qty : 0;
    const footnote = firstQuoteTier
        ? `Online checkout bills ${usd.format(p1)}/ea. ${firstQuoteTier.minQty.toLocaleString("en-US")}+ rates are confirmed on a quote.`
        : nextTier && unitsToNext > 0 && unitsToNext <= 11
            ? `Add ${unitsToNext} more to unlock ${usd.format(nextTier.unitPrice)}/ea · save ${nextTier.savePct}%.`
            : "Save more at higher quantities.";
    const quoteHref = `/request-quote?products=${encodeURIComponent(`${title} (SKU: ${variant.graceSku})`)}&quantities=${encodeURIComponent(`${qty ?? 1} units`)}`;

    // Render helpers (not nested components) so the card and dialog share one
    // quantity without remounting inputs on every keystroke.
    const renderStepper = (scope: Scope) => {
        const qtyId = scopedId(scope, "qty");
        return (
            <div className="flex shrink-0 items-stretch rounded-sm border border-champagne bg-white" role="group" aria-label="Quantity">
                <label htmlFor={qtyId} className="sr-only">Quantity</label>
                <button
                    type="button"
                    className={STEP_BUTTON}
                    onClick={() => commitQuantity((qty ?? 1) - 1, "stepper")}
                    disabled={qty != null && qty <= 1}
                    aria-label="Decrease quantity"
                >
                    <Minus className="h-3.5 w-3.5" aria-hidden />
                </button>
                <input
                    id={qtyId}
                    data-testid={scope === "card" ? "catalog-card-qty" : "catalog-card-dialog-qty"}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    value={qtyText}
                    onChange={(event) => setQtyText(event.target.value)}
                    onFocus={(event) => event.currentTarget.select()}
                    onBlur={() => { if (qty != null) commitQuantity(qty, "input"); }}
                    onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        if (qty != null) commitQuantity(qty, "input");
                    }}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={scopedId(scope, error ? "error" : "live")}
                    className="w-14 min-w-0 border-x border-champagne bg-transparent text-center text-sm font-medium tabular-nums text-obsidian focus:outline-none focus-visible:bg-bone/70 [appearance:textfield]"
                />
                <button
                    type="button"
                    className={STEP_BUTTON}
                    onClick={() => commitQuantity((qty ?? 0) + 1, "stepper")}
                    aria-label="Increase quantity"
                >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                </button>
            </div>
        );
    };

    const renderLiveLine = (scope: Scope) => (
        <div className="min-w-0 flex-1 self-center text-[11px] leading-snug text-slate">
            {error ? (
                <p id={scopedId(scope, "error")} role="alert" className="font-medium text-red-700" data-testid="catalog-card-qty-error">
                    {error}
                </p>
            ) : (
                <p id={scopedId(scope, "live")} aria-live="polite" className="tabular-nums" data-testid="catalog-card-active-tier">
                    <span className="block">
                        <span className="text-sm font-semibold text-obsidian">{usd.format(activeUnitPrice)}</span>
                        /ea{activeTier && <> · {formatVolumeQtyRange(activeTier.minQty, activeTier.maxQty)}</>}
                    </span>
                    <span className="block">
                        {activeTier && activeTier.savePct > 0 && (
                            <><span className="font-semibold text-emerald-800">Save {activeTier.savePct}%</span> · </>
                        )}
                        <span className="whitespace-nowrap" data-testid="catalog-card-subtotal">
                            Subtotal <span className="font-semibold text-obsidian">{usd.format((qty ?? 0) * activeUnitPrice)}</span>
                        </span>
                    </span>
                </p>
            )}
        </div>
    );

    const renderAddButton = (scope: Scope) => purchasable ? (
        <button
            type="button"
            data-testid={scope === "card" ? "catalog-card-add" : "catalog-card-dialog-add"}
            onClick={handleAdd}
            disabled={qty == null}
            className={PRIMARY_BUTTON}
            aria-label={`Add ${qty ?? ""} ${title} to cart`.replace(/\s+/g, " ")}
        >
            {added != null ? <><Check className="h-3.5 w-3.5" aria-hidden />Added</> : "Add to cart"}
        </button>
    ) : (
        <Link href={quoteHref} data-testid={scope === "card" ? "catalog-card-quote" : "catalog-card-dialog-quote"} className={SECONDARY_BUTTON}>
            Request quote
        </Link>
    );

    return (
        <div
            className="border-t border-champagne/55 px-4 pb-4 pt-3 sm:px-5"
            data-testid="catalog-card-purchase"
            data-state={purchasable ? "purchasable" : "quote"}
        >
            <p className="text-lg font-semibold text-obsidian" data-testid="catalog-card-price">
                From {usd.format(startingPrice ?? variant.webPrice1pc)}
                <span className="text-sm font-normal text-slate">/ea</span>
            </p>
            {variant.optionLabel && (
                <p className="mt-0.5 text-[11px] text-slate">
                    Adds <span className="text-obsidian">{variant.optionLabel}</span>
                </p>
            )}

            {/* Quantity → rate → tier pricing → add, top-down on every width. */}
            <div className="mt-3 flex items-start gap-3">
                {renderStepper("card")}
                {renderLiveLine("card")}
            </div>

            {tiers.length > 0 && (
                <>
                    <button
                        ref={triggerRef}
                        type="button"
                        data-testid="catalog-card-tier-toggle"
                        aria-haspopup="dialog"
                        aria-expanded={tiersOpen}
                        aria-controls={dialogId}
                        onClick={openTiers}
                        className={`mt-1 flex min-h-11 w-full items-center justify-between gap-2 text-xs font-semibold text-obsidian transition-colors motion-reduce:transition-none hover:text-muted-gold sm:min-h-9 ${FOCUS_RING}`}
                    >
                        <span>View tier pricing</span>
                        <Plus weight="thin" className="h-4 w-4 shrink-0" aria-hidden />
                    </button>
                    <dialog
                        ref={dialogRef}
                        id={dialogId}
                        data-testid="catalog-card-tier-dialog"
                        aria-labelledby={titleId}
                        onClose={handleDialogClose}
                        onClick={onDialogClick}
                        className="m-auto w-[min(26rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-sm border border-champagne bg-white p-0 text-obsidian shadow-2xl backdrop:bg-obsidian/45"
                    >
                        <div className="p-4 sm:p-5">
                            <div className="flex items-start gap-3">
                                {imageUrl && (
                                    <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-[#f0ebe3]">
                                        <Image src={imageUrl} alt="" fill sizes="64px" unoptimized className="object-contain" />
                                    </span>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate">Tier pricing</p>
                                    <h3 id={titleId} className="mt-0.5 text-base font-medium leading-snug text-obsidian">{title}</h3>
                                    {variant.optionLabel && (
                                        <p className="mt-0.5 text-[11px] text-slate">Adds <span className="text-obsidian">{variant.optionLabel}</span></p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={closeTiers}
                                    aria-label="Close tier pricing"
                                    data-testid="catalog-card-tier-close"
                                    className={`-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center text-slate hover:text-obsidian sm:h-9 sm:w-9 ${FOCUS_RING}`}
                                >
                                    <X className="h-4 w-4" aria-hidden />
                                </button>
                            </div>

                            <div className="mt-4 flex items-start gap-3">
                                {renderStepper("dialog")}
                                {renderLiveLine("dialog")}
                            </div>

                            <div className="mt-3 rounded-sm border border-champagne/60 bg-travertine/50 p-2">
                                <div
                                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate"
                                    aria-hidden
                                >
                                    <span>Quantity</span>
                                    <span className="text-right">Price (ea)</span>
                                    <span className="text-right">You save</span>
                                </div>
                                <div
                                    role="radiogroup"
                                    aria-label={`Pricing tiers for ${title}`}
                                    onKeyDown={onTierKeyDown}
                                    className="divide-y divide-champagne/40"
                                >
                                    {tiers.map((tier, index) => {
                                        const active = index === activeIndex;
                                        return (
                                            <button
                                                key={tier.minQty}
                                                ref={(element) => { tierRefs.current[index] = element; }}
                                                type="button"
                                                role="radio"
                                                aria-checked={active}
                                                aria-label={describeCatalogTier(tier)}
                                                tabIndex={active || (activeIndex < 0 && index === 0) ? 0 : -1}
                                                onClick={() => selectTier(tier)}
                                                data-testid="catalog-card-tier-row"
                                                data-tier-min={tier.minQty}
                                                data-tier-active={active ? "true" : "false"}
                                                className={`grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-2 text-left text-sm transition-colors motion-reduce:transition-none hover:bg-white sm:min-h-10 ${FOCUS_RING} focus-visible:outline-offset-[-2px] ${active ? "bg-white font-semibold text-obsidian" : "text-obsidian"}`}
                                            >
                                                <span className="flex min-w-0 items-center gap-2">
                                                    <span
                                                        aria-hidden
                                                        className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${active ? "border-muted-gold" : "border-champagne"}`}
                                                    >
                                                        {active && <span className="h-2 w-2 rounded-full bg-muted-gold" />}
                                                    </span>
                                                    <span className="tabular-nums">{formatVolumeQtyRange(tier.minQty, tier.maxQty)}</span>
                                                </span>
                                                <span className="text-right tabular-nums">{usd.format(tier.unitPrice)}</span>
                                                <span className={`text-right text-xs tabular-nums ${tier.savePct > 0 ? "text-emerald-800" : "text-slate"}`}>
                                                    {tier.savePct > 0 ? `${tier.savePct}%` : "—"}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="mt-2 px-2 text-[11px] leading-relaxed text-slate" data-testid="catalog-card-tier-footnote">
                                    {footnote}
                                </p>
                            </div>

                            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                {renderAddButton("dialog")}
                                <button type="button" onClick={closeTiers} className={`${SECONDARY_BUTTON} sm:w-auto sm:px-6`}>
                                    Done
                                </button>
                            </div>
                        </div>
                    </dialog>
                </>
            )}

            <div className="mt-2">{renderAddButton("card")}</div>

            {added != null && (
                <p role="status" className="mt-1.5 flex items-center gap-2 text-[11px] text-obsidian" data-testid="catalog-card-added">
                    <span>Added {added.toLocaleString("en-US")} to your cart.</span>
                    <button
                        type="button"
                        onClick={() => window.dispatchEvent(new Event("open-cart-drawer"))}
                        className={`min-h-11 font-semibold underline underline-offset-2 sm:min-h-0 ${FOCUS_RING}`}
                    >
                        View cart
                    </button>
                </p>
            )}
        </div>
    );
}
