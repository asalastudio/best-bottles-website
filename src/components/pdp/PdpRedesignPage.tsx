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
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import LocaleLink from "@/components/LocaleLink";
import Navbar from "@/components/Navbar";
import { useCart } from "@/components/CartProvider";
import { useRegion } from "@/components/RegionProvider";
import { useGrace } from "@/components/useGrace";
import type { ProductVariant } from "@/app/products/[slug]/ProductDetailClient";
import { analytics } from "@/lib/analytics";
import { checkoutMinimum, isCheckoutReady, isSoldOutStockStatus } from "@/lib/checkout";
import { dispatchPdpContextChange, publishPdpGroup } from "@/lib/grace/pageContextEvents";
import {
    GRACE_PDP_PLATE_EVENT,
    isGracePdpPlateCommand,
    matchListedOption,
    type GracePdpPlateCommand,
} from "@/lib/grace/pdpPlateSwap";
import { isTolaApplicator } from "@/lib/products/tola-applicator";
import { getProductHero, registerCatalogHeroes, type CatalogHeroSubset } from "@/lib/products/catalog-heroes";
import { rectangleApplicatorGlass } from "@/lib/products/rectangle-applicator";
import type { PlateRef } from "@/lib/paper-doll/plates";
import type { ItemDescription } from "@/lib/products/item-description/resolve";
import { getMaterialSwatchBackground, getMaterialSwatchStyle } from "@/lib/products/material-swatches";
import { pdpFallbackMedia } from "@/lib/products/pdp-redesign/fallback-media";
import { SITE_NAME } from "@/lib/seo";
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
    optionLabel,
    pageTitle,
    variantTitle,
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
import { availableViews, finishPart, glassFrame, type KitLike, type StageView } from "@/lib/products/pdp-redesign/stage";
import type { StageBounds } from "@/lib/products/pdp-stage-frame";
import styles from "./pdp.module.css";
import PdpBuyBox, { type AddState } from "./PdpBuyBox";
import PdpStage from "./PdpStage";
import { PdpBuildStrip, PdpCollectionBand, PdpOrderLines, PdpProductInfo, PdpStickyBar, PdpTechSheet, UnbrokenHyphens, type OrderLineView } from "./PdpSections";
import { drawingBodyId, drawingFor, drawingStyleFromQuery } from "@/lib/products/pdp-redesign/drawings";
import { technicalDrawingFor } from "@/lib/products/pdp-redesign/tech-drawing";
import { labelFitFor } from "@/lib/products/pdp-redesign/label-fit";
import { registerImageSrc } from "@/lib/products/register-image";
import { registerDisplayDerivatives, type DisplayDerivativeMap } from "@/lib/products/display-derivative";

export type PdpRedesignPayload = {
    slug: string;
    group: PdpGroup;
    variants: ProductVariant[];
    siblings: SiblingGlassGroup[];
    /** Published kits for this group's variants and each sibling's primary SKU, by website SKU and Grace SKU. */
    kitsBySku: Record<string, KitLike | null>;
    /** For a cap-only group: its glass with a sprayer and with a roller (the strip's fitment tile). */
    fitmentKits?: KitLike[];
    /** By frame key (register body, or one of its hanging tops): the bounds every SKU of the glass needs, on every page it sells on (src/lib/register/stage-envelopes.ts). */
    stageEnvelopes?: Record<string, StageBounds>;
    platesBySku: Record<string, PlateRef>;
    /** Curated or composed copy, by website SKU. */
    descriptions: Record<string, ItemDescription>;
    collection: { band: CollectionBand; description: string } | null;
    familyHref: string;
    /** Delivery copies for every image this payload names (resolved on the server, see display-derivative.server.ts). */
    displayDerivatives?: DisplayDerivativeMap;
    /** Hero rows for the SKUs this payload lists (catalog-heroes.server.ts). */
    catalogHeroes?: CatalogHeroSubset;
};

const ADDED_FLASH_MS = 1800;

/**
 * The finish chip beside the selection name and on each order line: a close crop of the closure's
 * own render (the cap, or a sprayer's overcap), so the chip shows the material the canvas shows
 * (Jordan 2026-09-28). The drawn swatch sits under it while it loads and stands in for a SKU with
 * no drawn closure.
 */
function materialSwatch(kit: KitLike | null | undefined, name: string | null | undefined): CSSProperties {
    // A closure photographed close up stands in for an assembly too wide to read in the chip.
    if (kit?.capCloseUp) return { background: `url("${registerImageSrc(kit.capCloseUp.url, 128)}") 50% 50% / cover no-repeat, #f5f3ef` };
    const part = finishPart(kit);
    if (!part) return getMaterialSwatchStyle(name, {});
    const drawn = getMaterialSwatchBackground(name);
    // The cap's whole face, a hair inside its edges, so a dotted cap's three columns of dots sit inside the circle.
    return { background: `url("${registerImageSrc(part.image.url, 128)}") 50% 50% / 96% auto no-repeat${drawn ? `, ${drawn}` : ""}` };
}

function kitFor(kits: Record<string, KitLike | null>, variant: { websiteSku?: string | null; graceSku?: string | null } | null | undefined): KitLike | null {
    if (!variant) return null;
    return (variant.websiteSku ? kits[variant.websiteSku] : null) ?? (variant.graceSku ? kits[variant.graceSku] : null) ?? null;
}

/** The browser tab follows the pick; the server titled the page for the SKU it rendered. */
function renameTab(text: string): void {
    document.title = text;
}

export default function PdpRedesignPage({ slug, group, variants, siblings, kitsBySku, fitmentKits = [], stageEnvelopes, platesBySku, descriptions, collection, familyHref, displayDerivatives, catalogHeroes }: PdpRedesignPayload) {
    // Before any child resolves an image: the server rendered with the full manifest, the client must agree.
    registerDisplayDerivatives(displayDerivatives);
    registerCatalogHeroes(catalogHeroes);
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
    const [blackDropperPreview, setBlackDropperPreview] = useState(false);
    const [frostedPreview, setFrostedPreview] = useState(false);
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
    const rollerImages = Object.fromEntries(rollers.flatMap((option) => {
        const variant = resolveVariant(variants, { roller: option.id, cap: picks.cap });
        const rollerPart = kitFor(kitsBySku, variant)?.parts.find((part) =>
            part.slot === "roller" && (!part.views || part.views.includes("exploded")));
        return rollerPart?.image.url ? [[option.id, rollerPart.image.url]] : [];
    }));
    const rectangleGlass = rectangleApplicatorGlass(selected?.websiteSku);
    const singleTola = isTolaApplicator(selected?.websiteSku);
    const teardropGlassPicker = /^teardrop-9ml-.*-glassapplicator$/i.test(slug);
    const teardropGlasses = teardropGlassPicker ? glasses.map(glass => ({
        ...glass,
        imageUrl: getProductHero(glass.primaryWebsiteSku ?? (glass.active ? selected?.websiteSku : null))?.url,
        unavailable: glass.active
            ? variants.every(variant => isSoldOutStockStatus(variant.stockStatus) || variant.shopifySellable === false)
            : siblings.find(sibling => sibling.slug === glass.slug)?.inStock === false,
    })) : [];
    const fitment = fitmentLabel(selected);
    // Product copy v2 (scripts/pdp-descriptions/product_copy.py) names the product when it covers this SKU.
    const copy = useMemo(() => (selected?.websiteSku ? descriptions[selected.websiteSku]?.copy ?? null : null), [descriptions, selected?.websiteSku]);
    const title = useMemo(() => copy?.title ?? pageTitle(group, fitment), [copy, group, fitment]);
    const clearKit = singleTola ? null : kitFor(kitsBySku, selected);
    const hasFrostedPreview = slug === "cylinder-28ml-clear-16mm-rollon"
        && clearKit?.parts.some((part) => part.slot === "body"
            && part.image.url === "/reviews/cylinder28-sunburst-2026-11-04/clear-candidate.png");
    const frostedKit: KitLike | null = hasFrostedPreview && clearKit ? {
        ...clearKit,
        parts: clearKit.parts.map((part) => part.slot === "body" ? {
            ...part,
            // Same canvas and visible bounds, using the registered frosted review image box.
            box: { x: 194.1256, y: 211.3608, width: 611.1520, height: 886.5801 },
            image: { ...part.image, url: "/reviews/cylinder28-sunburst-2026-11-04/frosted-candidate.png" },
        } : part),
    } : null;
    const showingFrosted = frostedPreview && frostedKit !== null;
    const goldDropperKit = process.env.NODE_ENV === "development" && slug === "cylinder-25ml-clear-18-415-dropper"
        ? kitsBySku.GBCyl25DrpGl : null;
    const blackDropperKit: KitLike | null = goldDropperKit ? {
        ...goldDropperKit,
        parts: goldDropperKit.parts.map(part => {
            if (part.slot !== "fitment") return part;
            const { left, right, top, bottom } = part.bounds;
            const sx = (right - left) / 926;
            const sy = (bottom - top) / 1530;
            return { ...part,
                image: { url: "/images/cylinder-sprays/dropper25-shiny-black-preview.webp", width: 993, height: 1584 },
                box: { x: left - 31 * sx, y: top - 34 * sy, width: 993 * sx, height: 1584 * sy },
            };
        }),
    } : null;
    const showingBlackDropper = blackDropperPreview && blackDropperKit !== null;
    const kit = showingBlackDropper ? blackDropperKit : showingFrosted ? frostedKit : clearKit;
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
    // One frame for every SKU of the glass, so a cap or fitment swap never resizes it.
    const frame = useMemo(() => glassFrame(
        { kit, applicator: selected?.applicator },
        variants.map((variant) => ({ kit: kitFor(kitsBySku, variant), applicator: variant.applicator })),
        stageEnvelopes,
    ), [kit, selected?.applicator, variants, kitsBySku, stageEnvelopes]);
    // The requested view survives a SKU change; a SKU without layers shows SIDECAR until one returns.
    const shownView: StageView = views.includes(view) ? view : views[0];

    // Grace's configureCurrentProduct lands here as it does on the classic page
    // (ProductDetailClient). Until 2026-09-25 this page had no listener, so the
    // tool reported "Updating the bottle…" and nothing moved.
    useEffect(() => {
        const onCommand = (event: Event) => {
            const command = (event as CustomEvent<GracePdpPlateCommand>).detail;
            if (!isGracePdpPlateCommand(command)) return;
            setPicks((current) => {
                if (command.sku) return derivePicks(variants, group, { sku: command.sku, roller: null, cap: null });
                let next: Picks = { ...current };
                if (command.rollerVariant && rollers.some((option) => option.id === command.rollerVariant)) {
                    next = { ...next, roller: command.rollerVariant as RollerId };
                }
                if (command.capOption) {
                    const options = capOptions(variants, next.roller);
                    const matched = matchListedOption(command.capOption, options.map((option) => option.name));
                    const option = matched ? options.find((candidate) => candidate.name === matched) : null;
                    if (option) next = { ...next, cap: option.id };
                }
                return next;
            });
            // The redesign's views: cap beside (sidecar), cap on, exploded.
            if (command.viewMode === "assembled") setView("capon");
            if (command.viewMode === "capOff") setView("sidecar");
        };
        window.addEventListener(GRACE_PDP_PLATE_EVENT, onCommand);
        return () => window.removeEventListener(GRACE_PDP_PLATE_EVENT, onCommand);
    }, [variants, group, rollers]);

    // A `?sku=` pushed onto the same slug (Grace moving the customer to a sibling
    // variant) must change the picks; the state initialiser only ran once. This
    // is React's "adjust state when a prop changes" pattern, applied in render.
    const requestedSku = searchParams.get("sku");
    const [appliedSku, setAppliedSku] = useState<string | null>(requestedSku);
    if (requestedSku && requestedSku !== appliedSku) {
        setAppliedSku(requestedSku);
        setPicks(derivePicks(variants, group, { sku: requestedSku, roller: null, cap: null }));
    }

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

    // Grace builds her product context from the group this page rendered (no second Convex read).
    useEffect(() => {
        publishPdpGroup({ slug, group, variants });
    }, [slug, group, variants]);

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
        setBlackDropperPreview(id === "shiny-black-preview");
        if (id === "shiny-black-preview") return;
        setPicks((current) => ({ ...current, cap: id }));
        const option = caps.find((cap) => cap.id === id);
        analytics.pdpPick({ group: slug, type: "cap", value: option?.name ?? id, sku: option?.variants[0]?.websiteSku ?? null });
    }, [caps, slug]);

    const onRoller = useCallback((id: RollerId) => {
        setPicks((current) => ({ ...current, roller: id }));
        // On the Clear Tulip, compare the rollers as seated while the cap stays beside the bottle.
        if (views.includes("exploded")) {
            setView(current => slug === "tulip-6ml-clear-13-415-rollon" && current === "sidecar" ? current : "exploded");
        }
        const next = resolveVariant(variants, { roller: id, cap: picks.cap });
        analytics.pdpPick({ group: slug, type: "roller", value: id, sku: next?.websiteSku ?? null });
    }, [views, variants, picks.cap, slug]);

    const onGlassPick = useCallback((targetSlug: string) => {
        const glass = glasses.find((option) => option.slug === targetSlug);
        analytics.pdpPick({ group: slug, type: "glass", value: glass?.label ?? targetSlug, sku: glass?.primaryWebsiteSku ?? null });
        if (targetSlug === slug) return;
        const query = [teardropGlassPicker ? "" : pickQuery(picks, rollers), searchParams.get("assetPreview") === "gpt13" ? "assetPreview=gpt13" : ""].filter(Boolean).join("&");
        router.push(`/products/${targetSlug}${query ? `?${query}` : ""}`, { scroll: false });
    }, [glasses, picks, rollers, router, slug, searchParams, teardropGlassPicker]);

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
    const addState: AddState = (showingFrosted || showingBlackDropper) ? "unavailable" : !selected || selected.webPrice1pc == null || selected.webPrice1pc <= 0
        ? "unpriced"
        : isSoldOutStockStatus(selected.stockStatus) || !status.inStock
            ? "sold-out"
            : checkoutReady ? "add" : "unavailable";

    const onAdd = useCallback(() => {
        if (!selected || addState !== "add") return;
        const tier = tiers.length ? formatVolumeQtyRange(tiers[tiers.reduce((acc, t, i) => (qty >= t.minQty ? i : acc), 0)].minQty, tiers[tiers.reduce((acc, t, i) => (qty >= t.minQty ? i : acc), 0)].maxQty) : null;
        addItems([{
            graceSku: selected.graceSku,
            itemName: title,
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
            color: rectangleGlass ?? group.color ?? undefined,
            applicator: selected.applicator,
            capColor: rectangleGlass ? null : activeCap?.name ?? null,
            category: group.category,
            neckThreadSize: selected.neckThreadSize ?? group.neckThreadSize ?? null,
            webPrice1pc: selected.webPrice1pc ?? null,
            webPrice10pc: selected.webPrice10pc ?? null,
            webPrice12pc: selected.webPrice12pc ?? null,
            priceTiers: selected.priceTiers?.map((t) => ({ minQty: t.minQty, unitPrice: t.unitPrice })) ?? null,
        }]);
        analytics.pdpAddLine({ group: slug, sku: selected.websiteSku, qty, tier });
        analytics.cartItemAdded({ sku: selected.graceSku, name: title, quantity: qty, unitPrice: selected.webPrice1pc, family: group.family, capacity: group.capacity ?? undefined, source: "pdp" });
        setAddedQty(qty);
        setQty(1);
        if (addedTimer.current != null) window.clearTimeout(addedTimer.current);
        addedTimer.current = window.setTimeout(() => setAddedQty(null), ADDED_FLASH_MS);
    }, [selected, addState, tiers, qty, addItems, group, title, checkoutReady, slug, activeCap?.name, rectangleGlass]);

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
                swatchStyle: materialSwatch(kitFor(kitsBySku, item), item.capColor),
                label,
                qty: item.quantity,
                total: rate * item.quantity,
                onRemove: () => { removeItem(item.graceSku); analytics.cartItemRemoved({ sku: item.graceSku, name: item.itemName }); },
            };
        }), [cartItems, pageSlugs, rollers, removeItem, kitsBySku]);
    const orderTotal = orderLines.reduce((sum, line) => sum + line.total, 0);
    const minimum = useMemo(() => checkoutMinimum(cartItems), [cartItems]);

    // ── copy ──────────────────────────────────────────────────────────────
    const glassName = rectangleGlass ?? activeGlass?.shortLabel ?? glassShortLabel(group.color);
    const capName = showingBlackDropper ? "Shiny Black preview" : activeCap?.name ?? null;
    const description = selected?.websiteSku ? descriptions[selected.websiteSku] ?? null : null;
    // The headline names the SKU in the buy box: a new cap, roller or finish changes it with the pick.
    const option = optionLabel(rollerOption, fitment, capName);
    const capacityLabel = `${group.capacityMl != null ? `${group.capacityMl} ml` : group.capacity ?? ""} ${group.family ?? ""}`.trim();
    const bodyKit = clearKit ?? kitFor(kitsBySku, { websiteSku: group.primaryWebsiteSku, graceSku: group.primaryGraceSku });
    const hasMeasuredFiveBody = bodyKit?.parts.some(part => part.slot === "body"
        && part.image.url.includes("/local-kits/cylinder5-profiles-2026-10-31/glass-5-")
        && /-measured-v\d+\.png$/.test(part.image.url));
    // Jordan's October 31 caliper measurements apply only to these local review masters.
    const measuredVariant = rectangleGlass && selected ? { ...selected, color: rectangleGlass }
        : hasMeasuredFiveBody && selected
        ? { ...selected, heightWithoutCap: "53.23 mm", diameter: "17.45 mm" } : selected;
    const measuredCallouts = buildCallouts(measuredVariant, capName).map(callout =>
        hasMeasuredFiveBody && callout.key === "neck"
            ? { ...callout, line2: "12.60 mm crest Ø · 12.00 mm root Ø" } : callout);
    const measuredTechRows = techSheetRows(measuredVariant, group);
    if (hasMeasuredFiveBody) measuredTechRows.push(
        { k: "Shoulder to base", v: "40.10 mm" },
        { k: "Internal depth", v: "48.80 mm" },
        { k: "Rim wall", v: "1.80 mm" },
        { k: "Plain rim diameter (derived)", v: "10.92 mm" },
        { k: "Opening (assumed uniform)", v: "7.32 mm" },
        { k: "Wall at thread crest", v: "2.64 mm" },
    );
    const capKits = caps.map((cap) => kitFor(kitsBySku, cap.variants[0])).filter((entry): entry is KitLike => Boolean(entry));
    const groupKits = variants.map((variant) => kitFor(kitsBySku, variant)).filter((entry): entry is KitLike => Boolean(entry));
    const plate = selected ? platesBySku[selected.graceSku] ?? (selected.websiteSku ? platesBySku[selected.websiteSku] : undefined) : undefined;
    const fallbackMedia = pdpFallbackMedia({
        groupSlug: slug,
        variant: selected,
        plateImageUrl: plate?.image ?? null,
    });
    const swatchStyle = materialSwatch(kit, activeCap?.swatchName ?? capName);
    const selectionName = rectangleGlass ? rectangleGlass + " glass · Glass stopper"
        : glassLabel(group.color) + " glass" + (capName ? " · " + capName + " cap" : fitment ? " · " + fitment : "");
    const stickyLine = `${qty.toLocaleString("en-US")} × ${unitPrice != null ? formatPrice(unitPrice) : "—"} · ${lineLabel(glassName, rollerOption, rollerOption ? null : fitment, capName)}`;

    // The server titles the tab for the SKU it rendered; a pick after that renames the tab with the headline.
    const firstSku = useRef(selected?.websiteSku ?? null);
    useEffect(() => {
        if (!selected?.websiteSku || selected.websiteSku === firstSku.current) return;
        firstSku.current = null;
        renameTab(`${variantTitle(title, option)} | ${SITE_NAME}`);
    }, [selected?.websiteSku, title, option]);

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
                        pickLine={pickLine(showingFrosted ? "Frosted preview" : glassName, rollerOption, rollerOption ? null : fitment, rectangleGlass ? null : capName)}
                        finishKind={rectangleGlass || teardropGlassPicker ? "glass" : "cap"}
                        view={shownView}
                        availableViews={views}
                        onViewChange={onView}
                        kit={kit}
                        context={stageContext}
                        glassFrame={frame}
                        fallbackImageUrls={fallbackMedia.images}
                        fallbackBodyImageUrl={fallbackMedia.bodyImageUrl}
                        fallbackAlt={copy?.altText ?? variantTitle(title, option)}
                        callouts={measuredCallouts}
                        caps={teardropGlassPicker ? teardropGlasses.map(glass => ({
                            id: glass.slug, name: glass.label, swatchName: glass.label, kit: null,
                            imageUrl: glass.imageUrl, unavailable: glass.unavailable,
                        })) : [...caps.map((cap) => ({
                            id: cap.id, name: cap.name, swatchName: cap.swatchName,
                            kit: kitFor(kitsBySku, cap.variants[0]),
                            unavailable: cap.variants.every((variant) => isSoldOutStockStatus(variant.stockStatus) || variant.shopifySellable === false),
                        })), ...(blackDropperKit ? [{
                            id: "shiny-black-preview", name: "Shiny Black preview", swatchName: "Shiny Black", kit: blackDropperKit, unavailable: false,
                        }] : [])]}
                        activeCapId={teardropGlassPicker ? slug : showingBlackDropper ? "shiny-black-preview" : activeCap?.id ?? null}
                        onCapPick={teardropGlassPicker ? onGlassPick : onCapPick}
                        glasses={teardropGlassPicker ? teardropGlasses.map(glass => ({ ...glass, kit: null })) : [...(rectangleGlass || singleTola ? [] : glasses).map((glass) => ({
                            slug: glass.slug, label: glass.label, active: glass.active && !showingFrosted, kit: glass.active ? clearKit ?? glassBodyKit(glass.slug) : glassBodyKit(glass.slug),
                            unavailable: glass.active
                                ? variants.every((variant) => isSoldOutStockStatus(variant.stockStatus) || variant.shopifySellable === false)
                                : siblings.find((sibling) => sibling.slug === glass.slug)?.inStock === false,
                        })), ...(frostedKit ? [{
                            slug: "frosted-preview", label: "Frosted preview", active: showingFrosted, kit: frostedKit,
                        }] : [])]}
                        onGlassPick={(target) => {
                            setFrostedPreview(target === "frosted-preview");
                            if (target !== "frosted-preview") onGlassPick(target);
                        }}
                        activeCapName={capName}
                        activeGlassLabel={showingFrosted ? "Frosted preview" : activeGlass?.label ?? glassLabel(group.color)}
                    />

                    <div className={styles.buy}>
                        <div className={styles.titleBlock}>
                            <span className={styles.eyebrow} data-testid="pdp-eyebrow">{capacityEyebrow(group)}</span>
                            <h1 className={styles.title} data-testid="pdp-title">
                                <UnbrokenHyphens text={title} />
                                {option ? (
                                    <span className={styles.titleOption} data-testid="pdp-title-option">
                                        <span className={styles.visuallyHidden}> - </span>{option}
                                    </span>
                                ) : null}
                            </h1>
                            <span className={styles.status} data-testid="pdp-status">
                                <span className={styles.statusDot} data-out={status.inStock ? "false" : "true"} aria-hidden />
                                {status.text}
                            </span>
                        </div>

                        {showingBlackDropper && <p>Shiny Black with white bulb is a draft finish. Select a listed finish to order.</p>}
                        {showingFrosted && <p>Frosted glass is available to preview. Select Clear to order.</p>}
                        <PdpBuyBox
                            swatchStyle={swatchStyle}
                            selectionName={selectionName}
                            rollers={rollers}
                            activeRoller={activeRoller}
                            rollerImages={rollerImages}
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
                            itemName={showingBlackDropper ? "GBCyl25DrpShnBlk (draft SKU)" : selected?.websiteSku ?? selected?.graceSku ?? null}
                            description={description?.description ?? null}
                            bullets={copy?.bullets ?? null}
                            care={copy?.care || null}
                        />

                        <button type="button" className={styles.graceButton} onClick={onAskGrace} data-testid="pdp-ask-grace">Ask Grace about fitment</button>
                    </div>
                </div>

                {!rectangleGlass && !singleTola && !["Teardrop", "Apothecary"].includes(group.family) && <PdpBuildStrip
                    productPageOnly={["cylinder-3.3ml-clear-12mm-finemist", "cylinder-4ml-clear-12mm-finemist"].includes(slug)}
                    capacityLabel={capacityLabel}
                    glassLabel={glassLabel(group.color)}
                    neck={group.neckThreadSize ?? null}
                    bodyKit={bodyKit}
                    groupKits={groupKits}
                    fitmentKits={fitmentKits}
                    capKits={capKits}
                    href={buildYourBottleHref(group, selected?.websiteSku ?? selected?.graceSku) + (searchParams.get("assetPreview") === "gpt13" ? "&assetPreview=gpt13" : "")}
                />}

                <PdpTechSheet
                    rows={measuredTechRows}
                    pdfHref={hasMeasuredFiveBody ? null : `/api/pdf/tech-sheet/${encodeURIComponent(slug)}${selected?.graceSku ? `?sku=${encodeURIComponent(selected.graceSku)}` : ""}`}
                    drawing={hasMeasuredFiveBody ? null : drawingFor(slug, selected, drawingStyleFromQuery(searchParams.get("drawing")))}
                    technical={hasMeasuredFiveBody ? null : technicalDrawingFor(drawingBodyId(slug))}
                    labelFit={hasMeasuredFiveBody ? null : labelFitFor(drawingBodyId(slug))}
                />

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
