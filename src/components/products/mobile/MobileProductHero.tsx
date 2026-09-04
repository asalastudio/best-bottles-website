"use client";

/**
 * The permanent product workspace at the top of the mobile PDP. Fixed
 * dimensions (10:11 plate canvas, capped by viewport height) so a layer swap,
 * a view change, or a picker opening never moves the bottle. Renders the
 * plate/kit stack, or the dimension specification in the same box.
 */
import Link from "next/link";
import { forwardRef, type ReactNode } from "react";
import { ArrowLeft, ShoppingBag } from "@/components/icons";
import PaperDollLayers, { type KitPart } from "@/components/products/PaperDollLayers";
import type { ProductViewMode } from "@/lib/products/mobile-pdp-view-modes";

export type PdpDimensions = {
    heightWithCap?: string | null;
    heightWithoutCap?: string | null;
    diameter?: string | null;
};

function DimensionRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-4 border-t border-champagne/70 py-2.5 first:border-t-0">
            <dt className="text-2xs font-semibold uppercase tracking-label text-slate">{label}</dt>
            <dd className="shrink-0 whitespace-nowrap text-right font-serif text-base text-obsidian tabular-nums">{value}</dd>
        </div>
    );
}

/**
 * The three physical measurements, in the hero's box. Neck finish and capacity
 * already sit in the identity block below, so they are not repeated here; the
 * top padding clears the back/cart controls that float over the hero.
 */
export function PdpDimensionsPanel({ dimensions, capacity, neckSize }: { dimensions: PdpDimensions; capacity?: string | null; neckSize?: string | null }) {
    const rows = [
        dimensions.heightWithCap?.trim() ? { label: "Height with cap", value: dimensions.heightWithCap } : null,
        dimensions.heightWithoutCap?.trim() ? { label: "Height without cap", value: dimensions.heightWithoutCap } : null,
        dimensions.diameter?.trim() ? { label: "Diameter", value: dimensions.diameter } : null,
    ].filter((row): row is { label: string; value: string } => row !== null);
    return (
        <div
            className="flex h-full w-full flex-col justify-center bg-linen px-6 pb-6"
            style={{ paddingTop: "calc(3.75rem + env(safe-area-inset-top, 0px))" }}
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
    const hasStack = Boolean(plateUrl || kitParts?.length);
    return (
        <div ref={ref} data-testid="mobile-pdp-hero" className="relative w-full bg-white">
            <div
                className="relative mx-auto overflow-hidden"
                style={{ aspectRatio: "10 / 11", width: "min(100%, calc(52svh * 10 / 11))" }}
            >
                {showDimensions ? (
                    <PdpDimensionsPanel dimensions={dimensions} capacity={capacity} neckSize={neckSize} />
                ) : hasStack ? (
                    <PaperDollLayers plateUrl={plateUrl} kitParts={kitParts} alt={alt} onPlateError={onPlateError} />
                ) : fallbackImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fallbackImageUrl} alt={alt} className="absolute inset-0 h-full w-full object-contain" />
                ) : (
                    <div className="absolute inset-0 bg-linen" aria-hidden />
                )}
            </div>

            {/* The standard header is gone on this route, so the route back to
                browsing and the cart live on the hero. 44px targets. */}
            <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
                <Link
                    href={backHref}
                    aria-label="Back to catalog"
                    data-testid="mobile-pdp-back"
                    className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-bone/90 text-obsidian shadow-sm backdrop-blur transition-colors hover:bg-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold"
                >
                    <ArrowLeft className="h-5 w-5" weight="regular" aria-hidden />
                </Link>
                <button
                    type="button"
                    onClick={onOpenCart}
                    aria-label={cartCount > 0 ? `Open cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}` : "Open cart"}
                    data-testid="mobile-pdp-cart"
                    className="pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-full bg-bone/90 text-obsidian shadow-sm backdrop-blur transition-colors hover:bg-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold"
                >
                    <ShoppingBag className="h-5 w-5" weight="regular" aria-hidden />
                    {cartCount > 0 ? (
                        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-obsidian px-1 text-[10px] font-bold text-white">
                            {cartCount > 99 ? "99+" : cartCount}
                        </span>
                    ) : null}
                </button>
            </div>
            {overlay}
        </div>
    );
});

export default MobileProductHero;
