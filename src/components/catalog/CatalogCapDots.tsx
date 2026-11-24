"use client";

/**
 * Cap choice on a catalog card: one swatch per cap finish, each the real cap,
 * sprayer or pump shown whole and upright on the card's white (as the legacy
 * site and the product page's cap rail do), with no circle around it. The
 * picked one is underlined and named beside the row (or below it, when the
 * card is too narrow for both). A finish with no photo shows a small
 * cap-shaped chip of its material colour.
 *
 * Every finish sits in one strip that scrolls sideways (touch, trackpad or the
 * thin chevrons at its ends), like the legacy card's cap row. A chevron shows
 * only while there are caps hidden on its side.
 *
 * The swatches are a radio group: picking one swaps the card's photo, price
 * and add-to-cart SKU. They never navigate.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useQuery } from "convex/react";
import Image from "next/image";
import { api } from "../../../convex/_generated/api";
import { catalogCapExactPhoto, catalogCapPhoto, catalogCapPhotoBounds, catalogCapPsdPhoto, CATALOG_CAP_FAMILY, type CatalogCapKind } from "@/lib/products/catalog-cap-photos";
import { getMaterialSwatchStyle } from "@/lib/products/material-swatches";
import type { ProductCardVariantPreview } from "@/lib/products/product-card-variant-previews";
import { oneMlVialApplicator } from "@/lib/products/one-ml-vial-applicators";

/** Height of a cap swatch's picture, px. Caps of every kind share a baseline. */
export const CAP_SWATCH_HEIGHT = 30;
/** Widest a cap swatch's picture may draw, px, so a squat cap stays in proportion. */
export const CAP_SWATCH_WIDTH = 24;

/**
 * Cap photographs for a card's finishes: a reviewed photo, else the part cut
 * from the PSD master library (public/images/cap-swatches), else the plate
 * index of the cap's own neck family (roll-on caps for a 17-415 roller, and so
 * on). Returns a lookup that is undefined while the plates load or when a
 * finish has no photo.
 */
export function useCatalogCapPhotos(input: {
    capKind: CatalogCapKind | null;
    neck: string | null;
    variants: ProductCardVariantPreview[];
}): (variant: ProductCardVariantPreview) => string | undefined {
    const { capKind, neck, variants } = input;
    const canHaveCaps = Boolean(capKind && neck && variants.length > 0);
    // Exact reviewed photos take precedence over the live index. If every
    // finish already has one, the index cannot change what the card displays.
    const needsIndex = canHaveCaps && variants.some(variant => catalogCapExactPhoto(variant, capKind!) === null);
    const capPlates = useQuery(api.productPlates.byFamily, needsIndex
        ? { familyId: `${CATALOG_CAP_FAMILY[capKind!]}-${neck}`, limit: 200 } : "skip");
    const fallbackCaps = useQuery(api.productPlates.byFamily,
        needsIndex && (capKind === "plain" || capKind === "pump") && capPlates !== undefined && capPlates.page.length === 0
            ? { familyId: `roll-on-cap-${neck}`, limit: 200 } : "skip");
    const rows = [...(capPlates?.page ?? []), ...(fallbackCaps?.page ?? [])];
    const platesLoaded = !needsIndex || (capPlates !== undefined
        && (capPlates.page.length > 0 || !(capKind === "plain" || capKind === "pump") || fallbackCaps !== undefined));
    // A card whose closure has no plate family (reducer caps) can still have its PSD component photo.
    return (variant) => (capKind ? catalogCapPhoto(variant, rows, capKind, undefined, { platesLoaded }) : catalogCapPsdPhoto(variant.websiteSku)?.url);
}

/** A swatch's fill when it is drawn as a colour chip: the finish's material colour. */
export function capDotStyle(variant: ProductCardVariantPreview, photoUrl: string | undefined): CSSProperties {
    const style = getMaterialSwatchStyle(variant.capLabel ?? variant.label, {
        imageUrl: photoUrl ?? null,
        fallbackColor: variant.swatchColor ?? null,
        size: "cover",
    });
    return Object.keys(style).length > 0 ? style : { background: "#e6dccd" };
}

/**
 * How to draw a cap photo in a swatch. A photo whose part has been measured
 * (a spray top on its bottle canvas, a cap with transparent margin) is cropped
 * to the part, which is then fitted to the swatch box standing on its bottom
 * edge: tall caps and sprayers reach the full height, short caps keep their
 * squat shape. A photo never measured is drawn whole, scaled to fit.
 */
export function capSwatchFrame(url: string, height = CAP_SWATCH_HEIGHT, maxWidth = CAP_SWATCH_WIDTH) {
    const bounds = catalogCapPhotoBounds(url);
    if (!bounds) return { kind: "contain" as const, width: maxWidth, height };
    const partWidth = bounds.right - bounds.left;
    const partHeight = bounds.bottom - bounds.top;
    const scale = Math.min(height / partHeight, maxWidth / partWidth);
    return {
        kind: "crop" as const,
        width: Math.max(1, Math.round(partWidth * scale)),
        height: Math.max(1, Math.round(partHeight * scale)),
        image: {
            width: Math.round(bounds.width * scale),
            height: Math.round(bounds.height * scale),
            left: -Math.round(bounds.left * scale),
            top: -Math.round(bounds.top * scale),
        },
    };
}

function CapSwatchPicture({ url, onError }: { url: string; onError: () => void }) {
    const frame = capSwatchFrame(url);
    if (frame.kind === "crop") {
        return (
            <span className="relative block flex-none overflow-hidden" style={{ width: frame.width, height: frame.height }}>
                <Image src={url} alt="" width={frame.image.width} height={frame.image.height} loading="lazy" onError={onError}
                    className="absolute max-w-none" style={{ ...frame.image }} />
            </span>
        );
    }
    return (
        <Image src={url} alt="" width={frame.width} height={frame.height} loading="lazy" onError={onError}
            className="block flex-none object-contain object-bottom" style={{ width: frame.width, height: frame.height }} />
    );
}

/** One click of an arrow scrolls the strip by this share of its visible width, so a cap stays in view. */
export const CAP_STRIP_PAGE = 0.8;

/** Where the strip may scroll from here: an arrow is shown only toward hidden caps. */
export function capStripEdges(scrollLeft: number, clientWidth: number, scrollWidth: number) {
    const slack = 1; // sub-pixel layout rounding
    return { back: scrollLeft > slack, forward: scrollLeft + clientWidth < scrollWidth - slack };
}

/** scrollLeft that brings a swatch fully into the strip, moving as little as possible. */
export function capStripScrollTo(scrollLeft: number, clientWidth: number, itemLeft: number, itemWidth: number) {
    if (itemLeft < scrollLeft) return itemLeft;
    if (itemLeft + itemWidth > scrollLeft + clientWidth) return itemLeft + itemWidth - clientWidth;
    return scrollLeft;
}

function Chevron({ direction }: { direction: "back" | "forward" }) {
    return (
        <svg aria-hidden width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
            <path d={direction === "back" ? "M7 1 1 7l6 6" : "M1 1l6 6-6 6"} />
        </svg>
    );
}

type Props = {
    title: string;
    variants: ProductCardVariantPreview[];
    selectedId: string | null;
    onSelect: (variant: ProductCardVariantPreview) => void;
    photo: (variant: ProductCardVariantPreview) => string | undefined;
    /** The card's background, which the chevrons fade the strip into. */
    background?: string;
};

export default function CatalogCapDots({ title, variants, selectedId, onSelect, photo, background = "#fff" }: Props) {
    const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
    const [edges, setEdges] = useState({ back: false, forward: false });
    const stripRef = useRef<HTMLDivElement>(null);
    const dotRefs = useRef(new Map<string, HTMLButtonElement>());
    const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0];
    const selectedKey = selected?.id;

    const measure = useCallback(() => {
        const strip = stripRef.current;
        if (!strip) return;
        const next = capStripEdges(strip.scrollLeft, strip.clientWidth, strip.scrollWidth);
        setEdges((current) => current.back === next.back && current.forward === next.forward ? current : next);
    }, []);

    // Keep the arrows in step with the strip's size (card width, photos loading) and bring the
    // picked cap into view when it changes, by scrolling the strip only, never the page.
    useEffect(() => {
        const strip = stripRef.current;
        if (!strip) return;
        const dot = selectedKey ? dotRefs.current.get(selectedKey) : undefined;
        if (dot) strip.scrollLeft = capStripScrollTo(strip.scrollLeft, strip.clientWidth, dot.offsetLeft - strip.offsetLeft, dot.offsetWidth);
        measure();
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(measure);
        observer.observe(strip);
        if (strip.firstElementChild) observer.observe(strip.firstElementChild);
        return () => observer.disconnect();
    }, [measure, selectedKey, variants.length]);

    if (variants.length === 0 || !selected) return null;

    const page = (direction: 1 | -1) => {
        const strip = stripRef.current;
        if (!strip) return;
        const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        strip.scrollBy({ left: direction * Math.max(24, strip.clientWidth * CAP_STRIP_PAGE), behavior: reduce ? "auto" : "smooth" });
    };

    const move = (event: KeyboardEvent<HTMLDivElement>) => {
        const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const index = variants.findIndex((variant) => variant.id === selected.id);
        const next = variants[(index + step + variants.length) % variants.length];
        onSelect(next);
        dotRefs.current.get(next.id)?.focus({ preventScroll: true });
    };

    const arrow = (direction: "back" | "forward") => {
        const visible = direction === "back" ? edges.back : edges.forward;
        return (
            <button
                type="button"
                onClick={() => page(direction === "back" ? -1 : 1)}
                aria-label={direction === "back" ? "Earlier caps" : "More caps"}
                aria-hidden={!visible}
                tabIndex={-1}
                disabled={!visible}
                data-testid={`catalog-card-cap-${direction}`}
                className={`absolute inset-y-0 z-[1] flex w-[26px] items-center text-[#8a7f70] transition-opacity duration-150 hover:text-[#1c1c1e] ${
                    direction === "back"
                        ? "left-0 justify-start bg-[linear-gradient(to_right,var(--cap-strip-bg)_45%,transparent)] pl-[1px]"
                        : "right-0 justify-end bg-[linear-gradient(to_left,var(--cap-strip-bg)_45%,transparent)] pr-[1px]"} ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
            >
                <Chevron direction={direction} />
            </button>
        );
    };

    const scrolls = edges.back || edges.forward;

    return (
        <div className="flex min-h-[38px] flex-wrap items-center gap-x-[6px] gap-y-1" data-testid="catalog-card-caps">
            <div className="relative flex min-w-0 max-w-full flex-[0_1_auto] items-center" data-testid="catalog-card-cap-strip" data-scrolls={scrolls}
                style={{ "--cap-strip-bg": background } as CSSProperties}>
                {scrolls && arrow("back")}
                <div
                    ref={stripRef}
                    onScroll={measure}
                    className="min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    style={{ scrollSnapType: "x proximity" }}
                >
                    <div role="radiogroup" aria-label={`${variants.every((variant) => oneMlVialApplicator(variant.websiteSku)) ? "Applicator" : "Cap"} for ${title}`}
                        onKeyDown={move} className="flex w-max gap-x-[5px]">
                        {variants.map((variant) => {
                            const active = variant.id === selected.id;
                            const candidate = photo(variant);
                            const photoUrl = candidate && !failed.has(candidate) ? candidate : undefined;
                            return (
                                <button
                                    key={variant.id}
                                    ref={(element) => {
                                        if (element) dotRefs.current.set(variant.id, element);
                                        else dotRefs.current.delete(variant.id);
                                    }}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    aria-label={variant.label}
                                    title={variant.label}
                                    tabIndex={active ? 0 : -1}
                                    onClick={() => onSelect(variant)}
                                    data-testid="catalog-card-cap-dot"
                                    data-swatch={photoUrl ? "photo" : "chip"}
                                    data-sku={variant.websiteSku ?? variant.graceSku ?? undefined}
                                    style={{ scrollSnapAlign: "start" }}
                                    className={`flex h-[38px] min-w-[24px] flex-none items-end justify-center border-b-2 px-[2px] pb-[3px] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#9a7a48] ${
                                        active ? "border-[#1c1c1e]" : "border-transparent hover:border-[#d9cdb9]"}`}
                                >
                                    {photoUrl
                                        ? <CapSwatchPicture url={photoUrl} onError={() => setFailed((current) => new Set(current).add(photoUrl))} />
                                        : <span aria-hidden className="block h-[24px] w-[18px] flex-none rounded-t-[3px] rounded-b-[1px]"
                                            style={{ ...capDotStyle(variant, undefined), boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)" }} />}
                                </button>
                            );
                        })}
                    </div>
                </div>
                {scrolls && arrow("forward")}
            </div>
            {/* Beside the strip when both fit; otherwise the strip takes the row and the name its own line. */}
            <span className="ml-0.5 min-w-[6rem] flex-[1_0_6rem] truncate text-[12px] text-[#5d6b7e]" data-testid="catalog-card-cap-name">
                {selected.label}
            </span>
        </div>
    );
}
