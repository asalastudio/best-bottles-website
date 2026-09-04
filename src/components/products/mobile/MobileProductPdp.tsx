"use client";

/**
 * The mobile PDP: one bottle, one property changed at a time. Presentational
 * over ProductDetailClient's state — it receives the resolved variant, the
 * option lists the desktop configurator already derives, and the same commit
 * handlers (guided variant resolver → canonical URL; cart via useCart). What it
 * owns is presentation: view mode, the picker, and the preview that drives the
 * hero until the customer confirms.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import type { ProductVariant } from "@/app/products/[slug]/ProductDetailClient";
import { CaretRight, Check, Microphone, ShoppingBag } from "@/components/icons";
import { kitHasRemovableCap, useDecodedKitParts, useDecodedPlate, type KitQueryResult } from "@/components/products/PaperDollLayers";
import { analytics } from "@/lib/analytics";
import type { PlateRef } from "@/lib/paper-doll/plates";
import { resolveCapOptionPhoto } from "@/lib/products/closure-swatch-keys";
import { resolveGuidedVariant, type GuidedVariantDeps } from "@/lib/products/guided-variant-resolver";
import { getMaterialSwatchStyle } from "@/lib/products/material-swatches";
import {
    buildMobileConfigRows,
    confirmLabelFor,
    type MobileConfigDimension,
    type MobileConfigOption,
} from "@/lib/products/mobile-pdp-config-rows";
import { initialMobilePickerState, mobilePickerReducer, pickerHasPendingChange, sheetTopFromHero } from "@/lib/products/mobile-pdp-picker";
import {
    coerceMobileViewMode,
    getMobileViewModes,
    preferredViewForPicker,
    type MobilePickerType,
    type MobileViewCapabilities,
    type ProductViewMode,
} from "@/lib/products/mobile-pdp-view-modes";
import { hasRealPdpDimensions } from "@/lib/products/pdp-stage-modes";
import { closureBaseFromSlug, useClosureThumbnails } from "@/lib/products/use-closure-thumbnails";
import { useViewportIsMobile } from "@/lib/products/use-viewport-is-mobile";
import {
    GRACE_PDP_PLATE_EVENT,
    type GracePdpPlateCommand,
} from "@/lib/grace/pdpPlateSwap";
import MobileConfigurationSummary from "./MobileConfigurationSummary";
import MobileProductHero from "./MobileProductHero";
import { PickerOptions } from "./PickerOptions";
import ProductOptionSheet from "./ProductOptionSheet";
import ProductViewSelector from "./ProductViewSelector";
import { useGlassSiblingPreviews } from "./useGlassSiblingPreviews";

const VIEW_MODE_KEY = "bb:mobile-pdp-view";
const ROLLER_NOTES: Array<[RegExp, string]> = [
    [/metal|steel|stainless/i, "Smooth, cooling glide"],
    [/plastic/i, "Lighter, lower cost"],
];

/* Chrome the mobile PDP removes on this route only (PRD §61). The style element
   exists only while this component is mounted, and every rule is gated to the
   mobile breakpoint, so desktop and every other route are untouched. */
const chromeCss = `
@media (max-width: 767px){
[data-site-header],[data-mobile-tab-bar]{display:none}
main[data-mobile-pdp]{padding-bottom:env(safe-area-inset-bottom,0px)}
main[data-mobile-pdp] > [data-mobile-pdp-frame]{padding-top:0}
main[data-mobile-pdp] [data-testid="pdp-sticky-cart-bar"]{display:none}
}`;

export type MobileGlassOption = { id: string; label: string; href: string; active: boolean; imageUrl?: string | null };
export type MobileRollerOption = { value: string; label: string };

export type MobileProductPdpProps = {
    slug: string;
    group: {
        family?: string | null;
        capacity?: string | null;
        color?: string | null;
        category?: string | null;
        neckThreadSize?: string | null;
        heroImageUrl?: string | null;
    };
    variants: ProductVariant[];
    selectedVariant: ProductVariant | null;
    platesBySku: Record<string, PlateRef>;
    selectedKitQuery: KitQueryResult;
    displayName: string;
    inStock: boolean;
    canAddToCart: boolean;
    addedFlash: boolean;
    onAddToCart: () => void;
    quoteHref: string;
    qty: number;
    onQtyChange: (qty: number) => void;
    cartCount: number;
    backHref: string;
    /** Anchor the sticky purchase bar watches; hidden on desktop by CSS. */
    cartAnchorRef: RefObject<HTMLDivElement | null>;
    glassOptions: MobileGlassOption[];
    rollerOptions: MobileRollerOption[];
    activeApplicator: string | null;
    capOptions: string[];
    activeCapOption: string | null;
    capOptionPhotoKeys: Record<string, string[]>;
    resolveCapFinish: (variant: ProductVariant) => { label: string; swatchName: string };
    variantSku: (variant: ProductVariant) => string | null;
    onCommitVariant: (selection: { rollerVariant?: "metal" | "plastic"; capOption?: string }) => void;
    onCommitGlass: (href: string) => void;
    onPickerOpenChange: (open: boolean) => void;
    /** Opens the full Grace overlay. The tab bar (her usual mobile entry) is
        hidden on this route, so the purchase block carries an inline row. */
    onAskGrace?: () => void;
    volumePricing?: ReactNode;
};

function plateFor(platesBySku: Record<string, PlateRef>, variant: ProductVariant | null | undefined): PlateRef | null {
    if (!variant) return null;
    return platesBySku[variant.graceSku] ?? (variant.websiteSku ? platesBySku[variant.websiteSku] : undefined) ?? null;
}

function slugFromHref(href: string): string {
    return href.replace(/^\/products\//, "").split("?")[0] ?? href;
}

function formatEach(price: number | null | undefined): string {
    return price == null ? "Price on request" : `$${price.toFixed(2)}`;
}

export default function MobileProductPdp(props: MobileProductPdpProps) {
    const {
        slug, group, variants, selectedVariant, platesBySku, selectedKitQuery, displayName, inStock, canAddToCart,
        addedFlash, onAddToCart, quoteHref, qty, onQtyChange, cartCount, backHref, cartAnchorRef, glassOptions,
        rollerOptions, activeApplicator, capOptions, activeCapOption, capOptionPhotoKeys, resolveCapFinish, variantSku,
        onCommitVariant, onCommitGlass, onPickerOpenChange, onAskGrace, volumePricing,
    } = props;

    const isMobile = useViewportIsMobile();
    const closureBase = useMemo(() => closureBaseFromSlug(slug), [slug]);
    const thumbBySwatch = useClosureThumbnails(closureBase, group.neckThreadSize);
    const deps = useMemo<GuidedVariantDeps<ProductVariant>>(() => ({
        sku: variantSku,
        capFinish: (variant) => resolveCapFinish(variant).swatchName,
        applicator: (variant) => variant.applicator,
    }), [variantSku, resolveCapFinish]);

    /* ── picker + view state ─────────────────────────────────────────────── */
    const [picker, dispatch] = useReducer(mobilePickerReducer, undefined, () => initialMobilePickerState("assembled"));
    const [sheetTop, setSheetTop] = useState(0);
    const heroRef = useRef<HTMLDivElement>(null);
    const rowRefs = useRef(new Map<MobilePickerType, HTMLButtonElement>());
    const savedScroll = useRef<number | null>(null);
    const lastPickerRef = useRef<MobilePickerType | null>(null);
    const [brokenPlates, setBrokenPlates] = useState<ReadonlySet<string>>(() => new Set());
    const markPlateBroken = useCallback((url: string) => {
        console.error("[plates] image failed to load", url);
        setBrokenPlates((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));
    }, []);

    useEffect(() => {
        const onPlate = (event: Event) => {
            const viewMode = (event as CustomEvent<GracePdpPlateCommand>).detail?.viewMode;
            if (viewMode === "assembled" || viewMode === "capOff") {
                dispatch({ type: "setView", view: viewMode });
            }
        };
        window.addEventListener(GRACE_PDP_PLATE_EVENT, onPlate);
        return () => window.removeEventListener(GRACE_PDP_PLATE_EVENT, onPlate);
    }, []);

    /* ── committed selection ─────────────────────────────────────────────── */
    const committedPlate = plateFor(platesBySku, selectedVariant);
    const currentSku = selectedVariant ? variantSku(selectedVariant) : null;

    /* ── preview selection (same group: roller / cap finish) ─────────────── */
    const previewInGroup = useMemo(() => {
        if (!picker.activePicker || picker.activePicker === "glass" || !pickerHasPendingChange(picker)) return null;
        const selection = picker.activePicker === "roller"
            ? { applicator: picker.previewSelectionId, capOption: activeCapOption }
            : { applicator: activeApplicator, capOption: picker.previewSelectionId };
        return resolveGuidedVariant(variants, selection, deps);
    }, [picker, variants, deps, activeApplicator, activeCapOption]);

    /* ── preview selection (glass: sibling group) ────────────────────────── */
    const siblingSlugs = useMemo(
        () => glassOptions.filter((option) => !option.active).map((option) => slugFromHref(option.href)),
        [glassOptions],
    );
    const glassSelection = useMemo(() => ({ applicator: activeApplicator, capOption: activeCapOption }), [activeApplicator, activeCapOption]);
    const siblingPreviews = useGlassSiblingPreviews({
        enabled: isMobile && siblingSlugs.length > 0 && picker.activePicker === "glass",
        siblingSlugs,
        selection: glassSelection,
        deps,
    });
    const previewGlassOption = picker.activePicker === "glass" && pickerHasPendingChange(picker)
        ? glassOptions.find((option) => option.id === picker.previewSelectionId) ?? null
        : null;
    const previewSibling = previewGlassOption ? siblingPreviews[slugFromHref(previewGlassOption.href)] ?? null : null;

    /* ── what the hero shows ─────────────────────────────────────────────── */
    // Preview swaps the already-loaded plate only. Fetching and decoding a
    // full kit on every tap is what froze the sheet on a phone.
    const shownVariant = previewSibling?.variant ?? previewInGroup ?? selectedVariant;
    const shownPlate = previewSibling ? previewSibling.plate : previewInGroup ? plateFor(platesBySku, previewInGroup) : committedPlate;
    const previewing = Boolean(previewSibling?.variant || (previewInGroup && previewInGroup._id !== selectedVariant?._id));
    const shownKitQuery: KitQueryResult = previewing ? undefined : selectedKitQuery;
    const { kit: shownKit, parts: kitPartsWithCap } = useDecodedKitParts(
        { websiteSku: shownVariant?.websiteSku, graceSku: shownVariant?.graceSku },
        shownKitQuery,
        picker.viewMode !== "capOff",
    );

    const dimensions = useMemo(() => ({
        heightWithCap: shownVariant?.heightWithCap ?? null,
        heightWithoutCap: shownVariant?.heightWithoutCap ?? null,
        diameter: shownVariant?.diameter ?? null,
    }), [shownVariant?.heightWithCap, shownVariant?.heightWithoutCap, shownVariant?.diameter]);
    const viewCaps = useMemo<MobileViewCapabilities>(() => ({
        hasCapOffAsset: Boolean(shownPlate?.imageCapOff) || kitHasRemovableCap(shownKit),
        hasDimensions: hasRealPdpDimensions(dimensions),
    }), [shownPlate?.imageCapOff, shownKit, dimensions]);
    const viewModes = useMemo(() => getMobileViewModes(viewCaps), [viewCaps]);
    const viewMode = coerceMobileViewMode(picker.viewMode, viewCaps);

    const wantedPlateUrl = viewMode === "capOff" && shownPlate?.imageCapOff ? shownPlate.imageCapOff : shownPlate?.image ?? null;
    const requestedPlateUrl = wantedPlateUrl && !brokenPlates.has(wantedPlateUrl) ? wantedPlateUrl : null;
    const decodedPlate = useDecodedPlate(requestedPlateUrl, markPlateBroken);
    const fallbackImageUrl = shownVariant?.imageUrl ?? group.heroImageUrl ?? null;

    /* ── view persistence (presentation only) ────────────────────────────── */
    useEffect(() => {
        try {
            const saved = window.sessionStorage.getItem(VIEW_MODE_KEY);
            if (saved === "assembled" || saved === "capOff" || saved === "dimensions") dispatch({ type: "setView", view: saved });
        } catch {}
    }, []);
    const setView = (view: ProductViewMode) => {
        if (view === viewMode) return;
        analytics.mobilePdpViewChanged({ slug, sku: currentSku, viewMode: view, previousViewMode: viewMode });
        dispatch({ type: "setView", view });
        try { window.sessionStorage.setItem(VIEW_MODE_KEY, view); } catch {}
    };

    /* ── configuration rows ──────────────────────────────────────────────── */
    const glassDimension = useMemo<MobileConfigDimension | null>(() => {
        if (glassOptions.length === 0) return null;
        const options: MobileConfigOption[] = glassOptions.map((option) => {
            const thumb = option.active
                ? committedPlate?.thumb ?? committedPlate?.image ?? null
                : siblingPreviews[slugFromHref(option.href)]?.plate?.thumb ?? null;
            return { id: option.id, label: option.label, thumbUrl: thumb ?? option.imageUrl ?? null };
        });
        return { options, selectedId: glassOptions.find((option) => option.active)?.id ?? null };
    }, [glassOptions, committedPlate, siblingPreviews]);

    const rollerDimension = useMemo<MobileConfigDimension | null>(() => {
        if (rollerOptions.length === 0) return null;
        const options: MobileConfigOption[] = rollerOptions.map((option) => {
            const variant = resolveGuidedVariant(variants, { applicator: option.value, capOption: activeCapOption }, deps);
            const plate = plateFor(platesBySku, variant);
            return {
                id: option.value,
                label: option.label,
                thumbUrl: plate?.thumbCapOff ?? plate?.thumb ?? null,
                note: ROLLER_NOTES.find(([pattern]) => pattern.test(option.value))?.[1],
            };
        });
        return { options, selectedId: activeApplicator };
    }, [rollerOptions, variants, activeCapOption, deps, platesBySku, activeApplicator]);

    const capDimension = useMemo<MobileConfigDimension | null>(() => {
        if (capOptions.length === 0) return null;
        const options: MobileConfigOption[] = capOptions.map((name) => ({
            id: name,
            label: name,
            thumbUrl: resolveCapOptionPhoto(name, thumbBySwatch, capOptionPhotoKeys) ?? null,
            swatchStyle: getMaterialSwatchStyle(name, {}) as CSSProperties,
        }));
        return { options, selectedId: activeCapOption };
    }, [capOptions, thumbBySwatch, capOptionPhotoKeys, activeCapOption]);

    const { rows, facts } = useMemo(
        () => buildMobileConfigRows({ closureBase, glass: glassDimension, roller: rollerDimension, capFinish: capDimension }),
        [closureBase, glassDimension, rollerDimension, capDimension],
    );
    const activeRow = picker.activePicker ? rows.find((row) => row.picker === picker.activePicker) ?? null : null;

    /* ── picker flows ────────────────────────────────────────────────────── */
    const measureSheetTop = useCallback(() => {
        const heroBottom = heroRef.current?.getBoundingClientRect().bottom ?? 0;
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        setSheetTop(sheetTopFromHero(heroBottom, viewportHeight));
    }, []);

    const openPicker = (type: MobilePickerType) => {
        const row = rows.find((candidate) => candidate.picker === type);
        if (!row) return;
        savedScroll.current = window.scrollY;
        lastPickerRef.current = type;
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
        dispatch({
            type: "open",
            picker: type,
            committedId: row.selectedId,
            preferredView: preferredViewForPicker(type, viewMode, viewCaps),
        });
        analytics.mobilePdpPickerOpened({ slug, sku: currentSku, pickerType: type, viewMode });
        onPickerOpenChange(true);
        window.requestAnimationFrame(measureSheetTop);
    };

    const previewOption = (id: string) => {
        if (!picker.activePicker || id === picker.previewSelectionId) return;
        analytics.mobilePdpOptionPreviewed({
            slug, sku: currentSku, pickerType: picker.activePicker, viewMode,
            previousOptionId: picker.previewSelectionId, previewOptionId: id,
        });
        dispatch({ type: "preview", id });
    };

    const closeShared = () => {
        onPickerOpenChange(false);
    };

    const confirmPicker = () => {
        if (!picker.activePicker || !activeRow) return;
        const chosen = picker.previewSelectionId ?? picker.committedSelectionId;
        const changed = chosen !== null && chosen !== picker.committedSelectionId;
        if (changed && chosen) {
            analytics.mobilePdpOptionConfirmed({
                slug, sku: currentSku, pickerType: picker.activePicker, viewMode,
                previousOptionId: picker.committedSelectionId, confirmedOptionId: chosen,
            });
            if (picker.activePicker === "glass") {
                const option = glassOptions.find((candidate) => candidate.id === chosen);
                if (option) onCommitGlass(option.href);
            } else if (picker.activePicker === "roller") {
                const material: "metal" | "plastic" | undefined = /metal/i.test(chosen) ? "metal" : /plastic/i.test(chosen) ? "plastic" : undefined;
                if (material) onCommitVariant({ rollerVariant: material });
            } else {
                onCommitVariant({ capOption: chosen });
            }
        }
        dispatch({ type: "confirm" });
        closeShared();
    };

    const cancelPicker = () => {
        if (!picker.activePicker) return;
        analytics.mobilePdpPickerCancelled({
            slug, sku: currentSku, pickerType: picker.activePicker, viewMode,
            previewOptionId: pickerHasPendingChange(picker) ? picker.previewSelectionId : null,
        });
        dispatch({ type: "cancel" });
        closeShared();
    };

    const restoreAfterClose = useCallback(() => {
        if (savedScroll.current !== null) {
            window.scrollTo({ top: savedScroll.current, behavior: "instant" as ScrollBehavior });
            savedScroll.current = null;
        }
        const row = lastPickerRef.current ? rowRefs.current.get(lastPickerRef.current) : null;
        row?.focus({ preventScroll: true });
    }, []);

    // Catalog → PDP in the app router can keep the grid's scroll offset, which
    // tucks the bottle under the browser chrome on first land.
    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    }, [slug]);

    // Safari's dynamic chrome and orientation changes move the hero's edge.
    // Measure after paint — setState in the effect body is a cascading render.
    useEffect(() => {
        if (!picker.activePicker) return;
        const frame = window.requestAnimationFrame(measureSheetTop);
        window.addEventListener("resize", measureSheetTop);
        window.visualViewport?.addEventListener("resize", measureSheetTop);
        window.visualViewport?.addEventListener("scroll", measureSheetTop);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener("resize", measureSheetTop);
            window.visualViewport?.removeEventListener("resize", measureSheetTop);
            window.visualViewport?.removeEventListener("scroll", measureSheetTop);
        };
    }, [picker.activePicker, measureSheetTop]);

    const registerRow = useCallback((type: MobilePickerType, el: HTMLButtonElement | null) => {
        if (el) rowRefs.current.set(type, el);
        else rowRefs.current.delete(type);
    }, []);

    /* ── purchase facts ──────────────────────────────────────────────────── */
    const priceEach = selectedVariant?.webPrice1pc ?? null;
    const caseQty = selectedVariant?.caseQuantity && selectedVariant.caseQuantity > 1 ? selectedVariant.caseQuantity : null;
    const neckSize = selectedVariant?.neckThreadSize ?? group.neckThreadSize ?? null;
    const resolvedSku = selectedVariant?.websiteSku || selectedVariant?.graceSku || null;
    const previewingLabel = activeRow && pickerHasPendingChange(picker)
        ? activeRow.options.find((option) => option.id === picker.previewSelectionId)?.label ?? null
        : null;

    return (
        <div data-testid="mobile-pdp" className="bg-bone">
            <style dangerouslySetInnerHTML={{ __html: chromeCss }} />

            <MobileProductHero
                ref={heroRef}
                viewMode={viewMode}
                plateUrl={decodedPlate.url}
                kitParts={viewMode === "dimensions" ? null : kitPartsWithCap}
                fallbackImageUrl={decodedPlate.url ? null : fallbackImageUrl}
                alt={`${displayName}${previewingLabel ? ` — previewing ${previewingLabel}` : ""}`}
                dimensions={dimensions}
                capacity={group.capacity}
                neckSize={neckSize}
                backHref={backHref}
                cartCount={cartCount}
                onOpenCart={() => window.dispatchEvent(new Event("open-cart-drawer"))}
                onPlateError={markPlateBroken}
                overlay={previewingLabel ? (
                    <span
                        data-testid="mobile-pdp-preview-badge"
                        className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-obsidian/85 px-3 py-1 text-2xs font-semibold uppercase tracking-label text-white backdrop-blur"
                    >
                        Previewing · {previewingLabel}
                    </span>
                ) : null}
            />

            <ProductViewSelector modes={viewModes} activeMode={viewMode} onModeChange={setView} />

            {/* ── identity + price ─────────────────────────────────────────── */}
            <section className="px-4 pb-4 pt-5" aria-labelledby="mobile-pdp-title">
                <p className="text-2xs font-semibold uppercase tracking-label text-muted-gold">
                    {[group.category ?? "Glass Bottle", group.family].filter(Boolean).join(" · ")}
                </p>
                <h1 id="mobile-pdp-title" className="mt-1 font-serif text-[26px] font-medium leading-[1.15] text-obsidian">{displayName}</h1>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <p className="text-lg font-semibold tabular-nums text-obsidian" data-testid="mobile-pdp-price">
                        {formatEach(priceEach)}
                        {priceEach != null ? <span className="ml-1 text-xs font-normal text-slate">/each</span> : null}
                    </p>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-label ${
                        inStock ? "border-[#2E9E6B]/30 bg-[#2E9E6B]/10 text-[#1F6B49]" : "border-amber-300 bg-amber-50 text-amber-700"
                    }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${inStock ? "bg-[#2E9E6B]" : "bg-amber-500"}`} />
                        {inStock ? "Available to order" : "Confirm availability"}
                    </span>
                </div>
                <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate">
                    {neckSize ? <div className="flex gap-1.5"><dt className="font-semibold uppercase tracking-label text-2xs">Neck</dt><dd className="text-obsidian">{neckSize}</dd></div> : null}
                    {caseQty ? <div className="flex gap-1.5"><dt className="font-semibold uppercase tracking-label text-2xs">Case</dt><dd className="text-obsidian">{caseQty.toLocaleString()}</dd></div> : null}
                    {resolvedSku ? <div className="flex gap-1.5"><dt className="font-semibold uppercase tracking-label text-2xs">SKU</dt><dd className="text-obsidian">{resolvedSku}</dd></div> : null}
                </dl>
            </section>

            <MobileConfigurationSummary rows={rows} facts={facts} onOpen={openPicker} registerRow={registerRow} />

            {/* ── quantity + add to cart ───────────────────────────────────── */}
            <section ref={cartAnchorRef} className="px-4 pb-6 pt-5" data-testid="mobile-pdp-purchase">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-2xs font-semibold uppercase tracking-label text-slate">Quantity</span>
                    <div className="flex flex-wrap items-stretch justify-end gap-2">
                        <div className="flex items-center rounded-[3px] border border-champagne bg-white">
                            <button type="button" aria-label="Decrease quantity" onClick={() => onQtyChange(Math.max(1, qty - 1))}
                                    className="min-h-11 min-w-11 px-3 text-obsidian transition-colors hover:text-muted-gold">−</button>
                            <input type="number" min={1} inputMode="numeric" aria-label="Quantity" value={qty}
                                   onChange={(event) => {
                                       const next = Number(event.target.value);
                                       onQtyChange(Number.isFinite(next) ? Math.max(1, Math.floor(next)) : 1);
                                   }}
                                   className="w-14 min-w-0 bg-transparent text-center text-md font-semibold tabular-nums text-obsidian outline-none" />
                            <button type="button" aria-label="Increase quantity" onClick={() => onQtyChange(qty + 1)}
                                    className="min-h-11 min-w-11 px-3 text-obsidian transition-colors hover:text-muted-gold">+</button>
                        </div>
                        {caseQty ? (
                            <button type="button" aria-label={`Set quantity to one case of ${caseQty}`} onClick={() => onQtyChange(caseQty)}
                                    className="min-h-11 whitespace-nowrap rounded-[3px] border border-champagne bg-white px-3 text-sm font-semibold text-obsidian hover:border-muted-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold">
                                1 case
                            </button>
                        ) : null}
                    </div>
                </div>
                {priceEach != null && qty > 1 ? (
                    <p className="mt-2 text-right text-xs text-slate">
                        {qty.toLocaleString()} × {formatEach(priceEach)} = <span className="font-semibold text-obsidian">${(priceEach * qty).toFixed(2)}</span>
                    </p>
                ) : null}

                <div className="mt-4">
                    {qty >= 500 ? (
                        <Link href={quoteHref} data-testid="mobile-pdp-request-quote"
                              className="flex min-h-12 w-full items-center justify-center rounded-[3px] bg-obsidian text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-muted-gold">
                            Request Quote
                        </Link>
                    ) : canAddToCart ? (
                        <button type="button" disabled={!canAddToCart || addedFlash} onClick={onAddToCart} data-testid="mobile-pdp-add-to-cart"
                                className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] text-xs font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold ${
                                    addedFlash ? "bg-emerald-600 text-white" : "bg-obsidian text-white hover:bg-muted-gold disabled:opacity-40"
                                }`}>
                            {addedFlash ? (<><Check className="h-4 w-4" weight="bold" aria-hidden /><span>Added!</span></>)
                                : (<><ShoppingBag className="h-4 w-4" aria-hidden /><span>{inStock ? "Add to Cart" : "Out of Stock"}</span></>)}
                        </button>
                    ) : (
                        <Link href={quoteHref} data-testid="mobile-pdp-request-quote"
                              className="flex min-h-12 w-full items-center justify-center rounded-[3px] bg-obsidian text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-muted-gold">
                            Request Quote
                        </Link>
                    )}
                </div>
                {/* Grace sits at the decision point, not in a floating disc: the
                    questions she answers (fit, bulk pricing) arise right here,
                    and nothing floats over the hero or the picker's confirm. */}
                {onAskGrace ? (
                    <button
                        type="button"
                        onClick={onAskGrace}
                        data-testid="mobile-pdp-ask-grace"
                        className="mt-4 flex min-h-[56px] w-full items-center gap-3 rounded-[3px] border border-champagne bg-white px-3 py-2.5 text-left transition-colors hover:border-muted-gold hover:bg-linen/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold"
                    >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-obsidian text-white" aria-hidden>
                            <Microphone className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-obsidian">Ask Grace about fit and bulk pricing</span>
                            <span className="block text-xs leading-snug text-slate">
                                {neckSize ? `${neckSize} closures` : "Compatible closures"} · case quantities · quotes
                            </span>
                        </span>
                        <CaretRight className="h-4 w-4 shrink-0 text-slate" aria-hidden />
                    </button>
                ) : null}
                {volumePricing ? <div className="mt-5" data-testid="mobile-pdp-volume-pricing">{volumePricing}</div> : null}
            </section>

            {/* ── the picker ───────────────────────────────────────────────── */}
            <ProductOptionSheet
                open={Boolean(activeRow)}
                top={sheetTop}
                title={activeRow?.title ?? ""}
                hint={activeRow?.hint}
                confirmLabel={activeRow ? confirmLabelFor(activeRow, picker.previewSelectionId) : ""}
                confirmDisabled={!activeRow || (picker.activePicker === "glass" && Boolean(previewSibling?.pending))}
                onConfirm={confirmPicker}
                onCancel={cancelPicker}
                onRestoreFocus={restoreAfterClose}
            >
                {activeRow ? (
                    <PickerOptions
                        layout={activeRow.layout}
                        options={activeRow.options}
                        selectedId={picker.previewSelectionId}
                        onSelect={previewOption}
                        groupLabel={activeRow.title}
                    />
                ) : null}
            </ProductOptionSheet>
        </div>
    );
}
