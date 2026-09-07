"use client";

import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
    MagnifyingGlass as Search, X, Package, CaretDown as ChevronDown, CaretUp as ChevronUp,
    SlidersHorizontal, ArrowsDownUp as ArrowUpDown, SquaresFour as LayoutGrid, List, Plus, Minus, ShoppingCart, ChatCircle as MessageCircle, Sparkles,
} from "@/components/icons";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Breadcrumbs from "@/components/Breadcrumbs";
import RefineSection from "@/components/catalog/RefineSection";
import CatalogProductGrid from "@/components/catalog/CatalogProductGrid";
import { useGrace } from "@/components/useGrace";
import { getCatalogHero, getCatalogHeroProductHref, type CatalogHero } from "@/lib/products/catalog-heroes";
import CatalogCardPreview from "@/components/catalog/CatalogCardPreview";
import { catalogCapKind } from "@/lib/products/catalog-cap-photos";
import { client, isSanityConfigured } from "@/sanity/lib/client";
import { urlFor } from "@/sanity/lib/image";
import {
    SORT_OPTIONS,
    APPLICATOR_BUCKETS,
    CATALOG_FAMILIES,
    CAPACITY_RANGES,
    CATEGORY_ORDER,
    COMPONENT_CATEGORIES,
    capacityInRange,
    type CatalogFacetKey,
    type SortValue,
    type CatalogFilters,
    type ViewMode,
    EMPTY_FILTERS,
    filtersAreEmpty,
    activeFilterCount,
    filtersToParams,
    paramsToFilters,
    catalogSearchRecoverySuggestions,
} from "@/lib/catalogFilters";
import {
    buildAppliedFilterChips,
    removeCatalogFilterChip,
    toggleCatalogFacetValue,
    type CatalogArrayFacet,
} from "@/lib/catalogRefineModel";
import {
    getCatalogCardVariantPreviews,
    productCardVariantHref,
    type ProductCardVariantPreview,
    type ProductCardVariantPreviewSource,
} from "@/lib/products/product-card-variant-previews";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import { isLegacyBestBottlesImageUrl } from "@/lib/productVariantIntegrity";
import { buildCatalogSearchArgs, fetchCatalogSearch } from "@/lib/catalogSearchClient";
import { catalogGroupSkuLabel, resolveCatalogGroupSku } from "@/lib/catalogSearchFallback";
import { MASTER_CATALOG_SURFACE } from "@/lib/catalogSurface";
import { analytics } from "@/lib/analytics";
import { familyFinderHref } from "@/lib/products/focused-shopping";

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;
const MAX_VISIBLE_LIMIT = 240;

// ─── Sanity Family Banner ─────────────────────────────────────────────────────

// Module-level cache so the Sanity query only runs once per session
const familyImageCache = new Map<string, string>();

function useFamilyBannerImage(family: string | null): string | null {
    const [imgUrl, setImgUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!family || !isSanityConfigured) return;
        const cached = familyImageCache.get(family);
        if (cached !== undefined) { setImgUrl(cached || null); return; } // eslint-disable-line react-hooks/set-state-in-effect -- early return from cache
        client
            .fetch<{ image?: { asset?: { _ref: string }; _type?: string } } | null>(
                `*[_type == "homepagePage"][0].designFamilyCards[family == $fam][0] { image }`,
                { fam: family }
            )
            .then((card) => {
                const url = card?.image ? urlFor(card.image) : "";
                familyImageCache.set(family, url);
                setImgUrl(url || null);
            })
            .catch(() => { familyImageCache.set(family, ""); });
    }, [family]);

    return imgUrl;
}

function FamilyBanner({ family }: { family: string }) {
    const imgUrl = useFamilyBannerImage(family);
    if (!imgUrl) return null;
    return (
        <div className="relative w-full h-40 sm:h-52 lg:h-60 rounded-sm overflow-hidden mb-6 sm:mb-8 -ml-0">
            <Image
                src={imgUrl}
                alt={family}
                fill
                className="object-cover object-center"
                unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-r from-obsidian/60 via-obsidian/20 to-transparent" />
            <div className="absolute bottom-5 left-6">
                <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-white/70 mb-1">Design Family</p>
                <p className="font-serif text-2xl sm:text-3xl text-white font-medium">{family}</p>
            </div>
        </div>
    );
}

// Valid glass colors — only these appear in the Glass Color filter.
const COLOR_SWATCH_MAP: Record<string, string> = {
    Clear: "bg-white border border-champagne/60",
    Frosted: "bg-gradient-to-br from-white to-slate-200 border border-champagne/60",
    "Cobalt Blue": "bg-blue-800",
    Cobalt: "bg-blue-800",
    Amber: "bg-amber-600",
    Green: "bg-emerald-600",
    Swirl: "bg-gradient-to-br from-sky-100 to-slate-300 border border-champagne/60",
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

function formatPrice(price: number | null): string {
    if (!price) return "—";
    return `$${price.toFixed(2)}`;
}

function clampVisibleLimit(rawLimit: string | null): number {
    const parsed = Number(rawLimit);
    if (!Number.isFinite(parsed) || parsed <= PAGE_SIZE) return PAGE_SIZE;
    return Math.min(Math.ceil(parsed / PAGE_SIZE) * PAGE_SIZE, MAX_VISIBLE_LIMIT);
}

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
            {Array.from({ length: 12 }).map((_, i) => (
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
    thumbnailUrl,
    matchSearch = false,
    catalogHero,
}: {
    group: CatalogGroup;
    index: number;
    applicatorParam?: string | null;
    variantPreviews?: ProductCardVariantPreview[];
    displayName?: string;
    thumbnailUrl?: string | null;
    primaryGraceSku?: string | null;
    primaryWebsiteSku?: string | null;
    matchSearch?: boolean;
    catalogHero?: CatalogHero | null;
}) {
    const selected = matchSearch ? variantPreviews?.[0] : null;
    const href = catalogHero
        ? getCatalogHeroProductHref(catalogHero, productGroupHref(group, applicatorParam))
        : productCardVariantHref(productGroupHref(group, applicatorParam), selected);
    const customerDisplayName = getCustomerFacingProductName({ group, fallbackName: group.displayName }).displayName;
    const defaultImageUrl =
        usableProductImageUrl(group.heroImageUrl) ??
        thumbnailUrl ??
        getFirstPreviewImageUrl(variantPreviews) ??
        null;
    const cardSpecs = [
        group.capacityMl != null ? `${group.capacityMl} ml` : group.capacity?.replace(/\s*\([^)]*\)/g, ""),
        group.neckThreadSize,
        catalogHero?.bottleColor ?? group.color,
    ].filter(Boolean).join(" · ");


    return (
        <motion.article
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: Math.min(index * 0.03, 0.3) }}
            className="group/catalog-card flex h-full flex-col overflow-hidden bg-white focus-within:relative focus-within:z-10 focus-within:outline focus-within:outline-2 focus-within:outline-muted-gold focus-within:outline-offset-[-2px]"
        >
            <CatalogCardPreview
                title={customerDisplayName}
                catalogHero={catalogHero}
                imageUrl={defaultImageUrl}
                heroHoverImageUrl={group.heroHoverImageUrl}
                href={href}
                variants={variantPreviews ?? []}
                capKind={COMPONENT_CATEGORIES.has(group.category) ? null : catalogCapKind(group.applicatorTypes ?? [], variantPreviews)}
                neck={group.neckThreadSize}
                family={group.family}
                slug={group.slug}
            />
            <Link href={href} className="flex flex-1 flex-col px-4 pb-5 pt-4 sm:px-5">
                <h4 className="text-lg font-medium leading-snug text-obsidian">{customerDisplayName}</h4>
                <p data-testid="catalog-card-specs" className="mt-2 text-xs leading-relaxed text-slate">{cardSpecs}</p>
                <span className="mt-auto pt-5 text-lg font-semibold text-obsidian">
                    {group.priceRangeMin != null ? `from ${formatPrice(group.priceRangeMin)}/ea` : "Request pricing"}
                </span>
            </Link>
        </motion.article>
    );
}

// ─── Checkbox Filter Item ────────────────────────────────────────────────────

function CheckboxItem({
    label,
    count,
    checked,
    onChange,
    swatch,
    indeterminate = false,
}: {
    label: string;
    count?: number;
    checked: boolean;
    onChange: () => void;
    swatch?: string;
    /** Some but not all of the values this box stands for are selected (capacity ranges). */
    indeterminate?: boolean;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const mixed = indeterminate && !checked;
    useEffect(() => {
        if (inputRef.current) inputRef.current.indeterminate = mixed;
    }, [mixed]);
    return (
        <label className="flex min-h-11 items-center gap-2.5 py-2 cursor-pointer group/check">
            <input
                ref={inputRef}
                type="checkbox"
                checked={checked}
                onChange={onChange}
                aria-checked={mixed ? "mixed" : checked}
                aria-label={`Filter by ${label}`}
                className="w-4 h-4 rounded border-champagne text-muted-gold focus:ring-muted-gold/30 cursor-pointer"
            />
            {swatch && (
                <span className={`w-4 h-4 rounded-full shrink-0 ${swatch}`} />
            )}
            <span className={`text-[13px] flex-1 transition-colors ${checked ? "text-muted-gold font-semibold" : "text-obsidian/70 group-hover/check:text-obsidian"}`}>
                {label}
            </span>
            {count !== undefined && (
                <span className="text-[11px] text-slate/60">{count}</span>
            )}
        </label>
    );
}

// ─── Truncated facet list ───────────────────────────────────────────────────
// Baymard: long value lists are truncated with an explicit "Show N more", never
// hidden inside a scroll box with an invisible scrollbar. Selected values stay
// visible even when they fall past the fold.

function TruncatedFacetList<T>({
    items,
    limit,
    isSelected,
    itemKey,
    renderItem,
    label,
}: {
    items: T[];
    limit: number;
    isSelected: (item: T) => boolean;
    itemKey: (item: T) => string;
    renderItem: (item: T) => ReactNode;
    label: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const visible = expanded ? items : items.filter((item, index) => index < limit || isSelected(item));
    const hidden = items.length - visible.length;
    return (
        <div className="space-y-0.5" data-testid={`catalog-facet-list-${label}`}>
            {visible.map((item) => <div key={itemKey(item)}>{renderItem(item)}</div>)}
            {items.length > limit && (
                <button
                    type="button"
                    onClick={() => setExpanded((current) => !current)}
                    aria-expanded={expanded}
                    className="min-h-11 py-2 text-[12px] font-semibold text-muted-gold transition-colors hover:text-obsidian"
                >
                    {expanded ? "Show less" : `Show ${hidden} more`}
                </button>
            )}
        </div>
    );
}

// ─── Price Range Slider ──────────────────────────────────────────────────────

function PriceRangeSlider({
    min,
    max,
    valueMin,
    valueMax,
    onChange,
}: {
    min: number;
    max: number;
    valueMin: number | null;
    valueMax: number | null;
    onChange: (min: number | null, max: number | null) => void;
}) {
    const effectiveMin = valueMin ?? min;
    const effectiveMax = valueMax ?? max;
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const handleChange = (newMin: number, newMax: number) => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            const isDefault = newMin <= min && newMax >= max;
            onChange(isDefault ? null : newMin, isDefault ? null : newMax);
        }, SEARCH_DEBOUNCE_MS);
    };

    if (min >= max) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between text-[12px] text-obsidian font-medium">
                <span>{formatPrice(effectiveMin)}</span>
                <span>{formatPrice(effectiveMax)}</span>
            </div>
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate w-8">Min</span>
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={0.01}
                        value={effectiveMin}
                        onChange={(e) => handleChange(Number(e.target.value), effectiveMax)}
                        aria-label="Minimum price"
                        className="flex-1 h-1.5 accent-muted-gold cursor-pointer"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate w-8">Max</span>
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={0.01}
                        value={effectiveMax}
                        onChange={(e) => handleChange(effectiveMin, Number(e.target.value))}
                        aria-label="Maximum price"
                        className="flex-1 h-1.5 accent-muted-gold cursor-pointer"
                    />
                </div>
            </div>
            {(valueMin !== null || valueMax !== null) && (
                <button
                    onClick={() => onChange(null, null)}
                    className="text-[11px] text-muted-gold hover:text-obsidian transition-colors"
                >
                    Reset price range
                </button>
            )}
        </div>
    );
}

// ─── Filter Sidebar Content ─────────────────────────────────────────────────

function FilterSidebarContent({
    facets,
    taxonomy,
    filters,
    totalCount,
    expandedCategories,
    toggleCategory,
    onFilterChange,
    onClearAll,
    mobileOptimized = false,
}: {
    facets: Facets | null;
    taxonomy: Record<string, Record<string, number>> | null;
    filters: CatalogFilters;
    totalCount: number;
    expandedCategories: Record<string, boolean>;
    toggleCategory: (cat: string) => void;
    onFilterChange: (patch: Partial<CatalogFilters>) => void;
    onClearAll: () => void;
    mobileOptimized?: boolean;
}) {
    const isComponentCategory = filters.category ? COMPONENT_CATEGORIES.has(filters.category) : false;
    const surface = MASTER_CATALOG_SURFACE;
    const truncateAfter = surface.truncateAfter;
    // The manifest is the one place that decides order and first-paint disclosure.
    const openByDefault = (facet: CatalogFacetKey) =>
        (mobileOptimized ? surface.mobileDefaultOpenFacets : surface.defaultOpenFacets).includes(facet);

    const toggleArrayFilter = (key: CatalogArrayFacet, value: string) => {
        const next = toggleCatalogFacetValue(filters, key, value);
        onFilterChange({ [key]: next[key] });
    };

    // Structure (which collections sit under which category) comes from the
    // taxonomy; COUNTS come from the current result's facets so every number in
    // the sidebar is the same unit — product groups in the current context —
    // instead of SKU totals for categories and group counts everywhere else.
    const sidebarCategories = useMemo(() => {
        const structure = taxonomy ?? {};
        const categoryCounts = facets?.categories ?? {};
        const collectionCounts = facets?.collections ?? {};
        const known = new Set<string>(CATEGORY_ORDER);
        const seen = new Set<string>();
        const ordered = [
            ...CATEGORY_ORDER,
            ...Object.keys(structure).filter((cat) => !known.has(cat)).sort(),
            ...Object.keys(categoryCounts).filter((cat) => !known.has(cat)).sort(),
        ].filter((cat) => {
            if (seen.has(cat) || cat === "Internal") return false;
            seen.add(cat);
            return Boolean(structure[cat]) || (categoryCounts[cat] ?? 0) > 0;
        });
        return ordered.map((category) => ({
            category,
            count: categoryCounts[category] ?? 0,
            collections: Object.keys(structure[category] ?? {})
                .map((name) => ({ name, count: collectionCounts[name] ?? 0 }))
                .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
        }));
    }, [taxonomy, facets]);

    const sortedCapacities = useMemo(() => {
        if (!facets) return [];
        return Object.values(facets.capacities).sort((a, b) => (a.ml ?? 9999) - (b.ml ?? 9999));
    }, [facets]);

    const capacityRanges = useMemo(() => {
        return CAPACITY_RANGES.map((range) => {
            const capacities = sortedCapacities.filter((cap) => capacityInRange(cap.ml, range));
            const rangeTokenSelected = filters.capacities.includes(range.value);
            const selectedCount = capacities.filter((cap) => filters.capacities.includes(cap.label)).length;
            return {
                ...range,
                capacities,
                count: capacities.reduce((sum, cap) => sum + cap.count, 0),
                checked: rangeTokenSelected || (capacities.length > 0 && selectedCount === capacities.length),
                partiallyChecked: !rangeTokenSelected && selectedCount > 0 && selectedCount < capacities.length,
            };
        }).filter((range) => range.capacities.length > 0 || filters.capacities.includes(range.value));
    }, [filters.capacities, sortedCapacities]);

    const sortedColors = useMemo(() => {
        if (!facets) return [];
        return Object.entries(facets.colors).sort(([, a], [, b]) => b - a);
    }, [facets]);

    const sortedThreads = useMemo(() => {
        if (!facets) return [];
        // Valid thread sizes match patterns like "18-415", "20-400", "13-415", "16mm"
        // Filter out anomalous values like "Ground", "Plug", "PRESS-FIT", "snap", "SPECIAL", garbled SKUs
        const VALID_THREAD_PATTERN = /^\d{1,3}[-/]\d{3,4}$|^\d{1,3}mm$/i;
        return Object.entries(facets.neckThreadSizes)
            .filter(([thread]) => VALID_THREAD_PATTERN.test(thread))
            .sort(([a], [b]) => {
                const na = parseFloat(a);
                const nb = parseFloat(b);
                if (!isNaN(na) && !isNaN(nb)) return na - nb;
                return a.localeCompare(b);
            });
    }, [facets]);

    const sortedFamilies = useMemo(() => {
        if (!facets) return [];
        return Object.entries(facets.families).sort(([a], [b]) => a.localeCompare(b));
    }, [facets]);

    const sortedComponentTypes = useMemo(() => {
        if (!facets) return [];
        return Object.entries(facets.componentTypes).sort(([, a], [, b]) => b - a);
    }, [facets]);

    const rollerMaterialSection = facets && (facets.rollerMaterials.metal > 0 || facets.rollerMaterials.plastic > 0) ? (
        <RefineSection title="Roller Material" defaultOpen={openByDefault("rollerMaterials")} hasActiveFilters={filters.rollerMaterials.length > 0}>
            <div className="space-y-0.5">
                {(["metal", "plastic"] as const).map((material) => (
                    <CheckboxItem
                        key={material}
                        label={`${material[0].toUpperCase()}${material.slice(1)} roller`}
                        count={facets.rollerMaterials[material]}
                        checked={filters.rollerMaterials.includes(material)}
                        onChange={() => toggleArrayFilter("rollerMaterials", material)}
                    />
                ))}
            </div>
        </RefineSection>
    ) : null;

    const toggleCapacityRange = (rangeValue: string, labels: string[]) => {
        const selected = new Set(filters.capacities);
        const allLabelsSelected = labels.length > 0 && labels.every((label) => selected.has(label));
        const active = selected.has(rangeValue) || allLabelsSelected;
        if (active) {
            selected.delete(rangeValue);
            for (const label of labels) selected.delete(label);
        } else {
            for (const label of labels) selected.delete(label);
            selected.add(rangeValue);
        }
        onFilterChange({ capacities: [...selected] });
    };

    const applicatorSection = Object.keys(facets?.applicators ?? {}).length > 0 ? (
        <RefineSection title="Product Type" defaultOpen={openByDefault("applicators")} hasActiveFilters={filters.applicators.length > 0}>
            <div className="space-y-0.5">
                {APPLICATOR_BUCKETS.filter((b) => (facets?.applicators?.[b.value] ?? 0) > 0 || filters.applicators.includes(b.value)).map((bucket) => (
                    <CheckboxItem
                        key={bucket.value}
                        label={bucket.label}
                        count={facets?.applicators?.[bucket.value] ?? 0}
                        checked={filters.applicators.includes(bucket.value)}
                        onChange={() => toggleArrayFilter("applicators", bucket.value)}
                    />
                ))}
            </div>
        </RefineSection>
    ) : null;

    const familySection = sortedFamilies.length > 0 ? (
        <RefineSection
            title="Design Families"
            defaultOpen={openByDefault("families")}
            hasActiveFilters={filters.families.length > 0}
        >
            <TruncatedFacetList
                label="families"
                items={sortedFamilies}
                limit={truncateAfter}
                itemKey={([fam]) => fam}
                isSelected={([fam]) => filters.families.includes(fam)}
                renderItem={([fam, count]) => (
                    <CheckboxItem
                        label={fam}
                        count={count}
                        checked={filters.families.includes(fam)}
                        onChange={() => toggleArrayFilter("families", fam)}
                    />
                )}
            />
        </RefineSection>
    ) : null;

    const capacitySection = capacityRanges.length > 0 ? (
        <RefineSection title="Capacity" defaultOpen={openByDefault("capacities")} hasActiveFilters={filters.capacities.length > 0}>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate/70">Size ranges</p>
            <div className="space-y-0.5">
                {capacityRanges.map((range) => (
                    <CheckboxItem
                        key={range.value}
                        label={`${range.label} — ${range.detail}`}
                        count={range.count}
                        checked={range.checked}
                        indeterminate={range.partiallyChecked}
                        onChange={() => toggleCapacityRange(range.value, range.capacities.map((cap) => cap.label))}
                    />
                ))}
            </div>
            <div className="mt-3 border-t border-champagne/40 pt-3">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate/70">Exact capacity</p>
                <TruncatedFacetList
                    label="capacities"
                    items={sortedCapacities}
                    limit={truncateAfter}
                    itemKey={(capacity) => capacity.label}
                    isSelected={(capacity) => filters.capacities.includes(capacity.label)}
                    renderItem={(capacity) => (
                        <CheckboxItem
                            label={capacity.label}
                            count={capacity.count}
                            checked={filters.capacities.includes(capacity.label)}
                            onChange={() => toggleArrayFilter("capacities", capacity.label)}
                        />
                    )}
                />
            </div>
        </RefineSection>
    ) : null;

    const colorSection = sortedColors.length > 0 ? (
        <RefineSection title="Glass Color" defaultOpen={openByDefault("colors")} hasActiveFilters={filters.colors.length > 0}>
            <TruncatedFacetList
                label="colors"
                items={sortedColors}
                limit={truncateAfter}
                itemKey={([color]) => color}
                isSelected={([color]) => filters.colors.includes(color)}
                renderItem={([color, count]) => (
                    <CheckboxItem
                        label={color}
                        count={count}
                        checked={filters.colors.includes(color)}
                        onChange={() => toggleArrayFilter("colors", color)}
                        swatch={COLOR_SWATCH_MAP[color] ?? "bg-slate-300"}
                    />
                )}
            />
        </RefineSection>
    ) : null;

    const categorySection = sidebarCategories.length > 0 ? (
        <RefineSection title="Categories" defaultOpen={openByDefault("category")} hasActiveFilters={!!(filters.category || filters.collection)}>
            <div className="space-y-0.5">
                {sidebarCategories.map((group) => {
                    const isSelected = filters.category === group.category && !filters.collection;
                    const holdsSelectedCollection = group.collections.some((col) => col.name === filters.collection);
                    const isExpanded = expandedCategories[group.category] === true || isSelected || holdsSelectedCollection;
                    // Zero results in the current context: greyed out, never hidden,
                    // so the scope of the catalogue stays visible (Baymard).
                    const isDead = group.count === 0 && !isSelected && !holdsSelectedCollection;
                    return (
                        <div key={group.category} data-testid="catalog-category-row">
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => onFilterChange({ category: isSelected ? null : group.category, collection: null })}
                                    aria-pressed={isSelected}
                                    disabled={isDead}
                                    className={`flex min-h-11 flex-1 items-center justify-between py-2 text-left text-[13px] transition-colors ${isSelected ? "font-semibold text-muted-gold" : isDead ? "cursor-not-allowed text-slate/40" : "text-obsidian/70 hover:text-muted-gold"}`}
                                >
                                    <span>{group.category}</span>
                                    <span className="text-[11px] text-slate/60">{group.count}</span>
                                </button>
                                {group.collections.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => toggleCategory(group.category)}
                                        aria-expanded={isExpanded}
                                        aria-label={`${isExpanded ? "Hide" : "Show"} ${group.category} collections`}
                                        className="flex min-h-11 min-w-9 items-center justify-center text-slate transition-colors hover:text-obsidian"
                                    >
                                        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
                                    </button>
                                )}
                            </div>
                            <AnimatePresence initial={false}>
                                {isExpanded && group.collections.length > 0 && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mb-2 ml-2 space-y-0.5 border-l border-champagne pl-4">
                                            {group.collections.map((col) => {
                                                const colSelected = filters.collection === col.name;
                                                const colDead = col.count === 0 && !colSelected;
                                                return (
                                                    <button
                                                        key={col.name}
                                                        type="button"
                                                        disabled={colDead}
                                                        aria-pressed={colSelected}
                                                        onClick={() => onFilterChange({ collection: colSelected ? null : col.name, category: null })}
                                                        className={`flex min-h-11 w-full items-center justify-between py-2 text-left text-[13px] transition-colors ${colSelected ? "font-semibold text-muted-gold" : colDead ? "cursor-not-allowed text-slate/40" : "text-obsidian/70 hover:text-muted-gold"}`}
                                                    >
                                                        <span>{col.name}</span>
                                                        <span className="text-[11px] text-slate/60">{col.count}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </RefineSection>
    ) : null;

    const componentTypeSection = isComponentCategory && sortedComponentTypes.length > 0 ? (
        <RefineSection title="Component Type" defaultOpen={openByDefault("componentType")} hasActiveFilters={!!filters.componentType}>
            <div className="space-y-0.5">
                {sortedComponentTypes.map(([type, count]) => (
                    <button
                        key={type}
                        onClick={() => onFilterChange({ componentType: filters.componentType === type ? null : type })}
                        className={`block min-h-11 text-left text-[13px] transition-colors w-full py-2 ${filters.componentType === type ? "text-muted-gold font-semibold" : "text-obsidian/70 hover:text-muted-gold"}`}
                    >
                        {type} ({count})
                    </button>
                ))}
            </div>
        </RefineSection>
    ) : null;

    const neckThreadSection = sortedThreads.length > 0 ? (
        <RefineSection title="Neck Thread Size" defaultOpen={openByDefault("neckThreadSizes")} hasActiveFilters={filters.neckThreadSizes.length > 0}>
            <TruncatedFacetList
                label="threads"
                items={sortedThreads}
                limit={truncateAfter}
                itemKey={([thread]) => thread}
                isSelected={([thread]) => filters.neckThreadSizes.includes(thread)}
                renderItem={([thread, count]) => (
                    <CheckboxItem
                        label={thread}
                        count={count}
                        checked={filters.neckThreadSizes.includes(thread)}
                        onChange={() => toggleArrayFilter("neckThreadSizes", thread)}
                    />
                )}
            />
        </RefineSection>
    ) : null;

    const priceSection = facets && facets.priceRange.min < facets.priceRange.max ? (
        <RefineSection title="Price Range" defaultOpen={openByDefault("price")} hasActiveFilters={filters.priceMin !== null || filters.priceMax !== null}>
            <PriceRangeSlider
                min={facets.priceRange.min}
                max={facets.priceRange.max}
                valueMin={filters.priceMin}
                valueMax={filters.priceMax}
                onChange={(min, max) => onFilterChange({ priceMin: min, priceMax: max })}
            />
        </RefineSection>
    ) : null;

    // Render order comes from the surface manifest (src/lib/catalogSurface.ts).
    // "collection" is rendered inside the Categories section.
    const sectionsByFacet: Record<CatalogFacetKey, ReactNode> = {
        category: categorySection,
        collection: null,
        applicators: applicatorSection,
        rollerMaterials: rollerMaterialSection,
        capacities: capacitySection,
        neckThreadSizes: neckThreadSection,
        colors: colorSection,
        price: priceSection,
        families: familySection,
        componentType: componentTypeSection,
    };
    const orderedSections = surface.visibleFacets.map((facet) => sectionsByFacet[facet]);

    return (
        <>
            <h3 className="font-serif text-xl text-obsidian border-b border-champagne pb-3 mb-6">Browse</h3>

            <button
                onClick={onClearAll}
                className={`block min-h-11 text-left text-sm transition-colors w-full mb-6 py-2 border-b border-champagne/30 ${filtersAreEmpty(filters) ? "text-muted-gold font-semibold" : "text-obsidian hover:text-muted-gold"}`}
            >
                All Products ({totalCount.toLocaleString()})
            </button>

            {orderedSections.map((section, index) => section ? (
                <div key={index}>{section}</div>
            ) : null)}
        </>
    );
}

// ─── View Toggle ─────────────────────────────────────────────────────────────

function ViewToggle({
    value,
    onChange,
}: {
    value: ViewMode;
    onChange: (v: ViewMode) => void;
}) {
    return (
        <div className="inline-flex items-center bg-white border border-champagne rounded-lg p-0.5">
            <button
                onClick={() => onChange("visual")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all ${value === "visual"
                    ? "bg-obsidian text-white"
                    : "text-slate hover:text-obsidian"
                    }`}
                aria-label="Visual grid view"
            >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Visual</span>
            </button>
            <button
                onClick={() => onChange("line")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all ${value === "line"
                    ? "bg-obsidian text-white"
                    : "text-slate hover:text-obsidian"
                    }`}
                aria-label="Line item view"
            >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Line Items</span>
            </button>
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
                <Link href={href} className="flex items-center gap-4">
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
                                unoptimized
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
                </Link>
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
                        {group.priceRangeMin != null ? `$${group.priceRangeMin.toFixed(2)}` : "—"}
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
                    <Link
                        href={href}
                        className="px-3 py-1.5 bg-obsidian text-white text-[10px] uppercase font-bold tracking-wider rounded hover:bg-muted-gold transition-colors flex items-center gap-1"
                    >
                        <ShoppingCart className="w-3 h-3" />
                        View
                    </Link>
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

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: Math.min(index * 0.02, 0.3) }}
            className="bg-white border border-champagne/40 rounded-lg overflow-hidden"
        >
            <div className="flex items-center p-3 gap-3">
                {/* Thumbnail */}
                <div
                    className="w-14 h-14 shrink-0 bg-travertine rounded border border-champagne/40 flex items-center justify-center overflow-hidden relative"
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
                            data-bb-image-audit="catalog-mobile-line-item"
                            data-bb-family={group.family ?? undefined}
                            data-bb-product-group-slug={group.slug}
                            data-bb-grace-sku={primaryGraceSku ?? undefined}
                            data-bb-website-sku={primaryWebsiteSku ?? sku}
                            className="object-contain p-1"
                            sizes="56px"
                            unoptimized
                        />
                    ) : (
                        <Package className="w-6 h-6 text-champagne" strokeWidth={1} />
                    )}
                </div>

                {/* Core Info */}
                <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-muted-gold uppercase tracking-wider font-bold">
                        {group.category}
                    </p>
                    <Link href={href}>
                        <p className="font-serif text-sm text-obsidian font-medium leading-tight truncate hover:text-muted-gold transition-colors">
                            {customerDisplayName}
                        </p>
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate font-mono bg-bone px-1.5 py-0.5 rounded">
                            {sku}
                        </span>
                        <span className="text-xs font-semibold text-obsidian">
                            {group.priceRangeMin != null ? `$${group.priceRangeMin.toFixed(2)}` : "—"}
                        </span>
                        <span className="text-[10px] text-slate bg-bone px-1.5 py-0.5 rounded">
                            {group.variantCount} variant{group.variantCount !== 1 ? "s" : ""}
                        </span>
                    </div>
                </div>

                {/* Expand Toggle */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="p-2 rounded-lg hover:bg-travertine transition-colors"
                    aria-expanded={expanded}
                    aria-label={expanded ? "Collapse details" : "Expand details"}
                >
                    <ChevronDown
                        className={`w-4 h-4 text-slate transition-transform ${expanded ? "rotate-180" : ""}`}
                    />
                </button>
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
                                <Link
                                    href={href}
                                    className="flex-1 py-2.5 bg-obsidian text-white text-xs uppercase font-bold tracking-wider text-center rounded-lg hover:bg-muted-gold transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <ShoppingCart className="w-3.5 h-3.5" />
                                    View & Configure
                                </Link>
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
                    className="fixed bottom-6 left-6 z-40 w-10 h-10 rounded-full bg-obsidian text-bone flex items-center justify-center shadow-xl hover:bg-muted-gold transition-colors"
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
    initialTaxonomy,
}: {
    initialSearchParams: string;
    initialResult: CatalogSearchResult;
    initialTaxonomy: Record<string, Record<string, number>> | null;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useMemo(() => new URLSearchParams(initialSearchParams), [initialSearchParams]);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const { open: openGrace } = useGrace();

    const isGraceNav = searchParams.get("grace") === "1";
    const [graceBannerDismissed, setGraceBannerDismissed] = useState(false);

    const initialState = paramsToFilters(searchParams);

    const [filters, setFilters] = useState<CatalogFilters>(initialState.filters);
    const [sortBy, setSortBy] = useState<SortValue>(initialState.sort);
    const [viewMode, setViewMode] = useState<ViewMode>(initialState.view);
    const [visibleCount, setVisibleCount] = useState(() => clampVisibleLimit(searchParams.get("limit")));
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
        if (typeof window === "undefined") return {};
        try {
            const saved = window.localStorage.getItem("catalog_expanded");
            return saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
        } catch {
            return {};
        }
    });
    const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
    const [searchInput, setSearchInput] = useState(initialState.filters.search);
    const [activeResult, setActiveResult] = useState<CatalogSearchResult>(initialResult);
    const [isFetchingCatalog, setIsFetchingCatalog] = useState(false);
    const [queryError, setQueryError] = useState<string | null>(null);
    const [retryNonce, setRetryNonce] = useState(0);

    // Sync externally-driven URL changes (including Grace) into the live grid.
    // Local state is intentional for responsive interactions, but the URL is
    // the authoritative cross-surface contract.
    useEffect(() => {
        const urlState = paramsToFilters(new URLSearchParams(initialSearchParams));
        setFilters(urlState.filters); // eslint-disable-line react-hooks/set-state-in-effect
        setSortBy(urlState.sort);
        setViewMode(urlState.view);
        setSearchInput(urlState.filters.search);
        setVisibleCount(clampVisibleLimit(new URLSearchParams(initialSearchParams).get("limit")));
        setActiveResult(initialResult);
    }, [initialSearchParams, initialResult]);

    // Sync URL when filters/sort/view change
    const pushToUrl = useCallback(
        (f: CatalogFilters, s: SortValue, v: ViewMode, limit?: number) => {
            const params = filtersToParams(f, s, v);
            if (limit && limit > PAGE_SIZE) params.set("limit", String(limit));
            const qs = params.toString();
            router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
        },
        [router, pathname],
    );

    // Persist accordion state
    useEffect(() => {
        try {
            localStorage.setItem("catalog_expanded", JSON.stringify(expandedCategories));
        } catch { /* noop */ }
    }, [expandedCategories]);

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

    // ── Convex Queries ──────────────────────────────────────────────────────
    const queryLimit = Math.max(PAGE_SIZE, visibleCount);
    // Structure only (which collections belong to which category) — counts come
    // from the search facets, so no live full-table subscription is needed.
    const taxonomy = initialTaxonomy;
    const filtered = activeResult.items;
    const facets = activeResult.facets;
    const totalCount = activeResult.totalCount;
    const visibleProducts = filtered;
    const visualApplicatorParam = filters.applicators.length === 1 ? filters.applicators[0] : null;
    const variantPreviewRows = activeResult.variantPreviewRows;
    const catalogHeroMap = useMemo(() => {
        const rowsByGroupId = new Map(variantPreviewRows.map((row) => [row.groupId, row.variants]));
        return new Map(visibleProducts.map((group) => [group._id, getCatalogHero(group.slug, rowsByGroupId.get(group._id) ?? [])]));
    }, [variantPreviewRows, visibleProducts]);
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
            const customerDisplayName = getCustomerFacingProductName({
                group,
                variant: representativeVariant,
                fallbackName: group.displayName,
            }).displayName;
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
    }, [variantPreviewRows, visibleProducts, visualApplicatorParam, skuMap, catalogHeroMap, filters.search, filters.rollerMaterials]);
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
            next.set(row.groupId, getCustomerFacingProductName({
                group,
                variant: representativeVariant,
                fallbackName: group.displayName,
            }).displayName);
        }

        for (const group of visibleProducts) {
            if (!next.has(group._id)) {
                next.set(group._id, getCustomerFacingProductName({ group, fallbackName: group.displayName }).displayName);
            }
        }

        return next;
    }, [variantPreviewRows, visibleProducts, skuMap]);
    const hasMore = visibleProducts.length < totalCount;
    const isLoading = isFetchingCatalog && activeResult.items.length === 0;
    const activeCount = activeFilterCount(filters);
    const searchRecoverySuggestions = useMemo(
        () => catalogSearchRecoverySuggestions(filters.search),
        [filters.search],
    );

    useEffect(() => {
        const controller = new AbortController();
        const loadingTimer = window.setTimeout(() => {
            if (!controller.signal.aborted) {
                setIsFetchingCatalog(true);
                setQueryError(null);
            }
        }, 0);
        fetchCatalogSearch(buildCatalogSearchArgs({
            surface: MASTER_CATALOG_SURFACE,
            filters,
            sort: sortBy,
            view: viewMode,
            limit: queryLimit,
        }), controller.signal)
            .then((result) => {
                setActiveResult(result as CatalogSearchResult);
            })
            .catch((error) => {
                if (error instanceof DOMException && error.name === "AbortError") return;
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
                if (!controller.signal.aborted) setIsFetchingCatalog(false);
            });
        return () => {
            controller.abort();
            window.clearTimeout(loadingTimer);
        };
    }, [filters, sortBy, viewMode, queryLimit, retryNonce]);

    // ── Handler Functions ────────────────────────────────────────────────────

    const handleFilterChange = useCallback(
        (patch: Partial<CatalogFilters>) => {
            setFilters((prev) => {
                const next = { ...prev, ...patch };
                // Using a timeout defers the URL update until after the render cycle completes
                setTimeout(() => pushToUrl(next, sortBy, viewMode), 0);
                return next;
            });
            setVisibleCount(PAGE_SIZE);
            if (!mobileFilterOpen) window.scrollTo({ top: 0, behavior: "smooth" });
        },
        [mobileFilterOpen, pushToUrl, sortBy, viewMode],
    );

    const handleClearAll = useCallback(() => {
        setFilters(EMPTY_FILTERS);
        setVisibleCount(PAGE_SIZE);
        setSearchInput("");
        pushToUrl(EMPTY_FILTERS, sortBy, viewMode);
    }, [pushToUrl, sortBy, viewMode]);

    const handleSortChange = useCallback(
        (value: SortValue) => {
            setSortBy(value);
            setVisibleCount(PAGE_SIZE);
            pushToUrl(filters, value, viewMode);
        },
        [pushToUrl, filters, viewMode],
    );

    const handleViewChange = useCallback(
        (value: ViewMode) => {
            setViewMode(value);
            pushToUrl(filters, sortBy, value, visibleCount);
        },
        [pushToUrl, filters, sortBy, visibleCount],
    );

    const handleLoadMore = useCallback(() => {
        const next = Math.min(visibleCount + PAGE_SIZE, totalCount);
        setVisibleCount(next);
        pushToUrl(filters, sortBy, viewMode, next);
    }, [totalCount, filters, pushToUrl, sortBy, viewMode, visibleCount]);

    const handleSearchInput = useCallback(
        (term: string) => {
            setSearchInput(term);
            clearTimeout(searchDebounceRef.current);
            searchDebounceRef.current = setTimeout(() => {
                // Auto-switch to "best-match" when search is typed; restore "featured" when cleared
                if (term && sortBy === "featured") setSortBy("best-match");
                if (!term && sortBy === "best-match") setSortBy("featured");
                handleFilterChange({ search: term || "" });
            }, SEARCH_DEBOUNCE_MS);
        },
        [handleFilterChange, sortBy],
    );

    const toggleCategory = useCallback((cat: string) => {
        setExpandedCategories((prev) => ({ ...prev, [cat]: prev[cat] !== true }));
    }, []);

    const chips = buildAppliedFilterChips(filters).map((chip) => ({
        label: chip.label,
        onRemove: () => {
            if (chip.facet === "search") setSearchInput("");
            handleFilterChange(removeCatalogFilterChip(filters, chip));
        },
    }));
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

    const summarizeFilterValue = (values: string[], fallback: string) => {
        if (values.length === 0) return fallback;
        if (values.length === 1) return values[0];
        return `${values[0]} +${values.length - 1}`;
    };
    const capacityQuickLabel = (() => {
        if (filters.capacities.length === 0) return "Size";
        for (const range of CAPACITY_RANGES) {
            if (filters.capacities.includes(range.value)) return range.label;
            const allLabels = Object.values(facets?.capacities ?? {})
                .filter((cap) => capacityInRange(cap.ml, range))
                .map((cap) => cap.label);
            if (allLabels.length > 1 && allLabels.every((label) => filters.capacities.includes(label))) {
                return range.label;
            }
        }
        return summarizeFilterValue(filters.capacities, "Size");
    })();
    const mobileQuickRefinements = [
        { label: capacityQuickLabel, active: filters.capacities.length > 0 },
        { label: summarizeFilterValue(filters.colors, "Color"), active: filters.colors.length > 0 },
        { label: summarizeFilterValue(filters.neckThreadSizes, "Neck"), active: filters.neckThreadSizes.length > 0 },
        { label: summarizeFilterValue(filters.families, "Family"), active: filters.families.length > 0 },
    ];
    const quickApplicatorBuckets = APPLICATOR_BUCKETS.filter((bucket) => (
        (facets?.applicators?.[bucket.value] ?? 0) > 0 || filters.applicators.includes(bucket.value)
    ));
    const mobileQuickApplicatorBuckets = filters.applicators.length > 0
        ? quickApplicatorBuckets.filter((bucket) => filters.applicators.includes(bucket.value))
        : quickApplicatorBuckets;
    const renderQuickApplicatorButton = (bucket: (typeof APPLICATOR_BUCKETS)[number]) => {
        const isActive = filters.applicators.includes(bucket.value);
        return (
            <button
                key={bucket.value}
                onClick={() => {
                    handleFilterChange({
                        applicators: isActive
                            ? filters.applicators.filter((a) => a !== bucket.value)
                            : [...filters.applicators, bucket.value],
                    });
                }}
                aria-pressed={isActive}
                data-testid="catalog-quick-applicator"
                className={`shrink-0 min-h-11 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-full border transition-colors whitespace-nowrap ${isActive
                    ? "bg-obsidian text-white border-obsidian"
                    : "bg-white border-champagne text-obsidian hover:border-muted-gold"
                    }`}
            >
                {bucket.label} ({facets?.applicators?.[bucket.value] ?? 0})
            </button>
        );
    };
    return (
        <main className="min-h-screen bg-warm-white pt-[160px] lg:pt-[120px]">
            <Navbar variant="catalog" initialSearchValue={filters.search || undefined} />
            <Breadcrumbs steps={[{ label: "Catalog" }]} />

            <div className="max-w-[1720px] mx-auto px-4 sm:px-6 py-4 sm:py-8">

                {/* Catalog Header */}
                <div className="mb-4 sm:mb-12 border-b border-champagne/50 pb-4 sm:pb-8 flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-6">
                    <div>
                        <h1 className="font-serif text-2xl sm:text-4xl lg:text-5xl text-obsidian font-medium leading-[1.1] mb-1 sm:mb-2">Master Catalog</h1>
                        <p className="text-slate text-xs sm:text-sm max-w-xl">
                            {isLoading ? "Loading catalog..." : `${totalCount.toLocaleString()} product group${totalCount === 1 ? "" : "s"} currently visible.`}
                            <span>{" "}Need help? Talk with Grace, your AI Bottling Specialist.</span>
                        </p>
                    </div>

                    {/* Search Bar — every viewport; mobile no longer has to scroll back to the navbar */}
                    <div className="w-full shrink-0 md:w-auto">
                        <div className="flex items-center border border-champagne rounded-full px-4 py-2.5 bg-white/80 space-x-2 w-full md:w-80 hover:border-muted-gold transition-colors focus-within:border-muted-gold focus-within:ring-2 focus-within:ring-muted-gold/20">
                            <Search className="w-4 h-4 text-slate shrink-0" />
                            <input
                                type="search"
                                name="search"
                                autoComplete="search"
                                enterKeyHint="search"
                                value={searchInput}
                                onChange={(e) => handleSearchInput(e.target.value)}
                                placeholder="Search products, SKUs, families..."
                                className="bg-transparent text-sm focus:outline-none w-full placeholder-slate/60 text-obsidian"
                                aria-label="Search products"
                                data-testid="catalog-search-input"
                            />
                            {searchInput && (
                                <button onClick={() => handleSearchInput("")} className="shrink-0" aria-label="Clear search">
                                    <X className="w-4 h-4 text-slate hover:text-obsidian transition-colors" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Active Filter Chips */}
                <AnimatePresence>
                    {chips.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mb-3 sm:mb-6 flex flex-wrap items-center gap-2"
                            aria-label="Active catalog filters"
                        >
                            <span className="text-xs uppercase tracking-wider font-semibold text-slate">Active Filters:</span>
                            {chips.map((chip, i) => (
                                <span
                                    key={`${chip.label}-${i}`}
                                    className="inline-flex items-center px-3 py-1.5 bg-muted-gold/10 text-muted-gold border border-muted-gold/30 text-xs font-semibold rounded-full"
                                    data-testid="catalog-active-filter-chip"
                                >
                                    <span className="truncate max-w-[160px]">{chip.label}</span>
                                    <button
                                        onClick={chip.onRemove}
                                        className="ml-2 hover:text-obsidian transition-colors shrink-0"
                                        aria-label={`Remove ${chip.label} filter`}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                            {chips.length > 0 && (
                                <button
                                    onClick={handleClearAll}
                                    className="text-xs text-slate hover:text-obsidian transition-colors underline underline-offset-2"
                                >
                                    Clear all
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Mobile Filter Toggle */}
                <div className="lg:hidden mb-3 flex items-center gap-2">
                    <button
                        onClick={() => setMobileFilterOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-champagne rounded-lg text-sm font-medium text-obsidian hover:border-muted-gold transition-colors"
                        data-testid="catalog-mobile-filter-button"
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        Filters
                        {activeCount > 0 && (
                            <span className="w-5 h-5 rounded-full bg-muted-gold text-white text-[10px] flex items-center justify-center font-bold">
                                {activeCount}
                            </span>
                        )}
                    </button>

                    {/* Mobile sort */}
                    <div className="relative flex-1 max-w-[200px]">
                        <select
                            value={sortBy}
                            onChange={(e) => handleSortChange(e.target.value as SortValue)}
                            aria-label="Sort catalog results"
                            className="w-full appearance-none bg-white border border-champagne rounded-lg px-3 py-2.5 text-sm text-obsidian pr-8 focus:border-muted-gold focus:ring-2 focus:ring-muted-gold/20 outline-none"
                        >
                            {SORT_OPTIONS.filter((opt) => opt.value !== "best-match" || filters.search).map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate pointer-events-none" />
                    </div>
                </div>

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
                                className="fixed top-0 left-0 z-50 w-[300px] max-w-[85vw] bg-warm-white overflow-y-auto lg:hidden"
                                style={{
                                    bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))",
                                    boxShadow: "8px 0 40px rgba(29,29,31,0.15)",
                                }}
                                data-testid="catalog-filter-drawer"
                            >
                                <div className="flex items-center justify-between px-5 py-4 border-b border-champagne/50 sticky top-0 bg-warm-white z-10">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-serif text-lg text-obsidian font-medium">Filters</h3>
                                        {activeCount > 0 && (
                                            <span className="w-5 h-5 rounded-full bg-muted-gold text-white text-[10px] flex items-center justify-center font-bold">
                                                {activeCount}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        autoFocus
                                        onClick={() => setMobileFilterOpen(false)}
                                        className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-champagne/40 transition-colors"
                                        aria-label="Close filters"
                                    >
                                        <X className="w-5 h-5 text-slate" />
                                    </button>
                                </div>
                                <div className="px-5 py-4 pb-8">
                                    <FilterSidebarContent
                                        facets={facets}
                                        taxonomy={taxonomy ?? null}
                                        filters={filters}
                                        totalCount={totalCount}
                                        expandedCategories={expandedCategories}
                                        toggleCategory={toggleCategory}
                                        onFilterChange={handleFilterChange}
                                        onClearAll={handleClearAll}
                                        mobileOptimized
                                    />
                                </div>
                                {/* Sticky "View results" button at bottom */}
                                <div className="sticky bottom-0 px-5 py-4 bg-warm-white border-t border-champagne/50">
                                    <button
                                        onClick={() => {
                                            setMobileFilterOpen(false);
                                            window.scrollTo({ top: 0, behavior: "smooth" });
                                        }}
                                        className="w-full py-3 bg-obsidian text-white text-sm font-bold uppercase tracking-wider hover:bg-muted-gold transition-colors rounded-sm"
                                    >
                                        {isLoading ? "Loading results" : `View ${totalCount} ${totalCount === 1 ? "Result" : "Results"}`}
                                    </button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                <div className="flex flex-col lg:flex-row items-start lg:space-x-6">

                    {/* Desktop Sidebar */}
                    <aside className="hidden lg:block w-72 shrink-0 sticky top-[120px] max-h-[calc(100vh-140px)] overflow-y-auto hide-scroll pb-12 bg-parchment/30 rounded-xl px-4 pt-4">
                        <FilterSidebarContent
                            facets={facets}
                            taxonomy={taxonomy ?? null}
                            filters={filters}
                            totalCount={totalCount}
                            expandedCategories={expandedCategories}
                            toggleCategory={toggleCategory}
                            onFilterChange={handleFilterChange}
                            onClearAll={handleClearAll}
                        />
                    </aside>

                    {/* Product Grid Content */}
                    <div className="flex-1 min-w-0 w-full pb-32 border-l-0 lg:border-l border-champagne/30 lg:pl-6">

                        {selectedFamilyLabel && CATALOG_FAMILIES.includes(selectedFamilyLabel) && (
                            <div className="mb-4 flex flex-col gap-3 border border-muted-gold/40 bg-muted-gold/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-gold">Family finder</p>
                                    <p className="mt-1 text-sm text-obsidian">Looking for the {selectedFamilyLabel} family page with application cards and exact products?</p>
                                </div>
                                <Link
                                    href={familyFinderHref(selectedFamilyLabel)}
                                    className="inline-flex min-h-11 shrink-0 items-center justify-center bg-obsidian px-4 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-white hover:bg-muted-gold hover:text-obsidian"
                                >
                                    {`Open the ${selectedFamilyLabel} family page`}
                                </Link>
                            </div>
                        )}

                        {/* Family banner — shown when a single design family is filtered */}
                        {filters.families.length === 1 && !filters.search && (
                            <FamilyBanner family={filters.families[0]} />
                        )}

                        {/* Results Header — sticks directly below fixed navbar */}
                        <div className="sticky top-[136px] lg:top-[100px] z-30 bg-warm-white pt-2 sm:pt-5 pb-2 mb-4 sm:mb-8 border-b-2 border-obsidian">
                            <div className="flex items-end justify-between gap-2 sm:gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-gold font-bold mb-0.5 sm:mb-1">
                                        {filters.search
                                            ? "Search Results"
                                            : filters.applicators.length > 0 && filters.families.length === 1
                                                ? filters.families[0]
                                                : "Catalog"}
                                    </p>
                                    <h2 className="font-serif text-lg sm:text-3xl font-medium text-obsidian truncate">
                                        {filters.search
                                            ? `"${filters.search}"`
                                            : filters.applicators.length === 1
                                                ? `${APPLICATOR_BUCKETS.find((b) => b.value === filters.applicators[0])?.label ?? filters.applicators[0]} Bottles`
                                                : filters.applicators.length > 1
                                                    ? `${filters.applicators.map((a) => APPLICATOR_BUCKETS.find((b) => b.value === a)?.label ?? a).join(" & ")} Bottles`
                                                    : filters.families.length === 1
                                                        ? filters.families[0]
                                                        : filters.collection || filters.category || "All Products"}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                    {/* View Toggle */}
                                    <ViewToggle value={viewMode} onChange={handleViewChange} />

                                    {/* Desktop Sort */}
                                    <div className="relative hidden lg:block">
                                        <select
                                            value={sortBy}
                                            onChange={(e) => handleSortChange(e.target.value as SortValue)}
                                            aria-label="Sort visible catalog results"
                                            className="appearance-none bg-white border border-champagne rounded-lg px-3 py-1.5 text-xs text-obsidian pr-7 focus:border-muted-gold focus:ring-2 focus:ring-muted-gold/20 outline-none cursor-pointer"
                                        >
                                            {SORT_OPTIONS.filter((opt) => opt.value !== "best-match" || filters.search).map((opt) => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                        <ArrowUpDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate pointer-events-none" />
                                    </div>

                                    <span
                                        className="hidden sm:inline-flex px-2 sm:px-3 py-1 bg-white border border-champagne text-[10px] sm:text-xs font-semibold text-slate uppercase rounded-full whitespace-nowrap"
                                        aria-live="polite"
                                        data-testid="catalog-result-count"
                                    >
                                        {isLoading ? "Loading" : `${totalCount} ${totalCount === 1 ? "Product" : "Products"}`}
                                    </span>
                                    {chips.length > 0 && (
                                        <button
                                            onClick={handleClearAll}
                                            className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-muted-gold hover:text-obsidian bg-muted-gold/10 border border-muted-gold/30 rounded-full whitespace-nowrap transition-colors"
                                        >
                                            {chips.length} filter{chips.length !== 1 ? "s" : ""} · Clear
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Quick applicator chips */}
                        {facets && Object.keys(facets.applicators).length > 0 && (
                            <>
                                <div className="lg:hidden flex gap-2 mb-4 overflow-x-auto pb-1 hide-scroll">
                                    <button
                                        onClick={() => handleFilterChange({ applicators: [] })}
                                        aria-pressed={filters.applicators.length === 0}
                                        data-testid="catalog-quick-applicator"
                                        className={`shrink-0 min-h-11 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-full border transition-colors ${filters.applicators.length === 0
                                            ? "bg-obsidian text-white border-obsidian"
                                            : "bg-white border-champagne text-obsidian hover:border-muted-gold"
                                            }`}
                                    >
                                        All Bottles
                                    </button>
                                    {mobileQuickApplicatorBuckets.map(renderQuickApplicatorButton)}
                                </div>
                                <div className="hidden lg:flex gap-2 mb-6 overflow-x-auto pb-1 hide-scroll sm:flex-wrap">
                                    <button
                                        onClick={() => handleFilterChange({ applicators: [] })}
                                        aria-pressed={filters.applicators.length === 0}
                                        data-testid="catalog-quick-applicator"
                                        className={`shrink-0 min-h-11 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-full border transition-colors ${filters.applicators.length === 0
                                            ? "bg-obsidian text-white border-obsidian"
                                            : "bg-white border-champagne text-obsidian hover:border-muted-gold"
                                            }`}
                                    >
                                        All Bottles
                                    </button>
                                    {quickApplicatorBuckets.map(renderQuickApplicatorButton)}
                                </div>
                            </>
                        )}

                        <div className="lg:hidden -mt-2 mb-4 flex gap-2 overflow-x-auto pb-1 hide-scroll">
                            {mobileQuickRefinements.map((chip) => (
                                <button
                                    key={chip.label}
                                    type="button"
                                    onClick={() => setMobileFilterOpen(true)}
                                    className={`shrink-0 min-h-10 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider rounded-full border transition-colors ${chip.active
                                        ? "bg-muted-gold/10 text-muted-gold border-muted-gold/40"
                                        : "bg-white text-obsidian border-champagne"
                                        }`}
                                >
                                    {chip.label}
                                </button>
                            ))}
                        </div>

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
                                <h3 className="font-serif text-2xl text-obsidian mb-3">No products found</h3>
                                <p className="text-slate text-sm max-w-md mb-4">
                                    {emptyCombinationMessage ??
                                    (filters.search
                                        ? `No products match "${filters.search}".`
                                        : "No products match your current filters.")}
                                </p>
                                {chips.length > 0 && (
                                    <p className="text-slate text-xs mb-6">
                                        Active constraints: {activeConstraintSummary}. Remove one constraint or clear all to see more results.
                                    </p>
                                )}
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
                                        Reset Filters
                                    </button>
                                    <button
                                        onClick={() => openGrace()}
                                        className="px-6 py-3 border border-muted-gold text-muted-gold uppercase text-xs font-bold tracking-wider hover:bg-muted-gold hover:text-white transition-colors rounded-sm flex items-center gap-2"
                                    >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        Talk with Grace
                                    </button>
                                </div>
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
                                        <p className="text-sm text-muted-gold font-semibold">Grace found these for you</p>
                                        <span className="text-xs text-slate">— refine with the filters, or ask Grace to narrow it further.</span>
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
                                    Showing {visibleProducts.length} of {totalCount} products
                                </p>
                                <button
                                    onClick={handleLoadMore}
                                    className="px-8 py-3 bg-obsidian text-white uppercase text-xs font-bold tracking-wider hover:bg-muted-gold transition-colors rounded-sm"
                                >
                                    Load More
                                </button>
                            </div>
                        )}

                        {/* All shown indicator */}
                        {!isLoading && totalCount > 0 && !hasMore && totalCount > PAGE_SIZE && (
                            <div className="flex justify-center py-12 mt-8 border-t border-champagne/40">
                                <p className="text-xs text-slate">
                                    Showing all {totalCount} products
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
