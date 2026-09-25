"use client";

/**
 * Cap choice on a catalog card (design 8a): one 22 px dot per cap finish,
 * each filled with a crop of the real cap photo, the selected cap's name
 * beside them. More than six finishes collapse to five dots and a "+N" pill
 * that expands the row in place ("−" folds it again).
 *
 * The dots are a radio group: picking one swaps the card's photo, price and
 * add-to-cart SKU. They never navigate.
 */

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { catalogCapPhoto, CATALOG_CAP_FAMILY, type CatalogCapKind } from "@/lib/products/catalog-cap-photos";
import { getMaterialSwatchStyle } from "@/lib/products/material-swatches";
import type { ProductCardVariantPreview } from "@/lib/products/product-card-variant-previews";

/** At most this many slots; beyond it, five dots and a "+N" pill. */
export const CAP_DOT_SLOTS = 6;

const UNSELECTED_RING = "inset 0 0 0 1px rgba(0,0,0,.15)";
const SELECTED_RING = "0 0 0 2px #fff, 0 0 0 3px #1c1c1e";

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
    const capPlates = useQuery(api.productPlates.byFamily, canHaveCaps
        ? { familyId: `${CATALOG_CAP_FAMILY[capKind!]}-${neck}`, limit: 200 } : "skip");
    const fallbackCaps = useQuery(api.productPlates.byFamily,
        canHaveCaps && (capKind === "plain" || capKind === "pump") && capPlates !== undefined && capPlates.page.length === 0
            ? { familyId: `roll-on-cap-${neck}`, limit: 200 } : "skip");
    const rows = [...(capPlates?.page ?? []), ...(fallbackCaps?.page ?? [])];
    return (variant) => (capKind ? catalogCapPhoto(variant, rows, capKind) : undefined);
}

/** The dot's fill: the cap photo cropped to the circle, else the finish's material colour. */
export function capDotStyle(variant: ProductCardVariantPreview, photoUrl: string | undefined): CSSProperties {
    const style = getMaterialSwatchStyle(variant.capLabel ?? variant.label, {
        imageUrl: photoUrl ?? null,
        fallbackColor: variant.swatchColor ?? null,
        size: "cover",
    });
    return Object.keys(style).length > 0 ? style : { background: "#e6dccd" };
}

/**
 * Which finishes get a dot while the row is folded: all of them up to six,
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
        <div className="flex min-h-6 flex-wrap items-center gap-[7px]" data-testid="catalog-card-caps">
            <div role="radiogroup" aria-label={`Cap for ${title}`} onKeyDown={move} className="contents">
                {shown.map((variant) => {
                    const active = variant.id === selected.id;
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
                            data-sku={variant.websiteSku ?? variant.graceSku ?? undefined}
                            className="h-[22px] w-[22px] flex-none rounded-full bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9a7a48]"
                            style={{ ...capDotStyle(variant, photo(variant)), boxShadow: active ? SELECTED_RING : UNSELECTED_RING }}
                        />
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
            <span className="ml-0.5 min-w-0 flex-1 truncate text-[12px] text-[#5d6b7e]" data-testid="catalog-card-cap-name">
                {selected.label}
            </span>
        </div>
    );
}
