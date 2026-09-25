"use client";

/**
 * The product page (design handoff `design_handoff_pdp_3a`, option 3a desktop,
 * option 4a mobile). One page per shape + size + fitment type. The customer
 * picks glass on the canvas (a sibling group), roller in the buy box (an
 * applicator) and cap on the canvas (a SKU); the exact SKU is the intersection
 * and the URL carries the picks so every combination is shareable.
 *
 * State lives here; the model (`pdp-redesign/model.ts`) decides options, SKU
 * resolution and copy lines; the stage (`pdp-redesign/stage.ts`) decides
 * geometry. Commerce goes through the shared cart, so "In this order" is the
 * cart's own view of this page's lines.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import LocaleLink from "@/components/LocaleLink";
import Navbar from "@/components/Navbar";
import { useCart } from "@/components/CartProvider";
import { useRegion } from "@/components/RegionProvider";
import { useGrace } from "@/components/useGrace";
import type { ProductVariant } from "@/app/products/[slug]/ProductDetailClient";
import { analytics } from "@/lib/analytics";
import { checkoutMinimum, isCheckoutReady, isSoldOutStockStatus } from "@/lib/checkout";
import { dispatchPdpContextChange } from "@/lib/grace/pageContextEvents";
import type { PlateRef } from "@/lib/paper-doll/plates";
import type { ItemDescription } from "@/lib/products/item-description/resolve";
import { getMaterialSwatchStyle } from "@/lib/products/material-swatches";
import { isLegacyBestBottlesImageUrl } from "@/lib/productVariantIntegrity";
import { formatVolumeQtyRange, resolveQuotedUnitPrice } from "@/lib/volumePricing";
import {
    buildYourBottleHref,
    callouts as buildCallouts,
    capOptionFor,
    capOptions,
    capacityEyebrow,
    derivePicks,
    fitmentLabel,
    glassLabel,
    glassOptions,
    glassShortLabel,
    lineLabel,
    pageTitle,
    pickLine,
    pickQuery,
    resolveVariant,
    rollerIdFor,
    rollerOptions,
    statusLine,
    techSheetRows,
    tiersFor,
    unitPriceAt,
    type CollectionBand,
    type PdpGroup,
    type Picks,
    type RollerId,
    type SiblingGlassGroup,
} from "@/lib/products/pdp-redesign/model";
import { availableViews, type KitLike, type StageView } from "@/lib/products/pdp-redesign/stage";
import styles from "./pdp.module.css";
import PdpBuyBox, { type AddState } from "./PdpBuyBox";
import PdpStage from "./PdpStage";
import { PdpBuildStrip, PdpCollectionBand, PdpOrderLines, PdpProductInfo, PdpStickyBar, PdpTechSheet, type OrderLineView } from "./PdpSections";
import { drawingFor, drawingStyleFromQuery } from "@/lib/products/pdp-redesign/drawings";

export type PdpRedesignPayload = {
    slug: string;
    group: PdpGroup;
    variants: ProductVariant[];
    siblings: SiblingGlassGroup[];
    /** Published kits for this group's variants and each sibling's primary SKU, by website SKU and Grace SKU. */
    kitsBySku: Record<string, KitLike | null>;
    platesBySku: Record<string, PlateRef>;
    /** Curated or composed copy, by website SKU. */
    descriptions: Record<string, ItemDescription>;
    collection: { band: CollectionBand; description: string } | null;
    familyHref: string;
};

const ADDED_FLASH_MS = 1800;

function kitFor(kits: Record<string, KitLike | null>, variant: { websiteSku?: string | null; graceSku?: string | null } | null | undefined): KitLike | null {
    if (!variant) return null;
    return (variant.websiteSku ? kits[variant.websiteSku] : null) ?? (variant.graceSku ? kits[variant.graceSku] : null) ?? null;
}

/** A photograph the stage may fall back to: never a Sanity render, never a 2020 bestbottles.com store image (the classic page blocks those too). */
function usableImage(url: string | null | undefined): string | null {
    if (!url) return null;
    if (/cdn\.sanity\.io/.test(url)) return null;
    if (isLegacyBestBottlesImageUrl(url)) return null;
    return url;
}

export default function PdpRedesignPage({ slug, group, variants, siblings, kitsBySku, platesBySku, descriptions, collection, familyHref }: PdpRedesignPayload) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { formatPrice } = useRegion();
    const { items: cartItems, addItems, removeItem } = useCart();
    const { openPanel: openGrace } = useGrace();

    const rollers = useMemo(() => rollerOptions(variants), [variants]);
    const [picks, setPicks] = useState<Picks>(() => derivePicks(variants, group, {
        roller: searchParams.get("roller"),
        cap: searchParams.get("cap"),
        sku: searchParams.get("sku"),
    }));
    const [view, setView] = useState<StageView>("sidecar");
    const [qty, setQty] = useState<number>(() => Math.max(1, Math.min(99_999, Number.parseInt(searchParams.get("qty") ?? "1", 10) || 1)));
    const [addedQty, setAddedQty] = useState<number | null>(null);
    const addedTimer = useRef<number | null>(null);

    const caps = useMemo(() => capOptions(variants, picks.roller), [variants, picks.roller]);
    const selected = useMemo(() => resolveVariant(variants, picks), [variants, picks]);
    const activeCap = useMemo(() => capOptionFor(selected, caps), [selected, caps]);
    const activeRoller = rollerIdFor(selected?.applicator) ?? picks.roller;
    const glasses = useMemo(() => glassOptions(group, siblings), [group, siblings]);
    const activeGlass = glasses.find((glass) => glass.active) ?? glasses[0] ?? null;
    const rollerOption = rollers.find((option) => option.id === activeRoller) ?? null;
    const fitment = fitmentLabel(selected);
    const kit = kitFor(kitsBySku, selected);
    const glassBodyKit = useCallback((glassSlug: string): KitLike | null => {
        if (glassSlug === slug) return kit ?? kitFor(kitsBySku, { websiteSku: group.primaryWebsiteSku, graceSku: group.primaryGraceSku }) ?? variants.map((variant) => kitFor(kitsBySku, variant)).find(Boolean) ?? null;
        const sibling = siblings.find((candidate) => candidate.slug === glassSlug);
        const candidates = sibling?.bodyCandidates ?? (sibling ? [{ websiteSku: sibling.primaryWebsiteSku ?? null, graceSku: sibling.primaryGraceSku ?? null }] : []);
        for (const candidate of candidates) {
            const found = kitFor(kitsBySku, candidate);
            if (found) return found;
        }
        return null;
    }, [slug, kit, kitsBySku, group.primaryWebsiteSku, group.primaryGraceSku, variants, siblings]);
    const stageContext = useMemo(() => ({
        family: group.family, capacityMl: group.capacityMl ?? null, color: group.color ?? null,
        applicator: selected?.applicator ?? null, websiteSku: selected?.websiteSku ?? null,
    }), [group.family, group.capacityMl, group.color, selected?.applicator, selected?.websiteSku]);
    const views = useMemo(() => availableViews(kit, stageContext), [kit, stageContext]);
    // The requested view survives a SKU change; a SKU without layers shows SIDECAR until one returns.
    const shownView: StageView = views.includes(view) ? view : "sidecar";

    // The URL carries the picks so every combination is shareable; native history so nothing refetches.
    useEffect(() => {
        if (typeof window === "undefined") return;
        const next = pickQuery(picks, rollers);
        const current = new URLSearchParams(window.location.search);
        current.delete("roller"); current.delete("cap"); current.delete("sku");
        const carried = current.toString();
        const query = [next, carried].filter(Boolean).join("&");
        const target = `${pathname}${query ? `?${query}` : ""}`;
        if (`${window.location.pathname}${window.location.search}` !== target) {
            // A null state lets Next's patched History API keep its router state in step
            // (passing Next's own state object makes it treat the call as internal and skip that).
            window.history.replaceState(null, "", target);
        }
    }, [picks, rollers, pathname]);

    // Grace reads the page through this event; analytics counts one view per SKU.
    const lastViewedSku = useRef<string | null>(null);
    useEffect(() => {
        if (!selected?.websiteSku) return;
        dispatchPdpContextChange({
            websiteSku: selected.websiteSku,
            application: selected.applicator ?? undefined,
            glass: group.color ?? undefined,
            rollerMaterial: activeRoller ?? undefined,
            finish: activeCap?.name,
            pageUrl: `${pathname}?${pickQuery(picks, rollers)}`,
        });
        if (lastViewedSku.current !== selected.websiteSku) {
            lastViewedSku.current = selected.websiteSku;
            analytics.pdpView({ group: slug, sku: selected.websiteSku });
        }
    }, [selected, group.color, activeRoller, activeCap?.name, pathname, picks, rollers, slug]);

    useEffect(() => () => { if (addedTimer.current != null) window.clearTimeout(addedTimer.current); }, []);

    const onCapPick = useCallback((id: string) => {
        setPicks((current) => ({ ...current, cap: id }));
        const option = caps.find((cap) => cap.id === id);
        analytics.pdpPick({ group: slug, type: "cap", value: option?.name ?? id, sku: option?.variants[0]?.websiteSku ?? null });
    }, [caps, slug]);

    const onRoller = useCallback((id: RollerId) => {
        setPicks((current) => ({ ...current, roller: id }));
        if (views.includes("exploded")) setView("exploded");
        const next = resolveVariant(variants, { roller: id, cap: picks.cap });
        analytics.pdpPick({ group: slug, type: "roller", value: id, sku: next?.websiteSku ?? null });
    }, [views, variants, picks.cap, slug]);

    const onGlassPick = useCallback((targetSlug: string) => {
        const glass = glasses.find((option) => option.slug === targetSlug);
        analytics.pdpPick({ group: slug, type: "glass", value: glass?.label ?? targetSlug, sku: glass?.primaryWebsiteSku ?? null });
        if (targetSlug === slug) return;
        const query = pickQuery(picks, rollers);
        router.push(`/products/${targetSlug}${query ? `?${query}` : ""}`, { scroll: false });
    }, [glasses, picks, rollers, router, slug]);

    useEffect(() => {
        for (const glass of glasses) if (!glass.active) router.prefetch(`/products/${glass.slug}`);
    }, [glasses, router]);

    const onView = useCallback((next: StageView) => {
        if (!views.includes(next)) return;
        setView(next);
        analytics.pdpViewMode({ group: slug, mode: next });
    }, [views, slug]);

    // ── pricing and purchase ──────────────────────────────────────────────
    const tiers = useMemo(() => tiersFor(selected), [selected]);
    const unitPrice = unitPriceAt(selected, qty);
    const lineTotal = unitPrice != null ? unitPrice * qty : null;
    const status = statusLine(selected);
    const checkoutReady = selected ? isCheckoutReady({
        graceSku: selected.graceSku, shopifyVariantId: selected.shopifyVariantId ?? null,
        shopifySellable: selected.shopifySellable ?? undefined, stockStatus: selected.stockStatus,
    }) : false;
    const addState: AddState = !selected || selected.webPrice1pc == null || selected.webPrice1pc <= 0
        ? "unpriced"
        : isSoldOutStockStatus(selected.stockStatus) || !status.inStock
            ? "sold-out"
            : checkoutReady ? "add" : "unavailable";

    const onAdd = useCallback(() => {
        if (!selected || addState !== "add") return;
        const tier = tiers.length ? formatVolumeQtyRange(tiers[tiers.reduce((acc, t, i) => (qty >= t.minQty ? i : acc), 0)].minQty, tiers[tiers.reduce((acc, t, i) => (qty >= t.minQty ? i : acc), 0)].maxQty) : null;
        addItems([{
            graceSku: selected.graceSku,
            itemName: pageTitle(group, fitment),
            quantity: qty,
            unitPrice: selected.webPrice1pc ?? null,
            checkoutEligible: checkoutReady,
            stockStatus: selected.stockStatus,
            shopifyVariantId: selected.shopifyVariantId ?? null,
            shopifySellable: selected.shopifySellable ?? undefined,
            websiteSku: selected.websiteSku ?? null,
            variantId: selected._id,
            productGroupSlug: slug,
            family: group.family,
            capacity: group.capacity ?? undefined,
            color: group.color ?? undefined,
            applicator: selected.applicator,
            capColor: activeCap?.name ?? null,
            category: group.category,
            neckThreadSize: selected.neckThreadSize ?? group.neckThreadSize ?? null,
            webPrice1pc: selected.webPrice1pc ?? null,
            webPrice10pc: selected.webPrice10pc ?? null,
            webPrice12pc: selected.webPrice12pc ?? null,
            priceTiers: selected.priceTiers?.map((t) => ({ minQty: t.minQty, unitPrice: t.unitPrice })) ?? null,
        }]);
        analytics.pdpAddLine({ group: slug, sku: selected.websiteSku, qty, tier });
        analytics.cartItemAdded({ sku: selected.graceSku, name: pageTitle(group, fitment), quantity: qty, unitPrice: selected.webPrice1pc, family: group.family, capacity: group.capacity ?? undefined, source: "pdp" });
        setAddedQty(qty);
        setQty(1);
        if (addedTimer.current != null) window.clearTimeout(addedTimer.current);
        addedTimer.current = window.setTimeout(() => setAddedQty(null), ADDED_FLASH_MS);
    }, [selected, addState, tiers, qty, addItems, group, fitment, checkoutReady, slug, activeCap?.name]);

    // ── in this order: the cart's view of this page's lines ───────────────
    const pageSlugs = useMemo(() => new Set([slug, ...siblings.map((sibling) => sibling.slug)]), [slug, siblings]);
    const orderLines = useMemo<OrderLineView[]>(() => cartItems
        .filter((item) => item.productGroupSlug && pageSlugs.has(item.productGroupSlug))
        .map((item) => {
            const rate = resolveQuotedUnitPrice(item.quantity, item) ?? item.unitPrice ?? 0;
            const roller = rollers.find((option) => option.id === rollerIdFor(item.applicator)) ?? null;
            const label = lineLabel(glassShortLabel(item.color), roller, roller ? null : fitmentLabel({ applicator: item.applicator ?? null } as ProductVariant), item.capColor ?? null);
            return {
                key: item.graceSku,
                swatchStyle: getMaterialSwatchStyle(item.capColor, {}),
                label,
                qty: item.quantity,
                total: rate * item.quantity,
                onRemove: () => { removeItem(item.graceSku); analytics.cartItemRemoved({ sku: item.graceSku, name: item.itemName }); },
            };
        }), [cartItems, pageSlugs, rollers, removeItem]);
    const orderTotal = orderLines.reduce((sum, line) => sum + line.total, 0);
    const minimum = useMemo(() => checkoutMinimum(cartItems), [cartItems]);

    // ── copy ──────────────────────────────────────────────────────────────
    const glassName = activeGlass?.shortLabel ?? glassShortLabel(group.color);
    const capName = activeCap?.name ?? null;
    const description = selected?.websiteSku ? descriptions[selected.websiteSku] ?? null : null;
    const title = pageTitle(group, fitment);
    const capacityLabel = `${group.capacityMl != null ? `${group.capacityMl} ml` : group.capacity ?? ""} ${group.family ?? ""}`.trim();
    const bodyKit = kit ?? kitFor(kitsBySku, { websiteSku: group.primaryWebsiteSku, graceSku: group.primaryGraceSku });
    const capKits = caps.map((cap) => kitFor(kitsBySku, cap.variants[0])).filter((entry): entry is KitLike => Boolean(entry));
    const plate = selected ? platesBySku[selected.graceSku] ?? (selected.websiteSku ? platesBySku[selected.websiteSku] : undefined) : undefined;
    const fallbackImage = usableImage(selected?.imageUrl) ?? plate?.image ?? usableImage(group.heroImageUrl) ?? null;
    const swatchStyle = getMaterialSwatchStyle(activeCap?.swatchName ?? capName, {});
    const selectionName = `${glassLabel(group.color)} glass${capName ? ` · ${capName} cap` : fitment ? ` · ${fitment}` : ""}`;
    const stickyLine = `${qty.toLocaleString("en-US")} × ${unitPrice != null ? formatPrice(unitPrice) : "—"} · ${lineLabel(glassName, rollerOption, rollerOption ? null : fitment, capName)}`;

    const onAskGrace = useCallback(() => {
        analytics.graceOpenedFromShopping({ source: "pdp", ...(group.family ? { family: group.family } : {}) });
        openGrace({ source: "pdp" });
    }, [group.family, openGrace]);

    return (
        <main className={`min-h-screen ${styles.page}`} data-pdp-redesign="" data-testid="pdp-redesign">
            <Navbar hideMobileSearch />
            <div className="pt-[104px] sm:pt-[160px] lg:pt-[120px]">
                <nav className={styles.breadcrumb} aria-label="Breadcrumb" data-testid="pdp-breadcrumb">
                    <LocaleLink href="/catalog">Catalog</LocaleLink>{"  ›  "}
                    <LocaleLink href={familyHref}>{group.family}</LocaleLink>{"  ›  "}
                    <span className={styles.breadcrumbCurrent}>{title}</span>
                </nav>

                <div className={styles.grid}>
                    <PdpStage
                        pickLine={pickLine(glassName, rollerOption, rollerOption ? null : fitment, capName)}
                        view={shownView}
                        availableViews={views}
                        onViewChange={onView}
                        kit={kit}
                        context={stageContext}
                        fallbackImageUrl={fallbackImage}
                        fallbackAlt={title}
                        callouts={buildCallouts(selected, capName)}
                        caps={caps.map((cap) => ({
                            id: cap.id, name: cap.name, swatchName: cap.swatchName,
                            kit: kitFor(kitsBySku, cap.variants[0]),
                            unavailable: cap.variants.every((variant) => isSoldOutStockStatus(variant.stockStatus) || variant.shopifySellable === false),
                        }))}
                        activeCapId={activeCap?.id ?? null}
                        onCapPick={onCapPick}
                        glasses={glasses.map((glass) => ({
                            slug: glass.slug, label: glass.label, active: glass.active, kit: glassBodyKit(glass.slug),
                            unavailable: glass.active
                                ? variants.every((variant) => isSoldOutStockStatus(variant.stockStatus) || variant.shopifySellable === false)
                                : siblings.find((sibling) => sibling.slug === glass.slug)?.inStock === false,
                        }))}
                        onGlassPick={onGlassPick}
                        activeCapName={capName}
                        activeGlassLabel={activeGlass?.label ?? glassLabel(group.color)}
                    />

                    <div className={styles.buy}>
                        <div className={styles.titleBlock}>
                            <span className={styles.eyebrow} data-testid="pdp-eyebrow">{capacityEyebrow(group)}</span>
                            <h1 className={styles.title} data-testid="pdp-title">{title}</h1>
                            <span className={styles.status} data-testid="pdp-status">
                                <span className={styles.statusDot} data-out={status.inStock ? "false" : "true"} aria-hidden />
                                {status.text}
                            </span>
                        </div>

                        <PdpBuyBox
                            swatchStyle={swatchStyle}
                            selectionName={selectionName}
                            rollers={rollers}
                            activeRoller={activeRoller}
                            rollerUnitPrice={(id) => unitPriceAt(resolveVariant(variants, { roller: id, cap: picks.cap }), qty)}
                            onRoller={onRoller}
                            tiers={tiers}
                            qty={qty}
                            onQty={(next) => setQty(next)}
                            unitPrice={unitPrice}
                            lineTotal={lineTotal}
                            addState={addState}
                            onAdd={onAdd}
                            addedQty={addedQty}
                            caseQuantity={selected?.caseQuantity ?? null}
                            formatPrice={formatPrice}
                        />

                        <PdpOrderLines lines={orderLines} total={orderTotal} minimum={minimum} formatPrice={formatPrice} />

                        <PdpProductInfo
                            itemType={description?.itemType ?? null}
                            itemName={selected?.websiteSku ?? selected?.graceSku ?? null}
                            description={description?.description ?? null}
                        />

                        <button type="button" className={styles.graceButton} onClick={onAskGrace} data-testid="pdp-ask-grace">Ask Grace about fitment</button>
                    </div>
                </div>

                <PdpBuildStrip
                    capacityLabel={capacityLabel}
                    glassLabel={glassLabel(group.color)}
                    neck={group.neckThreadSize ?? null}
                    bodyKit={bodyKit}
                    fitmentKit={kit}
                    capKits={capKits}
                    href={buildYourBottleHref(group, collection?.band ?? null)}
                />

                <PdpTechSheet rows={techSheetRows(selected, group)} onPrint={() => window.print()} drawing={drawingFor(slug, selected, drawingStyleFromQuery(searchParams.get("drawing")))} />

                {collection && (
                    <PdpCollectionBand band={collection.band} description={collection.description} familyHref={familyHref} familyLabel={group.family} />
                )}

                <PdpStickyBar
                    line={stickyLine}
                    total={lineTotal != null ? formatPrice(lineTotal) : "—"}
                    disabled={addState !== "add"}
                    label={addedQty != null ? "Added" : "Add to cart"}
                    onAdd={onAdd}
                />
            </div>
        </main>
    );
}
