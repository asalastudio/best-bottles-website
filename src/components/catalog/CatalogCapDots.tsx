"use client";

/**
 * Cap choice on a catalog card: one swatch per cap finish, each the real cap,
 * sprayer or pump shown whole and upright on the card's white (as the legacy
 * site and the product page's cap rail do), with no circle around it. The
 * picked one is underlined and named beside the row. A finish with no photo
 * shows a small cap-shaped chip of its material colour. More than six
 * finishes collapse to five swatches and a "+N" pill that expands the row in
 * place ("−" folds it again).
 *
 * The swatches are a radio group: picking one swaps the card's photo, price
 * and add-to-cart SKU. They never navigate.
 */

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useQuery } from "convex/react";
import Image from "next/image";
import { api } from "../../../convex/_generated/api";
import { catalogCapPhoto, catalogCapPhotoBounds, CATALOG_CAP_FAMILY, type CatalogCapKind } from "@/lib/products/catalog-cap-photos";
import { getMaterialSwatchStyle } from "@/lib/products/material-swatches";
import type { ProductCardVariantPreview } from "@/lib/products/product-card-variant-previews";
import { oneMlVialApplicator } from "@/lib/products/one-ml-vial-applicators";

/** At most this many slots; beyond it, five swatches and a "+N" pill. */
export const CAP_DOT_SLOTS = 6;

/** Height of a cap swatch's picture, px. Caps of every kind share a baseline. */
export const CAP_SWATCH_HEIGHT = 30;
/** Widest a cap swatch's picture may draw, px, so a squat cap stays in proportion. */
export const CAP_SWATCH_WIDTH = 24;

/**
 * Cap photographs for a card's finishes, from the plate index of the cap's
 * own neck family (roll-on caps for a 17-415 roller, and so on). Returns a
 * lookup that is undefined until the plates load or when a finish has no photo.
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
    const needsIndex = canHaveCaps && variants.some(variant => !catalogCapPhoto(variant, [], capKind!));
    const capPlates = useQuery(api.productPlates.byFamily, needsIndex
        ? { familyId: `${CATALOG_CAP_FAMILY[capKind!]}-${neck}`, limit: 200 } : "skip");
    const fallbackCaps = useQuery(api.productPlates.byFamily,
        needsIndex && (capKind === "plain" || capKind === "pump") && capPlates !== undefined && capPlates.page.length === 0
            ? { familyId: `roll-on-cap-${neck}`, limit: 200 } : "skip");
    const rows = [...(capPlates?.page ?? []), ...(fallbackCaps?.page ?? [])];
    return (variant) => (capKind ? catalogCapPhoto(variant, rows, capKind) : undefined);
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

/**
 * Which finishes get a swatch while the row is folded: all of them up to six,
 * otherwise the first five, with the selected finish kept visible in the
 * fifth slot when it sits further down the list.
 */
export function visibleCapDots<T extends { id: string }>(variants: readonly T[], selectedId: string | null): T[] {
    if (variants.length <= CAP_DOT_SLOTS) return [...variants];
    const head = variants.slice(0, CAP_DOT_SLOTS - 1);
    if (!selectedId || head.some((variant) => variant.id === selectedId)) return head;
    const selected = variants.find((variant) => variant.id === selectedId);
    return selected ? [...head.slice(0, -1), selected] : head;
}

type Props = {
    title: string;
    variants: ProductCardVariantPreview[];
    selectedId: string | null;
    onSelect: (variant: ProductCardVariantPreview) => void;
    photo: (variant: ProductCardVariantPreview) => string | undefined;
};

export default function CatalogCapDots({ title, variants, selectedId, onSelect, photo }: Props) {
    const [expanded, setExpanded] = useState(false);
    const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
    const dotRefs = useRef(new Map<string, HTMLButtonElement>());
    if (variants.length === 0) return null;

    const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0];
    const shown = expanded ? variants : visibleCapDots(variants, selected.id);
    const hiddenCount = variants.length - shown.length;
    const overflow = variants.length > CAP_DOT_SLOTS;

    const move = (event: KeyboardEvent<HTMLDivElement>) => {
        const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const index = shown.findIndex((variant) => variant.id === selected.id);
        const next = shown[(index + step + shown.length) % shown.length];
        onSelect(next);
        dotRefs.current.get(next.id)?.focus();
    };

    return (
        <div className="flex min-h-[38px] flex-wrap items-center gap-x-[5px] gap-y-1" data-testid="catalog-card-caps">
            <div role="radiogroup" aria-label={`${variants.every((variant) => oneMlVialApplicator(variant.websiteSku)) ? "Applicator" : "Cap"} for ${title}`} onKeyDown={move} className="contents">
                {shown.map((variant) => {
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
                            className={`flex h-[38px] min-w-[24px] flex-none items-end justify-center border-b-2 px-[2px] pb-[3px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9a7a48] ${
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
            {overflow && (
                <button
                    type="button"
                    onClick={() => setExpanded((current) => !current)}
                    aria-expanded={expanded}
                    aria-label={expanded ? "Show fewer caps" : `Show ${hiddenCount} more caps`}
                    data-testid="catalog-card-cap-more"
                    className="h-[22px] flex-none rounded-full border border-[#d9cdb9] px-[7px] text-[11px] leading-none text-[#1c1c1e] hover:border-[#1c1c1e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1c1e]"
                >
                    {expanded ? "−" : `+${hiddenCount}`}
                </button>
            )}
            {/* Too narrow for the name beside the caps, it wraps to its own line rather than truncating. */}
            <span className="ml-0.5 min-w-[6rem] flex-1 truncate text-[12px] text-[#5d6b7e]" data-testid="catalog-card-cap-name">
                {selected.label}
            </span>
        </div>
    );
}
