"use client";

/**
 * The permanent product workspace at the top of the mobile PDP. The back/cart
 * bar is a real row above the plate — not an overlay — so the bottle cap is
 * never tucked under the browser chrome or the controls. Padding tracks
 * `visualViewport.offsetTop` so iOS Safari's overlay URL bar cannot cover the
 * cap. The plate box keeps a fixed 10:11 ratio so a layer swap or picker
 * opening never moves it.
 */
import Link from "next/link";
import { forwardRef, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { ArrowLeft, ShoppingBag } from "@/components/icons";
import PaperDollLayers, { type KitPart } from "@/components/products/PaperDollLayers";
import { mobilePdpToolbarPaddingTop } from "@/lib/products/mobile-pdp-chrome";
import type { ProductViewMode } from "@/lib/products/mobile-pdp-view-modes";

export type PdpDimensions = {
    heightWithCap?: string | null;
    heightWithoutCap?: string | null;
    diameter?: string | null;
};

const subscribeToHydration = () => () => {};
const serverCartCount = () => 0;

function DimensionRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-4 border-t border-champagne/70 py-2.5 first:border-t-0">
            <dt className="text-2xs font-semibold uppercase tracking-label text-slate">{label}</dt>
            <dd className="shrink-0 whitespace-nowrap text-right font-serif text-base text-obsidian tabular-nums">{value}</dd>
        </div>
    );
}

export function PdpDimensionsPanel({ dimensions, capacity, neckSize }: { dimensions: PdpDimensions; capacity?: string | null; neckSize?: string | null }) {
    const rows = [
        dimensions.heightWithCap?.trim() ? { label: "Height with cap", value: dimensions.heightWithCap } : null,
        dimensions.heightWithoutCap?.trim() ? { label: "Height without cap", value: dimensions.heightWithoutCap } : null,
        dimensions.diameter?.trim() ? { label: "Diameter", value: dimensions.diameter } : null,
    ].filter((row): row is { label: string; value: string } => row !== null);
    return (
        <div
            className="flex h-full w-full flex-col justify-center bg-linen px-6 py-6"
            data-testid="mobile-pdp-dimensions"
        >
            <p className="text-2xs font-semibold uppercase tracking-label text-muted-gold">Dimensions</p>
            <dl className="mt-2 border-y border-champagne/70">
                {rows.map((row) => <DimensionRow key={row.label} label={row.label} value={row.value} />)}
            </dl>
            {(neckSize?.trim() || capacity?.trim()) ? (
                <p className="mt-3 text-xs text-slate">
                    {[neckSize?.trim() ? `Neck ${neckSize}` : null, capacity?.trim() ?? null].filter(Boolean).join(" · ")}
                </p>
            ) : null}
        </div>
    );
}

type MobileProductHeroProps = {
    viewMode: ProductViewMode;
    plateUrl: string | null;
    kitParts: KitPart[] | null;
    /** Catalogue photograph shown only when no plate can be painted. */
    fallbackImageUrl: string | null;
    alt: string;
    dimensions: PdpDimensions;
    capacity?: string | null;
    neckSize?: string | null;
    backHref: string;
    cartCount: number;
    onOpenCart: () => void;
    onPlateError?: (url: string) => void;
    /** Live-preview badge while a picker is open. */
    overlay?: ReactNode;
};

const MobileProductHero = forwardRef<HTMLDivElement, MobileProductHeroProps>(function MobileProductHero(
    { viewMode, plateUrl, kitParts, fallbackImageUrl, alt, dimensions, capacity, neckSize, backHref, cartCount, onOpenCart, onPlateError, overlay },
    ref,
) {
    const showDimensions = viewMode === "dimensions";
    // A parent cart can restore storage before this streamed subtree hydrates.
    // Match the server's empty badge first, then reveal the restored count.
    const visibleCartCount = useSyncExternalStore(subscribeToHydration, () => cartCount, serverCartCount);
    const hasStack = Boolean(plateUrl || kitParts?.length);
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
                    aria-label={visibleCartCount > 0 ? `Open cart, ${visibleCartCount} ${visibleCartCount === 1 ? "item" : "items"}` : "Open cart"}
                    data-testid="mobile-pdp-cart"
                    className="relative flex h-11 w-11 items-center justify-center rounded-full bg-bone text-obsidian transition-colors hover:bg-linen focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold"
                >
                    <ShoppingBag className="h-5 w-5" weight="regular" aria-hidden />
                    {visibleCartCount > 0 ? (
                        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-obsidian px-1 text-[10px] font-bold text-white">
                            {visibleCartCount > 99 ? "99+" : visibleCartCount}
                        </span>
                    ) : null}
                </button>
            </div>
            <div
                className="relative mx-auto overflow-hidden"
                style={{ aspectRatio: "10 / 11", width: "min(100%, calc(42svh * 10 / 11))" }}
            >
                {showDimensions ? (
                    <PdpDimensionsPanel dimensions={dimensions} capacity={capacity} neckSize={neckSize} />
                ) : hasStack ? (
                    <PaperDollLayers plateUrl={plateUrl} kitParts={kitParts} alt={alt} onPlateError={onPlateError} />
                ) : fallbackImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fallbackImageUrl} alt={alt} className="absolute inset-0 h-full w-full object-contain object-center" />
                ) : (
                    <div className="absolute inset-0 bg-linen" aria-hidden />
                )}
                {overlay}
            </div>
        </div>
    );
});

export default MobileProductHero;
