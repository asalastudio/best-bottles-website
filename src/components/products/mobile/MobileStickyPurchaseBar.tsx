"use client";

/**
 * The compact sticky Add to Cart bar for the mobile PDP (PRD §6–8). It renders
 * the same resolved variant, price, case quantity, and availability the
 * configurator drives — no state of its own — so a swap in any picker is
 * reflected here on the next paint. Slides up and fades in over ~180 ms, sits
 * on the safe-area inset, and is inert while hidden so it never traps focus or
 * taps behind the page.
 */
import Link from "next/link";
import type { RefObject } from "react";
import { Check, ShoppingBag } from "@/components/icons";
import { STICKY_CTA_ANIMATION_MS, stickyCtaFacts } from "@/lib/products/mobile-pdp-sticky-cta";

export type MobileStickyPurchaseBarProps = {
    visible: boolean;
    barRef?: RefObject<HTMLDivElement | null>;
    title: string;
    thumbUrl: string | null;
    priceEach: number | null;
    caseQuantity: number | null;
    qty: number;
    inStock: boolean;
    canAddToCart: boolean;
    addedFlash: boolean;
    quoteHref: string;
    onAddToCart: () => void;
};

export default function MobileStickyPurchaseBar({
    visible, barRef, title, thumbUrl, priceEach, caseQuantity, qty, inStock, canAddToCart, addedFlash, quoteHref, onAddToCart,
}: MobileStickyPurchaseBarProps) {
    const facts = stickyCtaFacts({ priceEach, caseQuantity, qty });
    const cta = "flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-[3px] px-4 text-xs font-bold uppercase tracking-widest transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold";
    return (
        <div
            ref={barRef}
            data-testid="mobile-pdp-sticky-cta"
            data-visible={visible ? "true" : "false"}
            role="region"
            aria-label="Add to cart"
            aria-hidden={!visible}
            inert={!visible}
            className="fixed inset-x-0 bottom-0 z-[60] border-t border-champagne bg-white/95 shadow-[0_-6px_24px_rgba(29,29,31,.10)] backdrop-blur-md will-change-transform motion-reduce:transition-none"
            style={{
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
                transform: visible ? "translateY(0)" : "translateY(100%)",
                opacity: visible ? 1 : 0,
                pointerEvents: visible ? "auto" : "none",
                transitionProperty: "transform, opacity",
                transitionDuration: `${STICKY_CTA_ANIMATION_MS}ms`,
                transitionTimingFunction: "cubic-bezier(.4,0,.2,1)",
            }}
        >
            <div className="flex h-[68px] items-center gap-3 px-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-white ring-1 ring-champagne/70">
                    {thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbUrl} alt="" decoding="async" className="h-full w-full object-contain" />
                    ) : (
                        <ShoppingBag className="h-5 w-5 text-champagne" aria-hidden />
                    )}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-obsidian" data-testid="mobile-pdp-sticky-title">{title}</span>
                    <span className="block truncate text-xs tabular-nums text-slate" data-testid="mobile-pdp-sticky-facts">{facts}</span>
                </span>
                {qty >= 500 ? (
                    <Link href={quoteHref} data-testid="mobile-pdp-request-quote" className={`${cta} bg-obsidian text-white hover:bg-muted-gold`}>
                        Request Quote
                    </Link>
                ) : canAddToCart ? (
                    <button
                        type="button"
                        disabled={!canAddToCart || addedFlash}
                        onClick={onAddToCart}
                        data-testid="mobile-pdp-add-to-cart"
                        className={`${cta} disabled:cursor-not-allowed ${addedFlash ? "bg-emerald-600 text-white" : "bg-obsidian text-white hover:bg-muted-gold disabled:opacity-40"}`}
                    >
                        {addedFlash ? (<><Check className="h-4 w-4" weight="bold" aria-hidden /><span>Added</span></>)
                            : (<><ShoppingBag className="h-4 w-4" aria-hidden /><span>{inStock ? "Add to Cart" : "Out of Stock"}</span></>)}
                    </button>
                ) : (
                    <Link href={quoteHref} data-testid="mobile-pdp-request-quote" className={`${cta} bg-obsidian text-white hover:bg-muted-gold`}>
                        Request Quote
                    </Link>
                )}
            </div>
        </div>
    );
}
