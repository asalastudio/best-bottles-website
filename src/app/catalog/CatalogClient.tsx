"use client";

import { useRegion } from "@/components/RegionProvider";

import { getShopCollection } from "@/lib/shopCollections";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import LocaleLink from "@/components/LocaleLink";
import { useRouter, usePathname } from "next/navigation";
import {
    MagnifyingGlass as Search, X, Package, CaretDown as ChevronDown, CaretUp as ChevronUp,
    SlidersHorizontal, ArrowsDownUp as ArrowUpDown, SquaresFour as LayoutGrid, List, Plus, Minus, ShoppingCart, ChatCircle as MessageCircle, Sparkles,
} from "@/components/icons";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Breadcrumbs from "@/components/Breadcrumbs";
import CatalogProductGrid from "@/components/catalog/CatalogProductGrid";
import { useGrace } from "@/components/useGrace";
import { getCatalogHero, getCatalogHeroProductHref, resolveLiveCatalogCardHero, type CatalogHero } from "@/lib/products/catalog-heroes";
import { isOptimizableImageUrl } from "@/lib/products/optimizable-image";
import CatalogCardPreview from "@/components/catalog/CatalogCardPreview";
import CatalogCardPurchase from "@/components/catalog/CatalogCardPurchase";
import CatalogCapDots, { useCatalogCapPhotos } from "@/components/catalog/CatalogCapDots";
import CatalogFilterSidebar from "@/components/catalog/CatalogFilterSidebar";
import { catalogCardPurchaseOptions, resolveCatalogCardPurchaseVariant } from "@/lib/products/catalog-card-purchase";
import { catalogCapKind } from "@/lib/products/catalog-cap-photos";
import {
    catalogSortMenuOptions,
    catalogFitmentLabel,
    CATALOG_PRODUCT_TYPES,
    productTypeCount,
    APPLICATOR_BUCKETS,
    COMPONENT_CATEGORIES,
    type SortValue,
    type CatalogFilters,
    type ViewMode,
    EMPTY_FILTERS,
    filtersAreEmpty,
    activeFilterCount,
    catalogBreadcrumbSteps,
    filtersToParams,
    paramsToFilters,
    catalogSearchRecoverySuggestions,
} from "@/lib/catalogFilters";
import {
    buildAppliedFilterChips,
    removeCatalogFilterChip,
} from "@/lib/catalogRefineModel";
import {
    getCatalogCardVariantPreviews,
    filterCatalogCardVariants,
    productCardVariantHref,
    type ProductCardVariantPreview,
    type ProductCardVariantPreviewSource,
} from "@/lib/products/product-card-variant-previews";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import { atomizerVariantCardName, expandVariantCards, isVariantCardFamily } from "@/lib/products/variant-cards";
import { isLegacyBestBottlesImageUrl } from "@/lib/productVariantIntegrity";
import { buildCatalogSearchArgs, fetchCatalogSearch } from "@/lib/catalogSearchClient";
import { catalogGroupSkuLabel, mergeCatalogSearchPages, resolveCatalogGroupSku } from "@/lib/catalogSearchFallback";
import { MASTER_CATALOG_SURFACE } from "@/lib/catalogSurface";
import { analytics } from "@/lib/analytics";
import { sendCatalogSearchLog } from "@/lib/catalog/searchLog";
import { describeSuggestion, type InterpretationMode, type InterpretationSuggestion } from "@/lib/catalog/searchSuggestionLabel";
import SearchClosestMatches from "@/components/catalog/SearchClosestMatches";
import { useSearchInterpretation } from "@/components/catalog/useSearchInterpretation";
import { familyGuideHref, isFamilyLandingFamily } from "@/lib/products/focused-shopping";
import { localizeCollectionName, localizeFamilyName, localizeMerchandisingName } from "@/i18n/catalogCopy";
import { localizeHref, stripLocalePrefix } from "@/i18n/paths";
import { useAppLocale, useCopy } from "@/i18n/useCopy";

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;

/** Product type switch labels (title row) and the live-count wording for each. */
const PRODUCT_TYPE_COPY = {
    "Glass Bottle": "typeGlassBottles",
    jars: "typeJars",
    Component: "typeComponents",
    "packaging-more": "typePackagingMore",
} as const satisfies Record<(typeof CATALOG_PRODUCT_TYPES)[number]["value"], string>;
const PRODUCT_TYPE_COUNT_COPY: Partial<Record<string, "countGlassBottles" | "countJars" | "countComponents">> = {
    "Glass Bottle": "countGlassBottles",
    jars: "countJars",
    Component: "countComponents",
};

// CATEGORY_ORDER and COMPONENT_CATEGORIES come from src/lib/catalogFilters.ts —
// the same lists Convex and Grace use.

// ─── Types ───────────────────────────────────────────────────────────────────

interface CatalogGroup {
    _id: string;
    slug: string;
    displayName: string;
    family: string | null;
    capacity: string | null;
    capacityMl: number | null;
    color: string | null;
    rawColor?: string | null;
    canonicalColor?: string | null;
    canonicalColorOptions?: string[];
    dataQualityFlags?: string[];
    category: string;
    bottleCollection: string | null;
    neckThreadSize: string | null;
    variantCount: number;
    priceRangeMin: number | null;
    priceRangeMax: number | null;
    heroImageUrl?: string | null;
    /** Optional paired editorial hover asset, supplied by the hero-image lane. */
    heroHoverImageUrl?: string | null;
    paperDollFamilyKey?: string | null;
    applicatorTypes?: string[] | null;
}

interface CatalogGroupPrimarySku {
    groupId: string;
    websiteSku: string | null;
    graceSku: string | null;
}

interface CatalogGroupVariantPreviewData {
    groupId: string;
    variants: ProductCardVariantPreviewSource[];
}

export interface CatalogSearchResult {
    items: CatalogGroup[];
    facets: Facets;
    totalCount: number;
    nextCursor: string | null;
    primarySkus: CatalogGroupPrimarySku[];
    variantPreviewRows: CatalogGroupVariantPreviewData[];
}

interface Facets {
    categories: Record<string, number>;
    collections: Record<string, number>;
    applicators: Record<string, number>;
    rollerMaterials: Record<"metal" | "plastic", number>;
    families: Record<string, number>;
    colors: Record<string, number>;
    capacities: Record<string, { label: string; ml: number | null; count: number }>;
    neckThreadSizes: Record<string, number>;
    componentTypes: Record<string, number>;
    priceRange: { min: number; max: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── URL Serialization ──────────────────────────────────────────────────────

// ─── Skeleton Components ─────────────────────────────────────────────────────

function SkeletonCard() {
    return (
        <div className="flex h-full flex-col overflow-hidden bg-white animate-pulse">
            <div className="aspect-[10/11] bg-champagne/20 w-full" />
            <div className="p-5 flex flex-col flex-1">
                <div className="h-5 w-3/4 bg-champagne/30 rounded mb-2" />
                <div className="h-5 w-1/2 bg-champagne/30 rounded mb-3" />
                <div className="h-6 w-24 bg-champagne/30 rounded mt-auto" />
            </div>
        </div>
    );
}

function SkeletonGrid() {
    return (
        <CatalogProductGrid>
            {Array.from({ length: 9 }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </CatalogProductGrid>
    );
}

// ─── Product Group Card ──────────────────────────────────────────────────────

function productGroupHref(group: CatalogGroup, applicatorParam?: string | null): string {
    return applicatorParam ? `/products/${group.slug}?applicator=${applicatorParam}` : `/products/${group.slug}`;
}

function isBlockedProductImageUrl(value: string | null | undefined): boolean {
    if (!value) return false;
    if (isLegacyBestBottlesImageUrl(value)) return true;
    try {
        return new URL(value).hostname === "cdn.sanity.io";
    } catch {
        return value.includes("cdn.sanity.io/") || value.includes("www.bestbottles.com/images/store/");
    }
}

function usableProductImageUrl(value: string | null | undefined): string | null {
    const url = value?.trim();
    if (!url || isBlockedProductImageUrl(url)) return null;
    return url;
}

function getShopifyCatalogThumbnail(variant: ProductCardVariantPreviewSource | null | undefined): string | null {
    if (!variant) return null;
    const primary = usableProductImageUrl(variant.imageUrl);
    if (primary) return primary;
    const secondary = usableProductImageUrl(variant.imageUrlCapOff);
    if (secondary) return secondary;
    return null;
}

function getFirstPreviewImageUrl(variantPreviews: ProductCardVariantPreview[] | null | undefined): string | null {
    return variantPreviews?.find((preview) => usableProductImageUrl(preview.imageUrl))?.imageUrl ?? null;
}

function ProductGroupCard({
    group,
    index,
    applicatorParam,
    variantPreviews,
    variantSources,
    thumbnailUrl,
    primaryGraceSku,
    primaryWebsiteSku,
    matchSearch = false,
    catalogHero,
    variantCardName,
}: {
    group: CatalogGroup;
    index: number;
    applicatorParam?: string | null;
    variantPreviews?: ProductCardVariantPreview[];
    /** Raw search rows for the group — carry the price ladder and Shopify sellability the card sells from. */
    variantSources?: ProductCardVariantPreviewSource[];
    displayName?: string;
    thumbnailUrl?: string | null;
    primaryGraceSku?: string | null;
    primaryWebsiteSku?: string | null;
    matchSearch?: boolean;
    catalogHero?: CatalogHero | null;
    /** Set only for one-SKU cards of a variant-card family (e.g. "10 ml Blue Atomizer"). */
    variantCardName?: string | null;
}) {
    const selected = matchSearch ? variantPreviews?.[0] : null;
    const liveCard = resolveLiveCatalogCardHero({
        heroImageUrl: group.heroImageUrl,
        staticHero: catalogHero ?? null,
        variants: (variantSources?.length ? variantSources : variantPreviews) ?? [],
    });
    const displayHero = liveCard.catalogHero;
    const picturedPreview = liveCard.picturedWebsiteSku
        ? { id: liveCard.picturedWebsiteSku, label: liveCard.picturedWebsiteSku, websiteSku: liveCard.picturedWebsiteSku }
        : selected;
    // A one-SKU card always opens its own finish on the PDP, hero or not.
    const variantCardSku = variantCardName ? variantSources?.[0]?.websiteSku ?? null : null;
    const href = displayHero
        ? getCatalogHeroProductHref(displayHero, productGroupHref(group, applicatorParam))
        : productCardVariantHref(
            productGroupHref(group, applicatorParam),
            picturedPreview ?? (variantCardSku ? { id: variantCardSku, label: variantCardSku, websiteSku: variantCardSku } : null),
        );
    const customerDisplayName = variantCardName ?? getCustomerFacingProductName({ group, fallbackName: group.displayName }).displayName;
    const defaultImageUrl =
        liveCard.imageUrl ??
        usableProductImageUrl(group.heroImageUrl) ??
        thumbnailUrl ??
        getFirstPreviewImageUrl(variantPreviews) ??
        null;
    // The card sells exactly the assembly it pictures (hero SKU, else the
    // search-ranked or primary SKU) so quick add and the PDP link agree.
    const picturedSku = liveCard.picturedWebsiteSku ?? selected?.websiteSku ?? selected?.graceSku ?? null;
    const primarySku = primaryWebsiteSku ?? primaryGraceSku ?? null;
    const previews = variantPreviews ?? [];
    const defaultPurchase = resolveCatalogCardPurchaseVariant(variantSources, { picturedSku, primarySku, productTitle: customerDisplayName });
    // Each cap dot sells its own SKU; a dot with no sellable row never swaps the card.
    const capPurchases = catalogCardPurchaseOptions(variantSources, previews, customerDisplayName);
    const defaultSku = defaultPurchase?.websiteSku ?? defaultPurchase?.graceSku ?? picturedSku;
    const defaultCap = previews.find((variant) => defaultSku && (variant.websiteSku === defaultSku || variant.graceSku === defaultSku)) ?? previews[0] ?? null;
    const [pickedCapId, setPickedCapId] = useState<string | null>(null);
    const pickedCap = previews.find((variant) => variant.id === pickedCapId && variant.id !== defaultCap?.id && capPurchases[variant.id]) ?? null;
    const purchaseVariant = pickedCap ? capPurchases[pickedCap.id] : defaultPurchase;
    const capKind = COMPONENT_CATEGORIES.has(group.category) ? null : catalogCapKind(group.applicatorTypes ?? [], previews);
    const capPhoto = useCatalogCapPhotos({ capKind, neck: group.neckThreadSize, variants: previews });
    const showCapDots = previews.length > 1 || (capKind != null && previews.length === 1);

    // {capacity} · {neck} · {glass} · {fitment}, the fitment of the SKU being sold.
    const soldRow = variantSources?.find((row) => purchaseVariant && (row.graceSku === purchaseVariant.graceSku || (row.websiteSku && row.websiteSku === purchaseVariant.websiteSku)));
    const neckLabel = group.neckThreadSize && /^[\w\s./-]{1,14}$/.test(group.neckThreadSize) ? group.neckThreadSize : null;
    const cardSpecs = [
        group.capacityMl != null ? `${group.capacityMl} ml` : group.capacity?.replace(/\s*\([^)]*\)/g, ""),
        neckLabel,
        displayHero?.bottleColor ?? group.color,
        catalogFitmentLabel(soldRow?.applicator ?? purchaseVariant?.applicator, soldRow?.ballMaterial),
    ].filter(Boolean).join(" · ");

    return (
        <motion.article
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: Math.min(index * 0.03, 0.3) }}
            className="group/catalog-card relative flex h-full flex-col bg-white focus-within:z-10 has-[[role=listbox]]:z-20 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#9a7a48] has-[:focus-visible]:outline-offset-[-2px]"
            data-testid="catalog-card"
        >
            <CatalogCardPreview
                title={customerDisplayName}
                catalogHero={displayHero}
                imageUrl={defaultImageUrl}
                heroHoverImageUrl={group.heroHoverImageUrl}
                href={pickedCap ? productCardVariantHref(href, pickedCap) : href}
                variants={previews}
                family={group.family}
                slug={group.slug}
                selected={pickedCap}
            />
            <div className="flex flex-1 flex-col gap-2.5 px-[18px] pb-[18px] pt-3.5">
                <LocaleLink href={pickedCap ? productCardVariantHref(href, pickedCap) : href} className="flex flex-col gap-1 focus-visible:outline-none">
                    <h3 className="text-[15px] font-medium leading-[1.3] text-[#1c1c1e] max-lg:line-clamp-2">{customerDisplayName}</h3>
                    <p data-testid="catalog-card-specs" className="truncate text-[12px] leading-snug text-[#5d6b7e]">{cardSpecs}</p>
                </LocaleLink>
                {showCapDots && (
                    <CatalogCapDots
                        title={customerDisplayName}
                        variants={previews}
                        selectedId={pickedCap?.id ?? defaultCap?.id ?? null}
                        onSelect={(variant) => setPickedCapId(variant.id)}
                        photo={capPhoto}
                    />
                )}
                <CatalogCardPurchase
                    productId={group.slug}
                    title={customerDisplayName}
                    href={href}
                    variant={purchaseVariant}
                    groupStartingPrice={group.priceRangeMin}
                    context={{
                        family: group.family,
                        capacity: group.capacity,
                        color: group.color,
                        category: group.category,
                        neckThreadSize: group.neckThreadSize,
                    }}
                />
            </div>
        </motion.article>
    );
}

// ─── View Toggle ─────────────────────────────────────────────────────────────

function ViewToggle({
    value,
    onChange,
    labels = { visual: "Visual", line: "Line items" },
}: {
    value: ViewMode;
    onChange: (v: ViewMode) => void;
    labels?: { visual: string; line: string };
}) {
    const option = (mode: ViewMode, label: string, ariaLabel: string, Icon: typeof LayoutGrid) => (
        <button
            type="button"
            onClick={() => onChange(mode)}
            className={`flex min-h-10 min-w-10 items-center justify-center gap-1.5 px-3 text-[12px] transition-colors lg:min-h-[32px] ${value === mode
                ? "bg-[#1c1c1e] text-white"
                : "bg-white text-[#1c1c1e] hover:bg-[#f1ebe0]"
                }`}
            aria-label={ariaLabel}
            aria-pressed={value === mode}
        >
            <Icon className="h-3.5 w-3.5 sm:hidden" aria-hidden />
            <span className="hidden whitespace-nowrap sm:inline">{label}</span>
        </button>
    );
    return (
        <div className="inline-flex shrink-0 items-stretch overflow-hidden rounded-md border border-[#d9cdb9]" role="group" aria-label="Catalog view">
            {option("visual", labels.visual, "Visual grid view", LayoutGrid)}
            {option("line", labels.line, "Line item view", List)}
        </div>
    );
}

// ─── Line Item Row (Desktop) ─────────────────────────────────────────────────

function lineItemProductHref({
    slug,
    applicatorParam,
    quantity,
    sku,
}: {
    slug: string;
    applicatorParam?: string | null;
    quantity: number;
    sku?: string | null;
}): string {
    const params = new URLSearchParams();
    if (applicatorParam) params.set("applicator", applicatorParam);
    if (sku && sku !== "—") params.set("sku", sku);
    if (quantity > 1) params.set("qty", String(quantity));
    const qs = params.toString();
    return `/products/${slug}${qs ? `?${qs}` : ""}`;
}

function LineItemRow({
    group,
    sku,
    index,
    applicatorParam,
    thumbnailUrl,
    displayName,
    primaryGraceSku,
    primaryWebsiteSku,
}: {
    group: CatalogGroup;
    sku: string;
    index: number;
    applicatorParam?: string | null;
    thumbnailUrl?: string | null;
    displayName?: string;
    primaryGraceSku?: string | null;
    primaryWebsiteSku?: string | null;
}) {
    const { formatPrice: money } = useRegion();
    const formatPrice = (price: number | null | undefined): string => (price ? money(price) : "—");
    const [quantity, setQuantity] = useState(1);
    const customerDisplayName = displayName ?? getCustomerFacingProductName({ group, fallbackName: group.displayName }).displayName;
    const href = lineItemProductHref({
        slug: group.slug,
        applicatorParam,
        quantity,
        sku: primaryWebsiteSku || sku,
    });

    const incrementQty = () => setQuantity((q) => Math.min(q + 1, 9999));
    const decrementQty = () => setQuantity((q) => Math.max(q - 1, 1));

    return (
        <motion.tr
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: Math.min(index * 0.02, 0.3) }}
            className="border-b border-champagne/30 hover:bg-travertine/50 transition-colors group"
        >
            {/* Image + Name */}
            <td className="py-3 px-4">
                <LocaleLink href={href} className="flex items-center gap-4">
                    <div
                        className="w-14 h-14 shrink-0 bg-travertine rounded border border-champagne/40 flex items-center justify-center overflow-hidden relative"
                        data-bb-image-audit="catalog-line-item"
                        data-bb-family={group.family ?? undefined}
                        data-bb-product-group-slug={group.slug}
                        data-bb-grace-sku={primaryGraceSku ?? undefined}
                        data-bb-website-sku={primaryWebsiteSku ?? sku}
                    >
                        {thumbnailUrl ? (
                            <Image
                                src={thumbnailUrl}
                                alt={customerDisplayName}
                                fill
                                data-bb-image-audit="catalog-line-item"
                                data-bb-family={group.family ?? undefined}
                                data-bb-product-group-slug={group.slug}
                                data-bb-grace-sku={primaryGraceSku ?? undefined}
                                data-bb-website-sku={primaryWebsiteSku ?? sku}
                                className="object-contain p-1"
                                sizes="56px"
                                unoptimized={!isOptimizableImageUrl(thumbnailUrl)}
                            />
                        ) : (
                            <Package className="w-6 h-6 text-champagne" strokeWidth={1} />
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] text-muted-gold uppercase tracking-wider font-bold mb-0.5">
                            {group.category}
                        </p>
                        <p className="font-serif text-sm text-obsidian font-medium leading-snug group-hover:text-muted-gold transition-colors truncate max-w-[280px]">
                            {customerDisplayName}
                        </p>
                        {group.family && (
                            <p className="text-[10px] text-slate">{group.family}</p>
                        )}
                    </div>
                </LocaleLink>
            </td>

            {/* Capacity */}
            <td className="py-3 px-4 text-left">
                <span className="text-xs text-obsidian font-mono">{sku}</span>
            </td>

            {/* Capacity */}
            <td className="py-3 px-4 text-center">
                <span className="text-xs text-obsidian">
                    {group.capacity && group.capacity !== "0 ml (0 oz)" ? group.capacity : "—"}
                </span>
            </td>

            {/* Color */}
            <td className="py-3 px-4 text-center">
                <span className="text-xs text-obsidian">{group.color || "—"}</span>
            </td>

            {/* Thread */}
            <td className="py-3 px-4 text-center">
                <span className="text-xs text-obsidian">{group.neckThreadSize || "—"}</span>
            </td>

            {/* Variants */}
            <td className="py-3 px-4 text-center">
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-full bg-obsidian/10 text-obsidian">
                    {group.variantCount}
                </span>
            </td>

            {/* Price */}
            <td className="py-3 px-4 text-right">
                <div className="flex flex-col items-end">
                    <span className="text-xs text-slate">from</span>
                    <span className="font-semibold text-obsidian">
                        {formatPrice(group.priceRangeMin)}
                    </span>
                </div>
            </td>

            {/* Actions */}
            <td className="py-3 px-4">
                <div className="flex items-center justify-end gap-2">
                    <div className="flex items-center border border-champagne rounded-lg bg-white">
                        <button
                            type="button"
                            onClick={decrementQty}
                            className="min-h-11 min-w-11 flex items-center justify-center hover:bg-travertine transition-colors rounded-l-lg"
                            aria-label="Decrease quantity"
                        >
                            <Minus className="w-3 h-3 text-slate" />
                        </button>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, Math.min(9999, parseInt(e.target.value) || 1)))}
                            className="w-10 text-center text-xs font-medium text-obsidian bg-transparent border-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min={1}
                            max={9999}
                        />
                        <button
                            type="button"
                            onClick={incrementQty}
                            className="min-h-11 min-w-11 flex items-center justify-center hover:bg-travertine transition-colors rounded-r-lg"
                            aria-label="Increase quantity"
                        >
                            <Plus className="w-3 h-3 text-slate" />
                        </button>
                    </div>
                    <LocaleLink
                        href={href}
                        className="px-3 py-1.5 bg-obsidian text-white text-[10px] uppercase font-bold tracking-wider rounded hover:bg-muted-gold transition-colors flex items-center gap-1"
                    >
                        <ShoppingCart className="w-3 h-3" />
                        View
                    </LocaleLink>
                </div>
            </td>
        </motion.tr>
    );
}

// ─── Line Item Mobile Card ───────────────────────────────────────────────────

function LineItemMobileCard({
    group,
    sku,
    index,
    applicatorParam,
    thumbnailUrl,
    displayName,
    primaryGraceSku,
    primaryWebsiteSku,
}: {
    group: CatalogGroup;
    sku: string;
    index: number;
    applicatorParam?: string | null;
    thumbnailUrl?: string | null;
    displayName?: string;
    primaryGraceSku?: string | null;
    primaryWebsiteSku?: string | null;
}) {
    const { formatPrice: money } = useRegion();
    const formatPrice = (price: number | null | undefined): string => (price ? money(price) : "—");
    const [expanded, setExpanded] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const customerDisplayName = displayName ?? getCustomerFacingProductName({ group, fallbackName: group.displayName }).displayName;
    const href = lineItemProductHref({
        slug: group.slug,
        applicatorParam,
        quantity,
        sku: primaryWebsiteSku || sku,
    });

    const incrementQty = () => setQuantity((q) => Math.min(q + 1, 9999));
    const decrementQty = () => setQuantity((q) => Math.max(q - 1, 1));
    const cardSpecs = [
        group.capacityMl != null ? `${group.capacityMl} ml` : group.capacity?.replace(/\s*\([^)]*\)/g, ""),
        group.neckThreadSize,
        group.color,
    ].filter(Boolean).join(" · ");

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: Math.min(index * 0.02, 0.3) }}
            className="bg-white border border-champagne/40 overflow-hidden"
        >
            <div className="flex items-stretch gap-3 p-3">
                <LocaleLink
                    href={href}
                    className="relative block h-[112px] w-[112px] shrink-0 overflow-hidden bg-[#f0ebe3]"
                    aria-label={`View ${customerDisplayName}`}
                    data-bb-image-audit="catalog-mobile-line-item"
                    data-bb-family={group.family ?? undefined}
                    data-bb-product-group-slug={group.slug}
                    data-bb-grace-sku={primaryGraceSku ?? undefined}
                    data-bb-website-sku={primaryWebsiteSku ?? sku}
                >
                    {thumbnailUrl ? (
                        <Image
                            src={thumbnailUrl}
                            alt={customerDisplayName}
                            fill
                            className="object-contain"
                            sizes="112px"
                            unoptimized={!isOptimizableImageUrl(thumbnailUrl)}
                            priority={index === 0}
                        />
                    ) : (
                        <span className="flex h-full items-center justify-center">
                            <Package className="h-8 w-8 text-champagne" strokeWidth={1} />
                        </span>
                    )}
                </LocaleLink>

                <div className="flex min-w-0 flex-1 flex-col">
                    <LocaleLink href={href} className="min-w-0">
                        <p className="line-clamp-2 whitespace-normal break-words text-[15px] font-medium leading-tight text-obsidian hover:text-muted-gold">
                            {customerDisplayName}
                        </p>
                    </LocaleLink>
                    {cardSpecs && (
                        <p className="mt-1 truncate text-[12px] leading-snug text-slate">{cardSpecs}</p>
                    )}
                    <p className="mt-1 text-[15px] font-medium leading-tight text-obsidian">
                        From {formatPrice(group.priceRangeMin)}
                        <span className="text-sm font-normal text-slate">/ea</span>
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                        <p className="text-[12px] leading-tight text-slate">
                            {group.variantCount}{" "}
                            {COMPONENT_CATEGORIES.has(group.category)
                                ? `variant${group.variantCount === 1 ? "" : "s"}`
                                : `cap option${group.variantCount === 1 ? "" : "s"}`}
                        </p>
                        <div className="flex items-center gap-1">
                            <LocaleLink
                                href={href}
                                className="flex h-11 w-11 items-center justify-center bg-obsidian text-white"
                                aria-label={`View ${customerDisplayName}`}
                            >
                                <ShoppingCart className="h-4 w-4" aria-hidden />
                            </LocaleLink>
                            <button
                                onClick={() => setExpanded(!expanded)}
                                className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-travertine transition-colors"
                                aria-expanded={expanded}
                                aria-label={expanded ? "Collapse details" : "Expand details"}
                            >
                                <ChevronDown
                                    className={`h-4 w-4 text-slate transition-transform ${expanded ? "rotate-180" : ""}`}
                                />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Expanded Details */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 pt-1 border-t border-champagne/30">
                            {/* Specs Grid */}
                            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                                <div className="bg-bone rounded px-2 py-1.5">
                                    <p className="text-[9px] text-slate uppercase tracking-wider mb-0.5">Capacity</p>
                                    <p className="text-xs text-obsidian font-medium">
                                        {group.capacity && group.capacity !== "0 ml (0 oz)" ? group.capacity : "—"}
                                    </p>
                                </div>
                                <div className="bg-bone rounded px-2 py-1.5">
                                    <p className="text-[9px] text-slate uppercase tracking-wider mb-0.5">Color</p>
                                    <p className="text-xs text-obsidian font-medium">{group.color || "—"}</p>
                                </div>
                                <div className="bg-bone rounded px-2 py-1.5">
                                    <p className="text-[9px] text-slate uppercase tracking-wider mb-0.5">Thread</p>
                                    <p className="text-xs text-obsidian font-medium">{group.neckThreadSize || "—"}</p>
                                </div>
                            </div>

                            {/* Actions Row */}
                            <div className="flex items-center gap-2">
                                {/* Quantity */}
                                <div className="flex items-center border border-champagne rounded-lg bg-bone">
                                    <button
                                        type="button"
                                        onClick={decrementQty}
                                        className="p-2 hover:bg-champagne/30 transition-colors rounded-l-lg"
                                        aria-label="Decrease quantity"
                                    >
                                        <Minus className="w-3 h-3 text-slate" />
                                    </button>
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={(e) => setQuantity(Math.max(1, Math.min(9999, parseInt(e.target.value) || 1)))}
                                        className="w-10 text-center text-xs font-medium text-obsidian bg-transparent border-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        min={1}
                                        max={9999}
                                    />
                                    <button
                                        type="button"
                                        onClick={incrementQty}
                                        className="p-2 hover:bg-champagne/30 transition-colors rounded-r-lg"
                                        aria-label="Increase quantity"
                                    >
                                        <Plus className="w-3 h-3 text-slate" />
                                    </button>
                                </div>

                                {/* View/Add Button */}
                                <LocaleLink
                                    href={href}
                                    className="flex-1 py-2.5 bg-obsidian text-white text-xs uppercase font-bold tracking-wider text-center rounded-lg hover:bg-muted-gold transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <ShoppingCart className="w-3.5 h-3.5" />
                                    View & Configure
                                </LocaleLink>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─── Line Item Table (Desktop) ───────────────────────────────────────────────

function LineItemTable({
    groups,
    skuMap,
    applicatorParam,
    thumbnailMap,
    displayNameMap,
    primarySkuMetaMap,
}: {
    groups: CatalogGroup[];
    skuMap: Map<string, string>;
    applicatorParam?: string | null;
    thumbnailMap?: Map<string, string>;
    displayNameMap?: Map<string, string>;
    primarySkuMetaMap?: Map<string, CatalogGroupPrimarySku>;
}) {
    return (
        <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[980px]">
                <thead>
                    <tr className="border-b-2 border-obsidian">
                        <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold text-slate">
                            Product
                        </th>
                        <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold text-slate">
                            SKU
                        </th>
                        <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold text-slate">
                            Capacity
                        </th>
                        <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold text-slate">
                            Color
                        </th>
                        <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold text-slate">
                            Thread
                        </th>
                        <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold text-slate">
                            Variants
                        </th>
                        <th className="py-3 px-4 text-right text-[10px] uppercase tracking-wider font-bold text-slate">
                            Price
                        </th>
                        <th className="py-3 px-4 text-right text-[10px] uppercase tracking-wider font-bold text-slate">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {groups.map((group, idx) => (
                        <LineItemRow
                            key={group._id}
                            group={group}
                            sku={skuMap.get(group._id) ?? "—"}
                            index={idx}
                            applicatorParam={applicatorParam}
                            thumbnailUrl={thumbnailMap?.get(group._id)}
                            displayName={displayNameMap?.get(group._id)}
                            primaryGraceSku={primarySkuMetaMap?.get(group._id)?.graceSku}
                            primaryWebsiteSku={primarySkuMetaMap?.get(group._id)?.websiteSku}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Line Item Grid (Mobile) ─────────────────────────────────────────────────

function LineItemMobileGrid({
    groups,
    skuMap,
    applicatorParam,
    thumbnailMap,
    displayNameMap,
    primarySkuMetaMap,
}: {
    groups: CatalogGroup[];
    skuMap: Map<string, string>;
    applicatorParam?: string | null;
    thumbnailMap?: Map<string, string>;
    displayNameMap?: Map<string, string>;
    primarySkuMetaMap?: Map<string, CatalogGroupPrimarySku>;
}) {
    return (
        <div className="space-y-3">
            {groups.map((group, idx) => (
                <LineItemMobileCard
                    key={group._id}
                    group={group}
                    sku={skuMap.get(group._id) ?? "—"}
                    index={idx}
                    applicatorParam={applicatorParam}
                    thumbnailUrl={thumbnailMap?.get(group._id)}
                    displayName={displayNameMap?.get(group._id)}
                    primaryGraceSku={primarySkuMetaMap?.get(group._id)?.graceSku}
                    primaryWebsiteSku={primarySkuMetaMap?.get(group._id)?.websiteSku}
                />
            ))}
        </div>
    );
}

// ─── Back to Top Button ──────────────────────────────────────────────────────

function BackToTop() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > 800);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <AnimatePresence>
            {visible && (
                <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="fixed bottom-6 left-6 z-40 w-10 h-10 rounded-full bg-obsidian text-bone flex items-center justify-center shadow-xl hover:bg-muted-gold transition-colors max-xl:bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))]"
                    aria-label="Back to top"
                >
                    <ChevronUp className="w-5 h-5" />
                </motion.button>
            )}
        </AnimatePresence>
    );
}

// ─── Main Catalog Content ────────────────────────────────────────────────────

export default function CatalogClient({
    initialSearchParams,
    initialResult,
    interpretMode = "off",
}: {
    initialSearchParams: string;
    initialResult: CatalogSearchResult;
    /** CATALOG_SEARCH_INTERPRETATION, read on the server (src/lib/catalog/searchInterpretationServer.ts). */
    interpretMode?: InterpretationMode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const locale = useAppLocale();
    const t = useCopy("catalog");
    const sortLabel = (value: SortValue) => {
        switch (value) {
            case "featured": return t("sortFeatured");
            case "best-match": return t("sortBestMatch");
            case "price-asc": return t("sortPriceAsc");
            case "price-desc": return t("sortPriceDesc");
            case "name-asc": return t("sortNameAsc");
            case "name-desc": return t("sortNameDesc");
            case "capacity-asc": return t("sortCapacityAsc");
            case "capacity-desc": return t("sortCapacityDesc");
            case "variants-desc": return t("sortVariantsDesc");
            default: return value;
        }
    };
    const searchParams = useMemo(() => new URLSearchParams(initialSearchParams), [initialSearchParams]);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const { open: openGrace } = useGrace();

    const isGraceNav = searchParams.get("grace") === "1";
    const [graceBannerDismissed, setGraceBannerDismissed] = useState(false);

    const initialState = paramsToFilters(searchParams);

    const [filters, setFilters] = useState<CatalogFilters>(initialState.filters);
    const [sortBy, setSortBy] = useState<SortValue>(initialState.sort);
    const [viewMode, setViewMode] = useState<ViewMode>(initialState.view);
    const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
    const [searchInput, setSearchInput] = useState(initialState.filters.search);
    const [rawResult, setActiveResult] = useState<CatalogSearchResult>(initialResult);
    // Atomizer finishes read as separate products: one card per SKU (see variant-cards.ts).
    const activeResult = useMemo(() => expandVariantCards(rawResult), [rawResult]);
    const [isFetchingCatalog, setIsFetchingCatalog] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [queryError, setQueryError] = useState<string | null>(null);
    const [retryNonce, setRetryNonce] = useState(0);
    const catalogGenerationRef = useRef(0);
    const loadMoreLockRef = useRef(false);
    const loadMoreAbortRef = useRef<AbortController | null>(null);
    // "Closest matches": the last query typed in this page's box (suggest only),
    // the last one submitted with Enter, and queries the shopper undid.
    const typedSearchRef = useRef<string | null>(null);
    const submittedSearchRef = useRef<string | null>(null);
    const [declinedInterpretations, setDeclinedInterpretations] = useState<ReadonlySet<string>>(() => new Set());

    // Sync externally-driven URL changes (including Grace) into the live grid.
    // Local state is intentional for responsive interactions, but the URL is
    // the authoritative cross-surface contract.
    useEffect(() => {
        const urlState = paramsToFilters(new URLSearchParams(initialSearchParams));
        setFilters(urlState.filters); // eslint-disable-line react-hooks/set-state-in-effect
        setSortBy(urlState.sort);
        setViewMode(urlState.view);
        setSearchInput(urlState.filters.search);
        setActiveResult(initialResult);
        setIsLoadingMore(false);
    }, [initialSearchParams, initialResult]);

    // Sync URL when filters/sort/view change
    const pushToUrl = useCallback(
        (f: CatalogFilters, s: SortValue, v: ViewMode) => {
            const params = filtersToParams(f, s, v);
            if (filtersAreEmpty(f)) params.set("scope", "all");
            const qs = params.toString();
            const path = localizeHref(locale, stripLocalePrefix(pathname));
            router.push(`${path}${qs ? `?${qs}` : ""}`, { scroll: false });
        },
        [router, pathname, locale],
    );

    // Lock body scroll for mobile filter
    useEffect(() => {
        document.body.style.overflow = mobileFilterOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [mobileFilterOpen]);

    // The drawer is a modal dialog: Escape closes it.
    useEffect(() => {
        if (!mobileFilterOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setMobileFilterOpen(false);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [mobileFilterOpen]);

    // ── Results ─────────────────────────────────────────────────────────────
    const filtered = activeResult.items;
    const facets = activeResult.facets;
    const totalCount = activeResult.totalCount;
    const visibleProducts = filtered;

    // Search-box log (src/lib/catalog/searchLog.ts): one entry once a query has
    // settled for 2 s, so half-typed words are not counted. Grace-driven
    // navigations are Grace's searches, not the shopper's typing.
    const loggedSearchRef = useRef<string | null>(null);
    useEffect(() => {
        const query = filters.search.trim();
        if (!query || isGraceNav || isFetchingCatalog) return;
        const key = `${locale}:${query.toLowerCase()}`;
        if (loggedSearchRef.current === key) return;
        const timer = window.setTimeout(() => {
            loggedSearchRef.current = key;
            sendCatalogSearchLog({ query, locale, event: { kind: "search", resultCount: totalCount } });
            analytics.catalogFiltered({
                searchTerm: query,
                resultCount: totalCount,
                families: filters.families.join(",") || undefined,
                applicators: filters.applicators.join(",") || undefined,
            });
        }, 2000);
        return () => window.clearTimeout(timer);
    }, [filters.search, filters.families, filters.applicators, isFetchingCatalog, totalCount, locale, isGraceNav]);
    const visualApplicatorParam = filters.applicators.length === 1 ? filters.applicators[0] : null;
    const variantPreviewRows = activeResult.variantPreviewRows;
    const variantSourceMap = useMemo(
        () => new Map(variantPreviewRows.map((row) => [row.groupId, filterCatalogCardVariants(row.variants, filters.rollerMaterials)])),
        [variantPreviewRows, filters.rollerMaterials],
    );
    const catalogHeroMap = useMemo(() => {
        return new Map(visibleProducts.map((group) => [group._id, getCatalogHero(group.slug, variantSourceMap.get(group._id) ?? [], filters.search)]));
    }, [variantSourceMap, visibleProducts, filters.search]);
    const skuMap = useMemo(() => {
        const next = new Map<string, string>();
        const groupIds = new Set<string>();
        for (const row of activeResult.primarySkus ?? []) groupIds.add(row.groupId);
        for (const row of activeResult.variantPreviewRows ?? []) groupIds.add(row.groupId);
        for (const group of activeResult.items) groupIds.add(group._id);
        for (const groupId of groupIds) {
            next.set(
                groupId,
                catalogGroupSkuLabel(
                    resolveCatalogGroupSku(
                        groupId,
                        activeResult.primarySkus ?? [],
                        activeResult.variantPreviewRows ?? [],
                    ),
                ),
            );
        }
        return next;
    }, [activeResult.items, activeResult.primarySkus, activeResult.variantPreviewRows]);
    const primarySkuMetaMap = useMemo(() => {
        const next = new Map<string, CatalogGroupPrimarySku>();
        const groupIds = new Set<string>();
        for (const row of activeResult.primarySkus ?? []) groupIds.add(row.groupId);
        for (const row of activeResult.variantPreviewRows ?? []) groupIds.add(row.groupId);
        for (const group of activeResult.items) groupIds.add(group._id);
        for (const groupId of groupIds) {
            next.set(
                groupId,
                resolveCatalogGroupSku(
                    groupId,
                    activeResult.primarySkus ?? [],
                    activeResult.variantPreviewRows ?? [],
                ),
            );
        }
        return next;
    }, [activeResult.items, activeResult.primarySkus, activeResult.variantPreviewRows]);
    const variantPreviewMap = useMemo(() => {
        const groupById = new Map(visibleProducts.map((group) => [group._id, group]));
        const next = new Map<string, ProductCardVariantPreview[]>();

        for (const row of variantPreviewRows ?? []) {
            const group = groupById.get(row.groupId);
            if (!group) continue;
            const href = productGroupHref(group, visualApplicatorParam);
            const representativeVariant =
                row.variants.find((variant) => variant.websiteSku === skuMap.get(group._id) || variant.graceSku === skuMap.get(group._id)) ??
                row.variants[0] ??
                null;
            const customerDisplayName = localizeMerchandisingName(locale, {
                displayName: getCustomerFacingProductName({
                    group,
                    variant: representativeVariant,
                    fallbackName: group.displayName,
                }).displayName,
                family: group.family,
                slug: group.slug,
            });
            next.set(
                row.groupId,
                getCatalogCardVariantPreviews(row.variants, {
                    search: filters.search,
                    rollerMaterials: filters.rollerMaterials,
                    primarySku: catalogHeroMap.get(group._id)?.websiteSku ?? skuMap.get(group._id),
                    productTitle: customerDisplayName,
                    defaultImageUrl: group.heroImageUrl,
                    groupColor: group.color,
                    productHref: href,
                }),
            );
        }

        return next;
    }, [variantPreviewRows, visibleProducts, visualApplicatorParam, skuMap, catalogHeroMap, filters.search, filters.rollerMaterials, locale]);
    const catalogThumbnailMap = useMemo(() => {
        const groupById = new Map(visibleProducts.map((group) => [group._id, group]));
        const next = new Map<string, string>();

        for (const row of variantPreviewRows ?? []) {
            const group = groupById.get(row.groupId);
            if (!group) continue;
            const primarySku = skuMap.get(group._id);
            const representativeVariant =
                row.variants.find((variant) => variant.websiteSku === primarySku || variant.graceSku === primarySku) ??
                row.variants.find((variant) => getShopifyCatalogThumbnail(variant)) ??
                null;
            const thumbnailUrl = getShopifyCatalogThumbnail(representativeVariant);
            if (thumbnailUrl) next.set(row.groupId, thumbnailUrl);
        }

        return next;
    }, [variantPreviewRows, visibleProducts, skuMap]);
    const customerNameMap = useMemo(() => {
        const groupById = new Map(visibleProducts.map((group) => [group._id, group]));
        const next = new Map<string, string>();

        for (const row of variantPreviewRows ?? []) {
            const group = groupById.get(row.groupId);
            if (!group) continue;
            const representativeVariant =
                row.variants.find((variant) => variant.websiteSku === skuMap.get(group._id) || variant.graceSku === skuMap.get(group._id)) ??
                row.variants[0] ??
                null;
            next.set(row.groupId, localizeMerchandisingName(locale, {
                displayName: getCustomerFacingProductName({
                    group,
                    variant: representativeVariant,
                    fallbackName: group.displayName,
                }).displayName,
                family: group.family,
                slug: group.slug,
            }));
        }

        for (const group of visibleProducts) {
            if (!next.has(group._id)) {
                next.set(group._id, localizeMerchandisingName(locale, {
                    displayName: getCustomerFacingProductName({ group, fallbackName: group.displayName }).displayName,
                    family: group.family,
                    slug: group.slug,
                }));
            }
        }

        return next;
    }, [variantPreviewRows, visibleProducts, skuMap, locale]);
    const variantCardNameMap = useMemo(() => {
        const next = new Map<string, string>();
        for (const group of visibleProducts) {
            if (!isVariantCardFamily(group.family)) continue;
            const variants = variantSourceMap.get(group._id) ?? [];
            if (variants.length !== 1) continue;
            // Production's leftover Slim group has no capacity; the approved hero records it.
            const name = atomizerVariantCardName(group.capacityMl ?? catalogHeroMap.get(group._id)?.capacityMl, variants[0]);
            if (name) next.set(group._id, name);
        }
        return next;
    }, [visibleProducts, variantSourceMap, catalogHeroMap]);
    const hasMore = activeResult.nextCursor != null;
    const isLoading = isFetchingCatalog && activeResult.items.length === 0;
    const searchRecoverySuggestions = useMemo(
        () => catalogSearchRecoverySuggestions(filters.search),
        [filters.search],
    );

    // "Closest matches" when a search finds nothing (flag: CATALOG_SEARCH_INTERPRETATION).
    const interpretedFrom = searchParams.get("interpreted");
    const interpretation = useSearchInterpretation({
        mode: interpretMode,
        allowed: !isGraceNav && locale === "en" && searchParams.get("interpret") !== "off",
        query: filters.search,
        searchInput,
        filters,
        noResults: !isFetchingCatalog && activeResult.items.length === 0 && totalCount === 0,
        locale,
        declined: declinedInterpretations,
    });

    const handleApplyInterpretation = useCallback(
        (suggestion: InterpretationSuggestion) => {
            sendCatalogSearchLog({ query: interpretation.query, locale, event: { kind: "suggestion_click", label: suggestion.label } });
            const next: CatalogFilters = { ...EMPTY_FILTERS, ...suggestion.filters, search: "" };
            clearTimeout(searchDebounceRef.current);
            setSearchInput("");
            setSortBy("capacity-asc");
            setFilters(next);
            pushToUrl(next, "capacity-asc", viewMode);
            window.scrollTo({ top: 0, behavior: "smooth" });
        },
        [interpretation.query, locale, pushToUrl, viewMode],
    );

    // Auto mode applies a confident reading for searches that arrived from the
    // header, the homepage or Enter — never for words still being typed here.
    useEffect(() => {
        if (interpretation.status !== "ready" || interpretation.mode !== "auto") return;
        const top = interpretation.suggestions[0];
        const query = interpretation.query;
        if (!top?.autoEligible) return;
        if (typedSearchRef.current === query && submittedSearchRef.current !== query) return;
        const params = filtersToParams({ ...EMPTY_FILTERS, ...top.filters, search: "" }, "capacity-asc", viewMode);
        params.set("interpreted", query);
        router.replace(`${localizeHref(locale, stripLocalePrefix(pathname))}?${params.toString()}`, { scroll: false });
    }, [interpretation, viewMode, router, locale, pathname]);

    const handleUndoInterpretation = useCallback(() => {
        if (!interpretedFrom) return;
        setDeclinedInterpretations((prev) => new Set(prev).add(interpretedFrom.trim().toLowerCase()));
        const params = filtersToParams({ ...EMPTY_FILTERS, search: interpretedFrom }, "best-match", viewMode);
        params.set("interpret", "off");
        router.push(`${localizeHref(locale, stripLocalePrefix(pathname))}?${params.toString()}`, { scroll: false });
    }, [interpretedFrom, viewMode, router, locale, pathname]);

    useEffect(() => {
        const controller = new AbortController();
        const generation = ++catalogGenerationRef.current;
        loadMoreAbortRef.current?.abort();
        loadMoreAbortRef.current = null;
        loadMoreLockRef.current = true;
        const loadingTimer = window.setTimeout(() => {
            if (generation !== catalogGenerationRef.current) return;
            setIsFetchingCatalog(true);
            setQueryError(null);
            setIsLoadingMore(false);
        }, 0);
        fetchCatalogSearch(buildCatalogSearchArgs({
            surface: MASTER_CATALOG_SURFACE,
            filters,
            sort: sortBy,
            view: viewMode,
            limit: PAGE_SIZE,
            cursor: null,
        }), controller.signal)
            .then((result) => {
                if (generation !== catalogGenerationRef.current) return;
                setActiveResult(result as CatalogSearchResult);
            })
            .catch((error) => {
                if (error instanceof DOMException && error.name === "AbortError") return;
                if (generation !== catalogGenerationRef.current) return;
                console.error("[Catalog] Search failed:", error);
                setQueryError("Unable to update these results. Your selected filters are still applied.");
                analytics.catalogRefineIncident({
                    surface: "master",
                    status: "query_failure",
                    capacityCount: filters.capacities.length,
                    applicatorCount: filters.applicators.length,
                    threadCount: filters.neckThreadSizes.length,
                });
            })
            .finally(() => {
                window.clearTimeout(loadingTimer);
                if (generation === catalogGenerationRef.current) {
                    loadMoreLockRef.current = false;
                    setIsFetchingCatalog(false);
                }
            });
        return () => {
            controller.abort();
            window.clearTimeout(loadingTimer);
        };
    }, [filters, sortBy, viewMode, retryNonce]);

    // ── Handler Functions ────────────────────────────────────────────────────

    const handleFilterChange = useCallback(
        (patch: Partial<CatalogFilters>) => {
            setFilters((prev) => {
                const next = { ...prev, ...patch };
                // Using a timeout defers the URL update until after the render cycle completes
                setTimeout(() => pushToUrl(next, sortBy, viewMode), 0);
                return next;
            });
            if (!mobileFilterOpen) window.scrollTo({ top: 0, behavior: "smooth" });
        },
        [mobileFilterOpen, pushToUrl, sortBy, viewMode],
    );

    const handleClearAll = useCallback(() => {
        setFilters(EMPTY_FILTERS);
        setSortBy("capacity-asc");
        setSearchInput("");
        pushToUrl(EMPTY_FILTERS, "capacity-asc", viewMode);
    }, [pushToUrl, viewMode]);

    const handleClearFacets = useCallback(() => {
        const next = { ...EMPTY_FILTERS, search: filters.search };
        setFilters(next);
        pushToUrl(next, sortBy, viewMode);
    }, [filters.search, pushToUrl, sortBy, viewMode]);

    const handleSortChange = useCallback(
        (value: SortValue) => {
            setSortBy(value);
            pushToUrl(filters, value, viewMode);
        },
        [pushToUrl, filters, viewMode],
    );

    const handleViewChange = useCallback(
        (value: ViewMode) => {
            setViewMode(value);
            pushToUrl(filters, sortBy, value);
        },
        [pushToUrl, filters, sortBy],
    );

    const handleLoadMore = useCallback(() => {
        const cursor = activeResult.nextCursor;
        if (!cursor || isFetchingCatalog || loadMoreLockRef.current) return;
        loadMoreLockRef.current = true;
        const generation = catalogGenerationRef.current;
        const controller = new AbortController();
        loadMoreAbortRef.current?.abort();
        loadMoreAbortRef.current = controller;
        setIsLoadingMore(true);
        setQueryError(null);
        fetchCatalogSearch(buildCatalogSearchArgs({
            surface: MASTER_CATALOG_SURFACE,
            filters,
            sort: sortBy,
            view: viewMode,
            limit: PAGE_SIZE,
            cursor,
        }), controller.signal)
            .then((result) => {
                if (generation !== catalogGenerationRef.current) return;
                setActiveResult((prev) => mergeCatalogSearchPages(prev, result as CatalogSearchResult));
            })
            .catch((error) => {
                if (error instanceof DOMException && error.name === "AbortError") return;
                if (generation !== catalogGenerationRef.current) return;
                console.error("[Catalog] Load more failed:", error);
                setQueryError("Unable to load more products. Your selected filters are still applied.");
            })
            .finally(() => {
                if (loadMoreAbortRef.current === controller) loadMoreAbortRef.current = null;
                if (generation === catalogGenerationRef.current) {
                    loadMoreLockRef.current = false;
                    setIsLoadingMore(false);
                }
            });
    }, [activeResult.nextCursor, isFetchingCatalog, filters, sortBy, viewMode]);

    const handleSearchInput = useCallback(
        (term: string) => {
            setSearchInput(term);
            clearTimeout(searchDebounceRef.current);
            searchDebounceRef.current = setTimeout(() => {
                typedSearchRef.current = term.trim();
                const nextSort: SortValue = term
                    ? (sortBy === "capacity-asc" || sortBy === "featured" ? "best-match" : sortBy)
                    : (sortBy === "best-match" ? "capacity-asc" : sortBy);
                if (nextSort !== sortBy) setSortBy(nextSort);
                setFilters((prev) => {
                    const next = { ...prev, search: term || "" };
                    setTimeout(() => pushToUrl(next, nextSort, viewMode), 0);
                    return next;
                });
                if (!mobileFilterOpen) window.scrollTo({ top: 0, behavior: "smooth" });
            }, SEARCH_DEBOUNCE_MS);
        },
        [mobileFilterOpen, pushToUrl, sortBy, viewMode],
    );

    // The product type switch already shows its category, so it gets no chip and no badge count.
    const typeSwitchCategory = CATALOG_PRODUCT_TYPES.some((type) => type.value === filters.category);
    const chips = buildAppliedFilterChips(filters).filter((chip) => !(chip.facet === "category" && typeSwitchCategory)).map((chip) => ({
        facet: chip.facet,
        label: chip.facet === "shopCollection"
            ? `${t("collection")}: ${localizeCollectionName(locale, chip.value, getShopCollection(chip.value)?.title)}`
            : chip.label,
        onRemove: () => {
            if (chip.facet === "search") setSearchInput("");
            handleFilterChange(removeCatalogFilterChip(filters, chip));
        },
    }));
    const facetChips = chips.filter((chip) => chip.facet !== "search");
    const facetFilterCount = activeFilterCount({ ...filters, search: "", category: typeSwitchCategory ? null : filters.category });
    const compactChipLabel = (label: string) => label.replace(/^(Collection|Colección|Category|Applicator|Dispenser|Roller|Family|Glass|Capacity|Neck|Component|Search|Price):\s*/i, "");
    const activeConstraintSummary = buildAppliedFilterChips(filters)
        .map((chip) => chip.label)
        .join(" · ");

    const selectedApplicatorLabel = filters.applicators.length === 1
        ? APPLICATOR_BUCKETS.find((b) => b.value === filters.applicators[0])?.label ?? filters.applicators[0]
        : null;
    const selectedFamilyLabel = filters.families.length === 1 ? filters.families[0] : null;
    const emptyFamilySuggestions = facets && selectedFamilyLabel
        ? Object.entries(facets.families)
            .filter(([family, count]) => family !== selectedFamilyLabel && count > 0)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([family]) => family)
        : [];
    const emptyCombinationMessage = !filters.search && selectedApplicatorLabel && selectedFamilyLabel
        ? `No ${selectedFamilyLabel} ${selectedApplicatorLabel.toLowerCase()}s. ${emptyFamilySuggestions.length > 0
            ? `Try ${emptyFamilySuggestions.join(", ")}, or clear the ${selectedFamilyLabel} filter.`
            : `Clear the ${selectedFamilyLabel} filter to see more ${selectedApplicatorLabel.toLowerCase()} options.`}`
        : null;

    const productTypes = CATALOG_PRODUCT_TYPES.map((type) => ({
        ...type,
        label: t(PRODUCT_TYPE_COPY[type.value]),
        count: productTypeCount(type.value, facets?.categories),
    }));
    const activeProductType = productTypes.find((type) => type.value === filters.category) ?? null;
    const countLabel = isLoading
        ? t("loading")
        : filters.search
            ? t(totalCount === 1 ? "resultsFor" : "resultsForPlural", { count: totalCount.toLocaleString(), query: filters.search })
            : activeProductType && PRODUCT_TYPE_COUNT_COPY[activeProductType.value]
                ? t(PRODUCT_TYPE_COUNT_COPY[activeProductType.value]!, { count: totalCount.toLocaleString() })
                : t(totalCount === 1 ? "productCount" : "productCountPlural", { count: totalCount.toLocaleString() });
    const handleProductType = (value: string) => {
        // Families and component types belong to one product type, so they reset with it.
        handleFilterChange({
            category: filters.category === value ? null : value,
            collection: null,
            componentType: null,
            families: [],
        });
    };
    const askGraceAboutThreads = () => openGrace();

    const sidebar = (mobile: boolean) => (
        <CatalogFilterSidebar
            facets={facets}
            filters={filters}
            onFilterChange={handleFilterChange}
            onAskGrace={askGraceAboutThreads}
            mobile={mobile}
            surface={MASTER_CATALOG_SURFACE}
        />
    );

    return (
        <main className="min-h-screen bg-[#faf9f7] pt-[82px] font-sans text-[#1c1c1e] lg:pt-[120px]">
            <Navbar variant="catalog" initialSearchValue={filters.search || undefined} hideSearch />
            <div className="lg:hidden">
                <Breadcrumbs steps={catalogBreadcrumbSteps(filters)} />
            </div>

            <div className="mx-auto max-w-[1720px]">

                {/* Title row: name + live count, product type switch, search */}
                <div className="flex flex-col gap-3 px-4 pt-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:gap-6 lg:px-10 lg:pt-[18px]">
                    <div className="flex min-w-0 flex-col gap-3">
                        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                            <h1 className="page-heading whitespace-nowrap font-semibold uppercase leading-none tracking-[0.1em] text-[#1c1c1e] max-lg:text-[22px] lg:text-[28px]">
                                <span className="lg:hidden">{t("title")}</span>
                                <span className="hidden lg:inline">{t("masterTitle")}</span>
                            </h1>
                            <p className="text-[13px] text-[#5d6b7e]" aria-live="polite" data-testid="catalog-result-count">
                                {countLabel}
                            </p>
                        </div>
                        <div role="group" aria-label={t("productType")} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 hide-scroll sm:mx-0 sm:px-0">
                            {productTypes.map((type) => {
                                const active = filters.category === type.value;
                                return (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => handleProductType(type.value)}
                                        aria-pressed={active}
                                        data-testid="catalog-product-type"
                                        className={`min-h-9 shrink-0 whitespace-nowrap border px-3.5 py-[7px] text-[12px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1c1e] ${active
                                            ? "border-[#1c1c1e] bg-[#1c1c1e] text-white"
                                            : "border-[#d9cdb9] bg-transparent text-[#1c1c1e] hover:border-[#1c1c1e]"}`}
                                    >
                                        {type.label} <span className="opacity-60 tabular-nums">{type.count.toLocaleString()}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="w-full shrink-0 lg:w-[340px]">
                        <div className="flex h-11 items-center gap-2 rounded-full border border-[#d9cdb9] bg-white px-[18px] transition-colors focus-within:border-[#1c1c1e] hover:border-[#1c1c1e] lg:h-10">
                            <Search className="h-4 w-4 shrink-0 text-[#8a93a0]" aria-hidden />
                            <input
                                type="search"
                                name="search"
                                autoComplete="search"
                                enterKeyHint="search"
                                value={searchInput}
                                onChange={(e) => handleSearchInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") submittedSearchRef.current = e.currentTarget.value.trim();
                                }}
                                placeholder={t("searchPlaceholder")}
                                className="w-full bg-transparent text-base text-[#1c1c1e] placeholder:text-[#8a93a0] focus:outline-none lg:text-[13px] [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                                aria-label={t("searchProducts")}
                                data-testid="catalog-search-input"
                            />
                            {searchInput && (
                                <button onClick={() => handleSearchInput("")} className="-mr-3 flex h-10 w-10 shrink-0 items-center justify-center" aria-label={t("clearSearch")}>
                                    <X className="h-4 w-4 text-[#5d6b7e] transition-colors hover:text-[#1c1c1e]" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filter toolbar: active chips (desktop), mobile filter button, sort, view */}
                <div className="mx-4 mt-4 flex items-center gap-2 border-b border-t border-b-[#ece6dc] border-t-[#1c1c1e] py-2.5 sm:mx-6 lg:mx-10 lg:mt-4 lg:min-h-[56px] lg:gap-3">
                    <button
                        type="button"
                        onClick={() => setMobileFilterOpen(true)}
                        className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border border-[#d9cdb9] bg-white px-3 text-[13px] text-[#1c1c1e] lg:hidden"
                        data-testid="catalog-mobile-filter-button"
                    >
                        <SlidersHorizontal className="h-4 w-4" aria-hidden />
                        {t("filters")}
                        {facetFilterCount > 0 && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1c1c1e] text-[10px] font-semibold text-white">
                                {facetFilterCount}
                            </span>
                        )}
                    </button>
                    <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-1.5 lg:flex" aria-label="Active catalog filters">
                        {chips.length === 0 && (
                            <span className="text-[12px] text-[#8a93a0]">{t("noFiltersApplied")}</span>
                        )}
                        {chips.map((chip, i) => (
                            <button
                                key={`${chip.label}-${i}`}
                                type="button"
                                onClick={chip.onRemove}
                                aria-label={`Remove ${chip.label} filter`}
                                className="inline-flex max-w-[260px] items-center gap-1.5 rounded-full border border-[#d9cdb9] bg-[#f1ebe0] py-1.5 pl-3 pr-2.5 text-[12px] text-[#1c1c1e] hover:border-[#1c1c1e]"
                                data-testid="catalog-active-filter-chip"
                            >
                                <span className="truncate">{chip.label}</span>
                                <span aria-hidden>✕</span>
                            </button>
                        ))}
                        {chips.length > 0 && (
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="ml-1 whitespace-nowrap text-[12px] text-[#9a7a48] underline underline-offset-2 hover:text-[#1c1c1e]"
                            >
                                {t("clearAll")}
                            </button>
                        )}
                    </div>
                    <div className="relative ml-auto min-w-0 flex-1 lg:flex-none">
                        <label htmlFor="catalog-sort" className="sr-only">{t("sortBy")}</label>
                        <select
                            id="catalog-sort"
                            value={sortBy}
                            onChange={(e) => handleSortChange(e.target.value as SortValue)}
                            aria-label="Sort catalog results"
                            className="h-10 w-full cursor-pointer appearance-none rounded-md border border-[#d9cdb9] bg-white pl-3 pr-8 text-[12px] text-[#1c1c1e] outline-none focus:border-[#1c1c1e] lg:h-[34px] lg:w-auto"
                        >
                            {catalogSortMenuOptions(Boolean(filters.search)).map((opt) => (
                                <option key={opt.value} value={opt.value}>{sortLabel(opt.value)}</option>
                            ))}
                        </select>
                        <ArrowUpDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5d6b7e]" aria-hidden />
                    </div>
                    <ViewToggle value={viewMode} onChange={handleViewChange} labels={{ visual: t("viewVisual"), line: t("viewLineItems") }} />
                </div>

                {facetChips.length > 0 && (
                    <div className="mx-4 mt-2 flex gap-1.5 overflow-x-auto pb-1 hide-scroll sm:mx-6 lg:hidden" aria-label="Active catalog filters">
                        {facetChips.map((chip, i) => (
                            <button
                                key={`${chip.label}-${i}`}
                                type="button"
                                onClick={chip.onRemove}
                                aria-label={`Remove ${chip.label} filter`}
                                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#d9cdb9] bg-[#f1ebe0] px-3 text-[12px] text-[#1c1c1e]"
                                data-testid="catalog-active-filter-chip"
                            >
                                <span className="max-w-[160px] truncate">{compactChipLabel(chip.label)}</span>
                                <span aria-hidden>✕</span>
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={handleClearFacets}
                            className="min-h-9 shrink-0 px-2 text-[12px] text-[#9a7a48] underline underline-offset-2"
                        >
                            {t("clear")}
                        </button>
                    </div>
                )}

                {/* Mobile Filter Drawer */}
                <AnimatePresence>
                    {mobileFilterOpen && (
                        <>
                            <motion.div
                                key="filter-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setMobileFilterOpen(false)}
                                className="fixed inset-0 z-50 bg-obsidian/40 backdrop-blur-sm lg:hidden"
                            />
                            <motion.div
                                key="filter-drawer"
                                initial={{ x: "-100%" }}
                                animate={{ x: 0 }}
                                exit={{ x: "-100%" }}
                                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                                role="dialog"
                                aria-modal="true"
                                aria-label="Filter products"
                                className="fixed top-0 left-0 z-50 flex w-[300px] max-w-[85vw] flex-col bg-[#faf9f7] lg:hidden"
                                style={{
                                    bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))",
                                    boxShadow: "8px 0 40px rgba(29,29,31,0.15)",
                                }}
                                data-testid="catalog-filter-drawer"
                            >
                                <div className="flex shrink-0 items-center justify-between border-b border-[#ece6dc] px-5 py-3">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#1c1c1e]">{t("filters")}</h2>
                                        {facetFilterCount > 0 && (
                                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1c1c1e] text-[10px] font-semibold text-white">
                                                {facetFilterCount}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        autoFocus
                                        onClick={() => setMobileFilterOpen(false)}
                                        className="flex min-h-11 min-w-11 items-center justify-center"
                                        aria-label="Close filters"
                                    >
                                        <X className="h-5 w-5 text-[#5d6b7e]" />
                                    </button>
                                </div>
                                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
                                    {sidebar(true)}
                                </div>
                                <div className="flex shrink-0 gap-2 border-t border-[#ece6dc] px-5 py-4">
                                    {facetFilterCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleClearFacets}
                                            className="min-h-11 flex-1 border border-[#d9cdb9] px-3 text-[12px] font-medium uppercase tracking-[0.14em] text-[#1c1c1e]"
                                        >
                                            {t("clearAll")}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMobileFilterOpen(false);
                                            window.scrollTo({ top: 0, behavior: "smooth" });
                                        }}
                                        className="min-h-11 flex-[2] bg-[#1c1c1e] py-3 text-[12px] font-medium uppercase tracking-[0.14em] text-white"
                                    >
                                        {isLoading ? "Loading results" : `Show ${totalCount} ${totalCount === 1 ? "product" : "products"}`}
                                    </button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                <div className="px-4 pb-24 pt-3 sm:px-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 lg:px-10 lg:pb-10 lg:pt-2">

                    {/* Desktop sidebar: stays in view and scrolls on its own */}
                    <aside className="hidden self-start lg:sticky lg:top-[120px] lg:block lg:max-h-[calc(100vh-136px)] lg:overflow-y-auto lg:pb-6 hide-scroll" aria-label={t("filters")}>
                        {sidebar(false)}
                    </aside>

                    {/* Product Grid Content */}
                    <div className="min-w-0 pt-0 lg:pt-3.5">

                        {selectedFamilyLabel && isFamilyLandingFamily(selectedFamilyLabel) && (
                            <p className="mb-3 text-[13px] text-[#1c1c1e]">
                                <LocaleLink
                                    href={familyGuideHref(selectedFamilyLabel)}
                                    className="underline underline-offset-4 hover:text-[#9a7a48]"
                                >
                                    {t("helpChooseFamily", { family: localizeFamilyName(locale, selectedFamilyLabel) })}
                                </LocaleLink>
                            </p>
                        )}

                        {/* Loading */}
                        {queryError && (
                            <div role="alert" className="mb-4 flex flex-col gap-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
                                <span>{queryError}</span>
                                <button type="button" onClick={() => setRetryNonce((value) => value + 1)} className="min-h-11 border border-red-300 bg-white px-4 text-[10px] font-bold uppercase tracking-wider">Retry</button>
                            </div>
                        )}
                        {isLoading && <SkeletonGrid />}

                        {/* Empty State */}
                        {!isLoading && totalCount === 0 && (
                            <div className="flex flex-col items-center justify-center py-24 text-center" data-testid="catalog-empty-state">
                                <Package className="w-16 h-16 text-champagne mb-6" strokeWidth={1} />
                                <h3 className="font-serif text-2xl text-obsidian mb-3">{t("noProducts")}</h3>
                                <p className="text-slate text-sm max-w-md mb-4">
                                    {emptyCombinationMessage ??
                                    (filters.search
                                        ? t("noMatchSearch", { query: filters.search })
                                        : t("noMatchFilters"))}
                                </p>
                                {chips.length > 0 && (
                                    <p className="text-slate text-xs mb-6">
                                        Active constraints: {activeConstraintSummary}. Remove one constraint or clear all to see more results.
                                    </p>
                                )}
                                <SearchClosestMatches state={interpretation} onApply={handleApplyInterpretation} />
                                {searchRecoverySuggestions.length > 0 && (
                                    <div className="mb-6 max-w-lg">
                                        <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate mb-3">
                                            Try a broader packaging term
                                        </p>
                                        <div className="flex flex-wrap items-center justify-center gap-2">
                                            {searchRecoverySuggestions.map((suggestion) => (
                                                <button
                                                    key={suggestion}
                                                    onClick={() => {
                                                        setSearchInput(suggestion);
                                                        handleFilterChange({ search: suggestion });
                                                    }}
                                                    className="min-h-11 px-4 py-2 rounded-full border border-champagne bg-white text-xs font-semibold text-obsidian hover:border-muted-gold hover:text-muted-gold transition-colors"
                                                    data-testid="catalog-search-recovery-suggestion"
                                                >
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="flex flex-col sm:flex-row gap-3 mt-2">
                                    <button
                                        onClick={handleClearAll}
                                        className="px-6 py-3 bg-obsidian text-white uppercase text-xs font-bold tracking-wider hover:bg-muted-gold transition-colors rounded-sm"
                                    >
                                        {t("resetFilters")}
                                    </button>
                                    <button
                                        onClick={() => openGrace()}
                                        className="px-6 py-3 border border-muted-gold text-muted-gold uppercase text-xs font-bold tracking-wider hover:bg-muted-gold hover:text-white transition-colors rounded-sm flex items-center gap-2"
                                    >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        {t("talkWithGrace")}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Auto-applied "closest match" — says what was shown instead, with a way back */}
                        {interpretedFrom && visibleProducts.length > 0 && (
                            <div
                                role="status"
                                className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-muted-gold/10 border border-muted-gold/30 rounded-sm"
                                data-testid="catalog-interpreted-banner"
                            >
                                <p className="text-sm text-obsidian">
                                    {t("interpretedNotice", { query: interpretedFrom, label: describeSuggestion(filters) })}
                                </p>
                                <button
                                    type="button"
                                    onClick={handleUndoInterpretation}
                                    className="min-h-11 shrink-0 text-xs font-semibold text-muted-gold underline underline-offset-4 hover:text-obsidian transition-colors"
                                >
                                    {t("interpretedUndo", { query: interpretedFrom })}
                                </button>
                            </div>
                        )}

                        {/* Grace Navigation Banner */}
                        <AnimatePresence>
                            {isGraceNav && !graceBannerDismissed && visibleProducts.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    className="mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-muted-gold/10 border border-muted-gold/30 rounded-sm"
                                >
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-muted-gold shrink-0" />
                                        <p className="text-sm text-muted-gold font-semibold">{t("graceFoundThese")}</p>
                                        <span className="text-xs text-slate">{t("graceRefineHint")}</span>
                                    </div>
                                    <button
                                        onClick={() => setGraceBannerDismissed(true)}
                                        className="shrink-0 p-1 hover:text-obsidian text-muted-gold transition-colors"
                                        aria-label="Dismiss"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Product Display — Visual Grid or Line Items */}
                        <div aria-busy={isFetchingCatalog} className={`transition-opacity duration-300 ${isFetchingCatalog && activeResult.items.length > 0 ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
                            {visibleProducts.length > 0 && viewMode === "visual" && (
                                <CatalogProductGrid>
                                    {visibleProducts.map((group: CatalogGroup, pIndex: number) => (
                                        <ProductGroupCard
                                            key={`${group._id}:${filters.search}:${filters.rollerMaterials.join(",")}`}
                                            group={group}
                                            index={pIndex}
                                            applicatorParam={visualApplicatorParam}
                                            variantPreviews={variantPreviewMap.get(group._id)}
                                            catalogHero={catalogHeroMap.get(group._id)}
                                            matchSearch={Boolean(filters.search.trim())}
                                            displayName={customerNameMap.get(group._id)}
                                            thumbnailUrl={catalogThumbnailMap.get(group._id)}
                                            primaryGraceSku={primarySkuMetaMap.get(group._id)?.graceSku}
                                            primaryWebsiteSku={primarySkuMetaMap.get(group._id)?.websiteSku}
                                            variantSources={variantSourceMap.get(group._id)}
                                            variantCardName={variantCardNameMap.get(group._id)}
                                        />
                                    ))}
                                </CatalogProductGrid>
                            )}

                            {/* Line Item View — Desktop Table */}
                            {visibleProducts.length > 0 && viewMode === "line" && (
                                <>
                                    {/* Desktop: Table aligned with header */}
                                    <div className="hidden lg:block">
                                        <div className="bg-white border border-champagne/40 rounded-lg overflow-hidden shadow-sm">
                                            <LineItemTable
                                                groups={visibleProducts}
                                                skuMap={skuMap}
                                                applicatorParam={visualApplicatorParam}
                                                thumbnailMap={catalogThumbnailMap}
                                                displayNameMap={customerNameMap}
                                                primarySkuMetaMap={primarySkuMetaMap}
                                            />
                                        </div>
                                    </div>

                                    {/* Mobile: Compact cards */}
                                    <div className="lg:hidden">
                                        <LineItemMobileGrid
                                            groups={visibleProducts}
                                            skuMap={skuMap}
                                            applicatorParam={visualApplicatorParam}
                                            thumbnailMap={catalogThumbnailMap}
                                            displayNameMap={customerNameMap}
                                            primarySkuMetaMap={primarySkuMetaMap}
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Load More */}
                        {hasMore && (
                            <div className="flex flex-col items-center py-12 mt-8 border-t border-champagne/40">
                                <p className="text-xs text-slate mb-4">
                                    {t("showingOf", { shown: rawResult.items.length, total: totalCount })}
                                </p>
                                <button
                                    type="button"
                                    data-testid="catalog-load-more"
                                    onClick={handleLoadMore}
                                    disabled={isLoadingMore || isFetchingCatalog}
                                    className="min-h-11 px-8 py-3 bg-obsidian text-white uppercase text-xs font-bold tracking-wider hover:bg-muted-gold transition-colors rounded-sm disabled:cursor-wait disabled:opacity-70"
                                >
                                    {isLoadingMore ? t("loadingMore") : t("loadMore")}
                                </button>
                            </div>
                        )}

                        {/* All shown indicator */}
                        {!isLoading && totalCount > 0 && !hasMore && totalCount > PAGE_SIZE && (
                            <div className="flex justify-center py-12 mt-8 border-t border-champagne/40">
                                <p className="text-xs text-slate">
                                    {t("showingAll", { total: totalCount })}
                                </p>
                            </div>
                        )}

                    </div>
                </div>
            </div>

            <BackToTop />
        </main>
    );
}
