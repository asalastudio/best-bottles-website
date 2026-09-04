"use client";

/**
 * The permanent product workspace at the top of the mobile PDP. The back/cart
 * bar is a real row above the plate — not an overlay — so the bottle cap is
 * never tucked under the browser chrome or the controls. Padding tracks
 * `visualViewport.offsetTop` so iOS Safari's overlay URL bar cannot cover the
 * cap. The plate box keeps a fixed 10:11 ratio so a layer swap or picker
 * opening never moves it.
 *
 * The stage always paints the currently configured bottle. Its only control is
 * View Larger (PRD §3); Cap On / Cap Off and Dimensions live in the expanded
 * viewer and the details disclosures respectively.
 */
import Link from "next/link";
import { forwardRef, useLayoutEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, ArrowsOutSimple, ShoppingBag } from "@/components/icons";
import PaperDollLayers, { type KitPart } from "@/components/products/PaperDollLayers";
import { mobilePdpToolbarPaddingTop } from "@/lib/products/mobile-pdp-chrome";

type MobileProductHeroProps = {
    plateUrl: string | null;
    kitParts: KitPart[] | null;
    /** Catalogue photograph shown only when no plate can be painted. */
    fallbackImageUrl: string | null;
    alt: string;
    backHref: string;
    cartCount: number;
    onOpenCart: () => void;
    onPlateError?: (url: string) => void;
    /** Opens the full-screen expanded viewer. Hidden when nothing can be shown. */
    onViewLarger?: () => void;
    /** Live-preview badge while a picker is open. */
    overlay?: ReactNode;
};

const MobileProductHero = forwardRef<HTMLDivElement, MobileProductHeroProps>(function MobileProductHero(
    { plateUrl, kitParts, fallbackImageUrl, alt, backHref, cartCount, onOpenCart, onPlateError, onViewLarger, overlay },
    ref,
) {
    const hasStack = Boolean(plateUrl || kitParts?.length);
    const hasVisual = hasStack || Boolean(fallbackImageUrl);
    const toolbarRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const el = toolbarRef.current;
        const viewport = window.visualViewport;
        if (!el) return;
        const sync = () => {
            el.style.paddingTop = mobilePdpToolbarPaddingTop(viewport?.offsetTop ?? 0);
        };
        sync();
        viewport?.addEventListener("resize", sync);
        viewport?.addEventListener("scroll", sync);
        return () => {
            viewport?.removeEventListener("resize", sync);
            viewport?.removeEventListener("scroll", sync);
        };
    }, []);
    return (
        <div ref={ref} data-testid="mobile-pdp-hero" className="relative w-full bg-white">
            <div
                ref={toolbarRef}
                data-testid="mobile-pdp-hero-toolbar"
                className="sticky top-0 z-20 flex items-center justify-between border-b border-champagne/60 bg-white px-2 pb-1"
                style={{ paddingTop: mobilePdpToolbarPaddingTop(0) }}
            >
                <Link
                    href={backHref}
                    aria-label="Back to catalog"
                    data-testid="mobile-pdp-back"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-bone text-obsidian transition-colors hover:bg-linen focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold"
                >
                    <ArrowLeft className="h-5 w-5" weight="regular" aria-hidden />
                </Link>
                <button
                    type="button"
                    onClick={onOpenCart}
                    aria-label={cartCount > 0 ? `Open cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}` : "Open cart"}
                    data-testid="mobile-pdp-cart"
                    className="relative flex h-11 w-11 items-center justify-center rounded-full bg-bone text-obsidian transition-colors hover:bg-linen focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold"
                >
                    <ShoppingBag className="h-5 w-5" weight="regular" aria-hidden />
                    {cartCount > 0 ? (
                        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-obsidian px-1 text-[10px] font-bold text-white">
                            {cartCount > 99 ? "99+" : cartCount}
                        </span>
                    ) : null}
                </button>
            </div>
            <div
                data-testid="mobile-pdp-stage"
                className="relative mx-auto overflow-hidden"
                style={{ aspectRatio: "10 / 11", width: "min(100%, calc(42svh * 10 / 11))" }}
            >
                {hasStack ? (
                    <PaperDollLayers plateUrl={plateUrl} kitParts={kitParts} alt={alt} onPlateError={onPlateError} />
                ) : fallbackImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fallbackImageUrl} alt={alt} className="absolute inset-0 h-full w-full object-contain object-center" />
                ) : (
                    <div className="absolute inset-0 bg-linen" aria-hidden />
                )}
                {overlay}
            </div>
            {onViewLarger && hasVisual ? (
                <div className="flex justify-center px-4 pb-3 pt-1">
                    <button
                        type="button"
                        onClick={onViewLarger}
                        aria-haspopup="dialog"
                        data-testid="mobile-pdp-view-larger"
                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-champagne bg-white px-4 text-xs font-semibold text-obsidian shadow-[0_1px_2px_rgba(29,29,31,.06)] transition-colors hover:border-muted-gold hover:bg-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold"
                    >
                        <ArrowsOutSimple className="h-4 w-4" aria-hidden />
                        View Larger
                    </button>
                </div>
            ) : null}
        </div>
    );
});

export default MobileProductHero;
