"use client";

/**
 * Master catalog filter sidebar (design 8a). Seven sections, in the order
 * wholesale buyers narrow a bottle: family, capacity, applicator, neck
 * finish, glass, collection, price. Options inside a section combine with OR
 * and sections combine with AND (the search layer's semantics); counts are
 * live, and an option with nothing to show stays visible but disabled so
 * buyers can see what exists.
 *
 * Used by the desktop column and the mobile filter drawer.
 */

import { Fragment, useEffect, useId, useState, type ReactNode } from "react";
import { useAppLocale, useCopy } from "@/i18n/useCopy";
import { localizeCollectionName, localizeFamilyName } from "@/i18n/catalogCopy";
import {
    APPLICATOR_BUCKETS,
    CANONICAL_GLASS_COLORS,
    CAPACITY_RANGES,
    COMPONENT_FAMILIES,
    FAMILY_ORDER,
    PRODUCT_TYPE_FAMILIES,
    capacityInRange,
    neckFacetOptions,
    GROUND_NECK_VALUE,
    SPECIALTY_NECK_VALUE,
    type ApplicatorBucket,
    type CatalogFacetKey,
    type CatalogFilters,
} from "@/lib/catalogFilters";
import { SHOP_COLLECTIONS } from "@/lib/shopCollections";
import { MASTER_CATALOG_SURFACE, type CatalogSurfaceManifest } from "@/lib/catalogSurface";
import { glassSwatchImage } from "@/lib/products/glass-swatches";
import type { CatalogSearchResultShape } from "@/lib/catalogSearchFallback";

type Facets = CatalogSearchResultShape["facets"] | null | undefined;

type Props = {
    facets: Facets;
    filters: CatalogFilters;
    onFilterChange: (patch: Partial<CatalogFilters>) => void;
    onAskGrace: () => void;
    /** The mobile drawer opens fewer sections so the sheet stays scannable. */
    mobile?: boolean;
    surface?: CatalogSurfaceManifest;
};

const INK = "#1c1c1e";

// "Atomizer" is the metal travel-atomizer line (a product type, not a glass
// family) and "Tall Cylinder" has no groups of its own; both stay out.
const NOT_GLASS_FAMILIES = new Set<string>([...PRODUCT_TYPE_FAMILIES, ...COMPONENT_FAMILIES, "Atomizer", "Tall Cylinder", "Internal"]);
const GLASS_FAMILIES = FAMILY_ORDER.filter((family) => !NOT_GLASS_FAMILIES.has(family));
// Swatch order from the design: the two clear-family finishes, then the tints.
const GLASS_SWATCH_ORDER = ["Clear", "Frosted", "Cobalt Blue", "Amber", "Green", "Swirl"] as const satisfies readonly (typeof CANONICAL_GLASS_COLORS)[number][];
const GLASS_SWATCH_LABEL: Record<string, string> = { "Cobalt Blue": "Cobalt" };
const GREEN_GLASS = "#6B9A6B";

function toggle<T>(values: readonly T[], value: T): T[] {
    return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

// ─── Building blocks ────────────────────────────────────────────────────────

function Section({ title, selected, defaultOpen, children, testId }: {
    title: string;
    selected: number;
    defaultOpen: boolean;
    children: ReactNode;
    testId: string;
}) {
    const [open, setOpen] = useState(defaultOpen || selected > 0);
    const bodyId = useId();
    return (
        <section className="border-b border-[#ece6dc] py-[14px]" data-testid={testId}>
            <h3>
                <button
                    type="button"
                    onClick={() => setOpen((current) => !current)}
                    aria-expanded={open}
                    aria-controls={bodyId}
                    className="flex min-h-8 w-full items-center justify-between text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9a7a48] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1c1e]"
                >
                    <span className="whitespace-nowrap">{title}{selected > 0 && <span className="ml-1.5 text-[#1c1c1e]">({selected})</span>}</span>
                    <span aria-hidden className="text-[13px] font-normal text-[#5d6b7e]">{open ? "−" : "+"}</span>
                </button>
            </h3>
            <div id={bodyId} hidden={!open} className="pt-2.5">{children}</div>
        </section>
    );
}

function CheckRow({ label, detail, count, checked, onChange, testId }: {
    label: string;
    detail?: string;
    count: number;
    checked: boolean;
    onChange: () => void;
    testId?: string;
}) {
    const disabled = count === 0 && !checked;
    return (
        <label
            className={`flex min-h-7 items-center gap-2.5 py-[5px] text-[13px] ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:text-[#9a7a48]"}`}
            data-testid={testId}
        >
            <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="peer sr-only" />
            <span
                aria-hidden
                className={`flex h-[14px] w-[14px] shrink-0 items-center justify-center border text-[10px] leading-none text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#1c1c1e] ${checked ? "border-[#1c1c1e] bg-[#1c1c1e]" : "border-[#c9bda8] bg-white"}`}
            >
                {checked ? "✓" : ""}
            </span>
            <span className="min-w-0 flex-1 truncate">
                {label}
                {detail && <span className="ml-1.5 text-[11px] text-[#8a93a0]">{detail}</span>}
            </span>
            <span className="text-[12px] tabular-nums text-[#8a93a0]">{count.toLocaleString("en-US")}</span>
        </label>
    );
}

function Truncated<T>({ items, limit, isSelected, render, noun, showAll, showFewer }: {
    items: T[];
    limit: number;
    isSelected: (item: T) => boolean;
    render: (item: T) => ReactNode;
    noun: string;
    showAll: string;
    showFewer: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const visible = expanded ? items : items.filter((item, index) => index < limit || isSelected(item));
    return (
        <div>
            {visible.map(render)}
            {items.length > limit && (
                <button
                    type="button"
                    onClick={() => setExpanded((current) => !current)}
                    aria-expanded={expanded}
                    className="mt-1 min-h-8 text-[12px] text-[#1c1c1e] underline underline-offset-2 hover:text-[#9a7a48]"
                >
                    {expanded ? showFewer : showAll}
                    <span className="sr-only"> {noun}</span>
                </button>
            )}
        </div>
    );
}

function PriceInputs({ filters, onFilterChange, copy }: Pick<Props, "filters" | "onFilterChange"> & {
    copy: { min: string; max: string; note: string };
}) {
    const minId = useId();
    const maxId = useId();
    const [min, setMin] = useState(filters.priceMin?.toString() ?? "");
    const [max, setMax] = useState(filters.priceMax?.toString() ?? "");
    useEffect(() => { setMin(filters.priceMin?.toString() ?? ""); }, [filters.priceMin]); // eslint-disable-line react-hooks/set-state-in-effect
    useEffect(() => { setMax(filters.priceMax?.toString() ?? ""); }, [filters.priceMax]); // eslint-disable-line react-hooks/set-state-in-effect

    const parse = (value: string): number | null => {
        const amount = Number(value.replace(/[$,\s]/g, ""));
        return value.trim() === "" || !Number.isFinite(amount) || amount < 0 ? null : amount;
    };
    const commit = () => {
        const nextMin = parse(min);
        const nextMax = parse(max);
        if (nextMin === filters.priceMin && nextMax === filters.priceMax) return;
        onFilterChange({ priceMin: nextMin, priceMax: nextMax });
    };
    const input = "h-9 w-full border border-[#d9cdb9] bg-white px-2.5 text-[13px] text-[#1c1c1e] placeholder:text-[#8a93a0] focus:border-[#1c1c1e] focus:outline-none";
    return (
        <div>
            <div className="grid grid-cols-2 gap-2">
                <label htmlFor={minId} className="sr-only">Minimum price per unit</label>
                <input id={minId} inputMode="decimal" placeholder={copy.min} value={min} className={input}
                    onChange={(event) => setMin(event.target.value)} onBlur={commit}
                    onKeyDown={(event) => { if (event.key === "Enter") commit(); }} data-testid="catalog-price-min" />
                <label htmlFor={maxId} className="sr-only">Maximum price per unit</label>
                <input id={maxId} inputMode="decimal" placeholder={copy.max} value={max} className={input}
                    onChange={(event) => setMax(event.target.value)} onBlur={commit}
                    onKeyDown={(event) => { if (event.key === "Enter") commit(); }} data-testid="catalog-price-max" />
            </div>
            <p className="mt-2 text-[11px] text-[#8a93a0]">{copy.note}</p>
        </div>
    );
}

// ─── Sidebar ────────────────────────────────────────────────────────────────

export default function CatalogFilterSidebar({ facets, filters, onFilterChange, onAskGrace, mobile = false, surface = MASTER_CATALOG_SURFACE }: Props) {
    const t = useCopy("catalog");
    const locale = useAppLocale();
    const more = { showFewer: t("showFewer") };
    const showsGlass = !filters.category || filters.category === "Glass Bottle";

    const familyCounts = facets?.families ?? {};
    const extraFamilies = Object.keys(familyCounts).filter((family) => !NOT_GLASS_FAMILIES.has(family) && !GLASS_FAMILIES.includes(family));
    const families = [...GLASS_FAMILIES, ...extraFamilies]
        .map((family) => ({ family, count: familyCounts[family] ?? 0 }))
        .sort((a, b) => b.count - a.count);

    const capacityRows = Object.values(facets?.capacities ?? {});
    const capacities = CAPACITY_RANGES.map((range) => ({
        range,
        count: capacityRows.filter((row) => capacityInRange(row.ml, range)).reduce((sum, row) => sum + row.count, 0),
    }));

    const applicators = APPLICATOR_BUCKETS
        .map((bucket, order) => ({ bucket, order, count: facets?.applicators?.[bucket.value] ?? 0 }))
        .sort((a, b) => b.count - a.count || a.order - b.order);

    const necks = neckFacetOptions(facets?.neckThreadSizes);

    const colorCounts = facets?.colors ?? {};
    const glassHasProducts = CANONICAL_GLASS_COLORS.some((color) => (colorCounts[color] ?? 0) > 0) || filters.colors.length > 0;

    const collections = SHOP_COLLECTIONS.map((collection) => ({
        collection,
        count: facets?.shopCollections?.[collection.key] ?? 0,
    }));

    const limitFor = (facet: CatalogFacetKey) => surface.truncateAfterByFacet?.[facet] ?? surface.truncateAfter;
    const openByDefault = (facet: CatalogFacetKey) =>
        (mobile ? surface.mobileDefaultOpenFacets : surface.defaultOpenFacets).includes(facet);

    const renderFacet = (facet: CatalogFacetKey): ReactNode => {
        switch (facet) {
            case "families":
                if (!showsGlass) return null;
                return (
                    <Section title={t("bottleFamily")} selected={filters.families.length} defaultOpen={openByDefault("families")} testId="catalog-filter-family">
                        <Truncated
                            items={families}
                            limit={limitFor("families")}
                            noun="bottle families"
                            showAll={t("showAllCount", { count: families.length })}
                            {...more}
                            isSelected={({ family }) => filters.families.includes(family)}
                            render={({ family, count }) => (
                                <CheckRow key={family} label={localizeFamilyName(locale, family)} count={count}
                                    checked={filters.families.includes(family)}
                                    onChange={() => onFilterChange({ families: toggle(filters.families, family) })}
                                    testId="catalog-filter-option" />
                            )}
                        />
                    </Section>
                );
            case "capacities":
                return (
                    <Section title={t("capacity")} selected={capacities.filter(({ range }) => filters.capacities.includes(range.value)).length} defaultOpen={openByDefault("capacities")} testId="catalog-filter-capacity">
                        {capacities.map(({ range, count }) => (
                            <CheckRow key={range.value} label={range.label} detail={range.detail} count={count}
                                checked={filters.capacities.includes(range.value)}
                                onChange={() => onFilterChange({ capacities: toggle(filters.capacities, range.value) })}
                                testId="catalog-filter-option" />
                        ))}
                    </Section>
                );
            case "applicators":
                return (
                    <Section title={t("filterApplicator")} selected={filters.applicators.length} defaultOpen={openByDefault("applicators")} testId="catalog-filter-applicator">
                        <Truncated
                            items={applicators}
                            limit={limitFor("applicators")}
                            noun="applicators"
                            showAll={t("showAllCount", { count: applicators.length })}
                            {...more}
                            isSelected={({ bucket }) => filters.applicators.includes(bucket.value)}
                            render={({ bucket, count }) => (
                                <CheckRow key={bucket.value} label={bucket.label} count={count}
                                    checked={filters.applicators.includes(bucket.value)}
                                    onChange={() => onFilterChange({ applicators: toggle<ApplicatorBucket>(filters.applicators, bucket.value) })}
                                    testId="catalog-filter-option" />
                            )}
                        />
                    </Section>
                );
            case "neckThreadSizes":
                return (
                    <Section title={t("filterNeck")} selected={filters.neckThreadSizes.length} defaultOpen={openByDefault("neckThreadSizes")} testId="catalog-filter-neck">
                        <Truncated
                            items={necks}
                            limit={limitFor("neckThreadSizes")}
                            noun="neck finishes"
                            showAll={t("showAllCount", { count: necks.length })}
                            {...more}
                            isSelected={(option) => filters.neckThreadSizes.includes(option.value)}
                            render={(option) => (
                                <CheckRow key={option.value} label={option.value === GROUND_NECK_VALUE ? t("groundGlass") : option.value === SPECIALTY_NECK_VALUE ? t("specialtyNeck") : option.label} count={option.count}
                                    checked={filters.neckThreadSizes.includes(option.value)}
                                    onChange={() => onFilterChange({ neckThreadSizes: toggle(filters.neckThreadSizes, option.value) })}
                                    testId="catalog-filter-option" />
                            )}
                        />
                        <button type="button" onClick={onAskGrace}
                            className="mt-2 min-h-8 text-left text-[12px] text-[#9a7a48] hover:text-[#1c1c1e]"
                            data-testid="catalog-filter-ask-grace">
                            {t("askGraceThread")}
                        </button>
                    </Section>
                );
            case "colors":
                if (!glassHasProducts) return null;
                return (
                    <Section title={t("filterGlass")} selected={filters.colors.length} defaultOpen={openByDefault("colors")} testId="catalog-filter-glass">
                        <div className="grid grid-cols-3 gap-2">
                            {GLASS_SWATCH_ORDER.map((color) => {
                                const count = colorCounts[color] ?? 0;
                                const checked = filters.colors.includes(color);
                                const disabled = count === 0 && !checked;
                                const photo = glassSwatchImage(color);
                                return (
                                    <button
                                        key={color}
                                        type="button"
                                        aria-pressed={checked}
                                        disabled={disabled}
                                        onClick={() => onFilterChange({ colors: toggle(filters.colors, color) })}
                                        className={`flex flex-col items-center gap-1 border bg-white px-1 py-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1c1e] ${checked ? "border-[#1c1c1e]" : "border-[#ece6dc] hover:border-[#d9cdb9]"} ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                                        data-testid="catalog-filter-glass-swatch"
                                    >
                                        <span aria-hidden className="h-[26px] w-[26px] rounded-full"
                                            style={photo
                                                ? { backgroundImage: `url(${photo})`, backgroundSize: "cover", backgroundPosition: "center", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)" }
                                                : { background: GREEN_GLASS, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)" }} />
                                        <span className="text-[11px] leading-tight" style={{ color: INK }}>{GLASS_SWATCH_LABEL[color] ?? color}</span>
                                        <span className="text-[10px] tabular-nums text-[#8a93a0]">{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </Section>
                );
            case "shopCollection":
                return (
                    <Section title={t("collection")} selected={filters.shopCollection ? 1 : 0} defaultOpen={openByDefault("shopCollection")} testId="catalog-filter-collection">
                        <Truncated
                            items={collections}
                            limit={limitFor("shopCollection")}
                            noun="collections"
                            showAll={t("showAllCount", { count: collections.length })}
                            {...more}
                            isSelected={({ collection }) => filters.shopCollection === collection.key}
                            render={({ collection, count }) => (
                                <CheckRow key={collection.key} label={localizeCollectionName(locale, collection.key, collection.title)} count={count}
                                    checked={filters.shopCollection === collection.key}
                                    onChange={() => onFilterChange({ shopCollection: filters.shopCollection === collection.key ? null : collection.key })}
                                    testId="catalog-filter-option" />
                            )}
                        />
                    </Section>
                );
            case "price":
                return (
                    <Section title={t("filterPrice")} selected={filters.priceMin !== null || filters.priceMax !== null ? 1 : 0} defaultOpen={openByDefault("price")} testId="catalog-filter-price">
                        <PriceInputs filters={filters} onFilterChange={onFilterChange}
                            copy={{ min: t("priceMin"), max: t("priceMax"), note: t("pricePerUnitNote") }} />
                    </Section>
                );
            default:
                return null;
        }
    };

    return (
        <div data-testid="catalog-filter-sidebar">
            {surface.visibleFacets.map((facet) => <Fragment key={facet}>{renderFacet(facet)}</Fragment>)}
        </div>
    );
}
