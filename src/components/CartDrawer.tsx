"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { X, ShoppingBag, Plus, Minus, Trash, ArrowRight, WarningCircle } from "@/components/icons";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/components/CartProvider";
import { useGrace } from "@/components/useGrace";
import { isCheckoutReady, splitCheckoutItems } from "@/lib/checkout";

const FREE_SHIPPING_THRESHOLD = 99;

interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
    const { items, itemCount, removeItem, updateQuantity, checkout, isCheckingOut, checkoutError, isCartHydrated } = useCart();
    const { openPanel: openGracePanel } = useGrace();
    const drawerRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === "Escape") {
                onClose();
                return;
            }
            if (e.key !== "Tab") return;
            const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
            );
            if (!focusable || focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [isOpen, onClose]);

    useEffect(() => {
        document.body.style.overflow = isOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            previousFocusRef.current?.focus?.();
            previousFocusRef.current = null;
            return;
        }
        previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !drawerRef.current?.parentElement) return;
        const parent = drawerRef.current.parentElement;
        const siblings = Array.from(parent.children).filter((element) =>
            element !== drawerRef.current && element.getAttribute("data-cart-overlay") !== "true"
        );
        const previous = siblings.map((element) => ({
            element,
            ariaHidden: element.getAttribute("aria-hidden"),
            inert: element instanceof HTMLElement ? element.inert : false,
        }));
        for (const element of siblings) {
            element.setAttribute("aria-hidden", "true");
            if (element instanceof HTMLElement) element.inert = true;
        }
        return () => {
            for (const entry of previous) {
                if (entry.ariaHidden === null) entry.element.removeAttribute("aria-hidden");
                else entry.element.setAttribute("aria-hidden", entry.ariaHidden);
                if (entry.element instanceof HTMLElement) entry.element.inert = entry.inert;
            }
        };
    }, [isOpen]);

    const subtotal = items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0);
    const { checkoutReadyItems, quoteOnlyItems } = splitCheckoutItems(items);
    const progressPercent = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
    const amountToFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);
    const persistQuoteDraft = () => {
        try {
            sessionStorage.setItem("bb-rfq-line-items", JSON.stringify(items.map((item) => ({
                sku: item.graceSku,
                websiteSku: item.websiteSku ?? undefined,
                variantId: item.variantId ?? item.shopifyVariantId ?? undefined,
                productGroupSlug: item.productGroupSlug ?? undefined,
                name: item.itemName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                family: item.family,
                capacity: item.capacity,
                color: item.color,
                applicator: item.applicator ?? null,
                capColor: item.capColor ?? null,
                neckThreadSize: item.neckThreadSize ?? null,
            }))));
        } catch {
            // Session storage is an enhancement; the query-string fallback below still works.
        }
    };
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        key="cart-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        onClick={onClose}
                        className="fixed left-0 right-0 top-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-[70] lg:inset-0"
                        style={{
                            background: "rgba(29, 29, 31, 0.45)",
                            backdropFilter: "blur(4px)",
                        }}
                        aria-hidden="true"
                        data-cart-overlay="true"
                    />

                    <motion.div
                        key="cart-drawer"
                        ref={drawerRef}
                        initial={{ x: "100%", opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "100%", opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 35 }}
                        className="fixed top-0 right-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-[70] w-full max-w-[560px] flex flex-col lg:bottom-0"
                        style={{
                            background: "rgba(250, 248, 245, 0.95)",
                            backdropFilter: "blur(28px) saturate(180%)",
                            WebkitBackdropFilter: "blur(28px) saturate(180%)",
                            borderLeft: "1px solid rgba(212, 197, 169, 0.4)",
                            boxShadow: "-24px 0 80px rgba(29, 29, 31, 0.18), -2px 0 0 rgba(255,255,255,0.6) inset",
                        }}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Shopping cart"
                        aria-describedby="cart-drawer-status"
                        data-testid="cart-drawer"
                    >
                        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
                            <div className="absolute inset-0 liquid-shimmer" style={{ opacity: 0.4 }} />
                            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)" }} />
                        </div>

                        {/* Header */}
                        <div
                            className="relative flex items-center justify-between px-6 py-5 shrink-0"
                            style={{ borderBottom: "1px solid rgba(212, 197, 169, 0.35)" }}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-9 h-9 rounded-full flex items-center justify-center bg-white"
                                    style={{
                                        border: "1px solid rgba(197, 160, 101, 0.3)",
                                        boxShadow: "0 2px 8px rgba(197, 160, 101, 0.15)",
                                    }}
                                >
                                    <ShoppingBag className="text-muted-gold" size={16} />
                                </div>
                                <div>
                                    <h2 className="font-serif text-[17px] font-medium text-obsidian tracking-wide">Your Cart</h2>
                                    <p className="font-sans text-[11px] text-slate mt-0.5 tracking-wider uppercase">{itemCount} items</p>
                                </div>
                            </div>
                            <button
                                ref={closeButtonRef}
                                onClick={onClose}
                                className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer hover:bg-black/5"
                                style={{ border: "1px solid rgba(29, 29, 31, 0.08)" }}
                                aria-label="Close cart"
                            >
                                <X className="text-obsidian/70" size={16} />
                            </button>
                        </div>

                        {/* Progress Bar */}
                        {items.length > 0 && (
                            <div className="relative px-6 py-3 shrink-0 bg-white/40 border-b border-champagne/30">
                                <p className="font-sans text-[12px] text-obsidian font-medium mb-2">
                                    {amountToFreeShipping === 0
                                        ? "You've unlocked Free Shipping!"
                                        : `$${amountToFreeShipping.toFixed(2)} away from Free Shipping`}
                                </p>
                                <div className="h-1.5 w-full bg-champagne/30 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-muted-gold"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progressPercent}%` }}
                                        transition={{ duration: 0.5, ease: "easeOut" }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Items */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                            {!isCartHydrated ? (
                                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                                    <ShoppingBag className="text-champagne mb-4" size={48} />
                                    <p className="font-serif text-lg text-obsidian/60 mb-2">Loading your cart</p>
                                    <p className="text-sm text-slate">Checking saved cart items on this device.</p>
                                </div>
                            ) : items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                                    <ShoppingBag className="text-champagne mb-4" size={48} />
                                    <p className="font-serif text-lg text-obsidian/60 mb-2">Your cart is empty</p>
                                    <p className="text-sm text-slate">Browse our catalog or ask Grace, your AI Bottling Specialist, to find the right bottle and fitment.</p>
                                </div>
                            ) : (
                                items.map((item, i) => {
                                    const p1 = item.webPrice1pc ?? item.unitPrice ?? 0;
                                    const p10 = item.webPrice10pc ?? null;
                                    const p12 = item.webPrice12pc ?? null;

                                    let nudge = null;
                                    if (p1 > 0) {
                                        if (p12 != null && item.quantity < 12 && (p10 == null || item.quantity >= 10)) {
                                            const unitsToNext = 12 - item.quantity;
                                            const pct = Math.round((1 - p12 / p1) * 100);
                                            if (pct > 0) {
                                                nudge = {
                                                    units: unitsToNext,
                                                    targetQty: 12,
                                                    price: p12,
                                                    savePct: pct,
                                                };
                                            }
                                        } else if (p10 != null && item.quantity < 10) {
                                            const unitsToNext = 10 - item.quantity;
                                            const pct = Math.round((1 - p10 / p1) * 100);
                                            if (pct > 0) {
                                                nudge = {
                                                    units: unitsToNext,
                                                    targetQty: 10,
                                                    price: p10,
                                                    savePct: pct,
                                                };
                                            }
                                        }
                                    }

                                    return (
                                        <motion.div
                                            key={item.graceSku}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ delay: i * 0.04 }}
                                            className="group relative flex flex-col p-3 rounded-xl bg-white/70"
                                            style={{ border: "1px solid rgba(212, 197, 169, 0.3)" }}
                                        >
                                            <div className="flex gap-3">
                                                <div className="w-16 h-16 rounded-xl shrink-0 flex items-center justify-center bg-bone/80 border border-champagne/40">
                                                    <ShoppingBag className="text-champagne" size={24} />
                                                </div>

                                                <div className="flex-1 min-w-0 pr-6">
                                                    <p className="text-[14px] font-medium text-obsidian leading-snug line-clamp-2 mb-0.5">
                                                        {item.itemName}
                                                    </p>
                                                    <div className="text-[12px] text-slate mb-2 space-y-0.5">
                                                        <p>{[item.family, item.capacity, item.color].filter(Boolean).join(" · ") || "Product details pending"}</p>
                                                        {(item.applicator || item.capColor || item.neckThreadSize) && (
                                                            <p>{[item.applicator, item.capColor, item.neckThreadSize ? `Thread: ${item.neckThreadSize}` : null].filter(Boolean).join(" · ")}</p>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-slate/70 font-mono uppercase tracking-wide mb-2">
                                                        SKU {item.graceSku}
                                                    </p>
                                                    {!isCheckoutReady(item) && (
                                                        <p className="mb-2 inline-flex rounded-sm border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                                                            Quote required
                                                        </p>
                                                    )}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1 rounded-md overflow-hidden bg-bone/50 border border-champagne/50">
                                                            <button
                                                                onClick={() => updateQuantity(item.graceSku, item.quantity - 1)}
                                                                className="w-11 h-11 flex items-center justify-center text-obsidian/60 hover:text-obsidian hover:bg-white transition-colors cursor-pointer"
                                                                aria-label="Decrease quantity"
                                                            >
                                                                <Minus size={12} />
                                                            </button>
                                                            <span className="text-[12px] font-medium text-obsidian min-w-[20px] text-center">
                                                                {item.quantity}
                                                            </span>
                                                            <button
                                                                onClick={() => updateQuantity(item.graceSku, item.quantity + 1)}
                                                                className="w-11 h-11 flex items-center justify-center text-obsidian/60 hover:text-obsidian hover:bg-white transition-colors cursor-pointer"
                                                                aria-label="Increase quantity"
                                                            >
                                                                <Plus size={12} />
                                                            </button>
                                                        </div>
                                                        <div className="text-right">
                                                            {item.unitPrice != null ? (
                                                                <>
                                                                    <p className="text-[11px] text-slate">${item.unitPrice.toFixed(2)} ea</p>
                                                                    <p className="text-[14px] font-medium text-obsidian">
                                                                        ${(item.unitPrice * item.quantity).toFixed(2)}
                                                                    </p>
                                                                </>
                                                            ) : (
                                                                <p className="text-[12px] font-medium text-slate">Quote pricing</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {nudge && (
                                                <div className="mt-3 p-2 bg-muted-gold/10 border border-muted-gold/20 rounded-lg flex items-center justify-between gap-2">
                                                    <p className="text-[11px] text-obsidian/85 leading-normal">
                                                        Add <span className="font-semibold text-muted-gold">{nudge.units} more</span> to unlock <span className="font-semibold">{nudge.targetQty}+ pricing</span> at <span className="font-semibold">${nudge.price.toFixed(2)}/ea</span> (Save <span className="font-semibold text-emerald-700">{nudge.savePct}%</span>!)
                                                    </p>
                                                    <button
                                                        onClick={() => updateQuantity(item.graceSku, nudge.targetQty)}
                                                        className="shrink-0 px-2 py-1 bg-muted-gold hover:bg-obsidian text-white text-[9px] uppercase font-bold tracking-wider rounded transition-colors cursor-pointer"
                                                    >
                                                        + Add {nudge.units}
                                                    </button>
                                                </div>
                                            )}

                                            <button
                                                onClick={() => removeItem(item.graceSku)}
                                                className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer rounded-full hover:bg-red-50"
                                                aria-label="Remove item"
                                            >
                                                <Trash className="text-slate hover:text-red-500 transition-colors" size={14} />
                                            </button>
                                        </motion.div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        {items.length > 0 && (
                            <div
                                className="shrink-0 px-6 py-5 bg-white border-t border-champagne/30"
                            >
                                {checkoutError && (
                                    <div role="alert" className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                                        <div className="flex items-start gap-2">
                                            <WarningCircle className="shrink-0 mt-0.5" size={14} />
                                            <div className="flex-1">
                                                <p>{checkoutError}</p>
                                                <button
                                                    onClick={onClose}
                                                    className="mt-1.5 text-[11px] font-semibold text-obsidian underline underline-offset-2 hover:text-muted-gold transition-colors"
                                                >
                                                    Continue browsing
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-[14px] text-slate font-sans uppercase tracking-widest text-xs">Total</span>
                                    <span className="font-serif text-2xl font-medium text-obsidian">${subtotal.toFixed(2)}</span>
                                </div>

                                <button
                                    onClick={checkout}
                                    disabled={isCheckingOut}
                                    data-testid="checkout-start-button"
                                    className="group w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-medium text-[14px] tracking-wide transition-all duration-300 cursor-pointer relative overflow-hidden bg-obsidian text-bone hover:bg-obsidian/90 disabled:opacity-50"
                                    style={{ boxShadow: "0 4px 20px rgba(29,29,31,0.15)" }}
                                >
                                    <span className="absolute inset-0 liquid-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500" aria-hidden="true" />
                                    <span className="relative">{isCheckingOut ? "Preparing Checkout…" : "Proceed to Checkout"}</span>
                                    <ArrowRight className="relative transition-transform duration-300 group-hover:translate-x-0.5" size={16} />
                                </button>

                                <Link
                                    href={`/request-quote?products=${encodeURIComponent(items.map(i => `${i.itemName} (x${i.quantity})`).join(', '))}`}
                                    onClick={() => {
                                        persistQuoteDraft();
                                        onClose();
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-3 mt-2 border border-obsidian text-obsidian text-[13px] font-medium tracking-wide rounded-xl hover:bg-obsidian hover:text-bone transition-all duration-300"
                                >
                                    Request Quote for This Order
                                </Link>

                                {items.some((item) => item.neckThreadSize || (item.compatibleCount ?? 0) > 0) && (
                                    <div className="mt-3 rounded-lg border border-muted-gold/30 bg-muted-gold/10 px-3 py-2.5">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-gold">
                                            Complete the set
                                        </p>
                                        <p className="mt-1 text-[12px] leading-relaxed text-obsidian/75">
                                            {(() => {
                                                const item = items.find((cartItem) => cartItem.neckThreadSize || (cartItem.compatibleCount ?? 0) > 0);
                                                const thread = item?.neckThreadSize;
                                                if (thread) {
                                                    return `Match ${thread} caps, droppers, rollers, sprayers, or reducers before checkout.`;
                                                }
                                                return "Review compatible caps, droppers, rollers, sprayers, or reducers before checkout.";
                                            })()}
                                        </p>
                                        <Link
                                            href={`/catalog?category=Component${items.find((item) => item.neckThreadSize)?.neckThreadSize ? `&search=${encodeURIComponent(items.find((item) => item.neckThreadSize)!.neckThreadSize!)}` : ""}`}
                                            onClick={onClose}
                                            className="mt-2 inline-flex text-[12px] font-semibold text-obsidian underline underline-offset-4 hover:text-muted-gold"
                                        >
                                            Find compatible components
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onClose();
                                                openGracePanel();
                                            }}
                                            className="ml-3 mt-2 inline-flex text-[12px] font-semibold text-muted-gold underline underline-offset-4 hover:text-obsidian"
                                        >
                                            Ask Grace to check
                                        </button>
                                    </div>
                                )}

                                <p id="cart-drawer-status" aria-live="polite" className="text-[11px] text-slate text-center mt-3 tracking-wide">
                                    {isCheckingOut
                                        ? "Checking Shopify variants and preparing checkout."
                                        : quoteOnlyItems.length > 0
                                            ? checkoutReadyItems.length > 0
                                                ? `Shopify checkout will use ${checkoutReadyItems.length} verified item${checkoutReadyItems.length === 1 ? "" : "s"} and remove ${quoteOnlyItems.length} quote-only item${quoteOnlyItems.length === 1 ? "" : "s"}.`
                                                : "This cart needs a quote before Shopify checkout."
                                            : "Secure checkout · Terms apply"}
                                </p>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
