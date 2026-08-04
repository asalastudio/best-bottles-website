import {
    APPLICATOR_BUCKETS,
    type CatalogFacetKey,
    type CatalogFilters,
} from "@/lib/catalogFilters";

export type CatalogArrayFacet =
    | "applicators"
    | "families"
    | "capacities"
    | "colors"
    | "neckThreadSizes";

export type CatalogFilterChipFacet = CatalogFacetKey | "search";

export type CatalogFilterChip = {
    facet: CatalogFilterChipFacet;
    value: string;
    label: string;
};

function customerCapacityLabel(value: string): string {
    if (/\boz\b/i.test(value)) return value;
    const match = value.match(/^(\d+(?:\.\d+)?)\s*ml\b/i);
    if (!match) return value;
    const ml = Number(match[1]);
    if (!Number.isFinite(ml)) return value;
    const ounceValue = Number((ml / 29.5735).toFixed(2));
    return `${ml} ml (${ounceValue} oz)`;
}

function priceLabel(filters: CatalogFilters): string {
    const min = filters.priceMin === null ? "$0.00" : `$${filters.priceMin.toFixed(2)}`;
    const max = filters.priceMax === null ? "Any" : `$${filters.priceMax.toFixed(2)}`;
    return `Price: ${min} – ${max}`;
}

export function buildAppliedFilterChips(filters: CatalogFilters): CatalogFilterChip[] {
    const chips: CatalogFilterChip[] = [];
    if (filters.category) chips.push({ facet: "category", value: filters.category, label: `Category: ${filters.category}` });
    if (filters.collection) chips.push({ facet: "collection", value: filters.collection, label: `Collection: ${filters.collection}` });
    for (const value of filters.applicators) {
        const label = APPLICATOR_BUCKETS.find((bucket) => bucket.value === value)?.label ?? value;
        chips.push({ facet: "applicators", value, label: `Delivery: ${label}` });
    }
    for (const value of filters.families) {
        chips.push({ facet: "families", value, label: `Family: ${value}` });
    }
    for (const value of filters.colors) {
        chips.push({ facet: "colors", value, label: `Glass: ${value}` });
    }
    for (const value of filters.capacities) {
        chips.push({ facet: "capacities", value, label: `Capacity: ${customerCapacityLabel(value)}` });
    }
    for (const value of filters.neckThreadSizes) {
        chips.push({ facet: "neckThreadSizes", value, label: `Neck: ${value}` });
    }
    if (filters.componentType) {
        chips.push({ facet: "componentType", value: filters.componentType, label: `Component: ${filters.componentType}` });
    }
    if (filters.priceMin !== null || filters.priceMax !== null) {
        chips.push({ facet: "price", value: `${filters.priceMin ?? ""}:${filters.priceMax ?? ""}`, label: priceLabel(filters) });
    }
    if (filters.search) {
        chips.push({ facet: "search", value: filters.search, label: `Search: “${filters.search}”` });
    }
    return chips;
}

export function removeCatalogFilterChip(
    filters: CatalogFilters,
    chip: CatalogFilterChip,
): CatalogFilters {
    if (
        chip.facet === "applicators"
        || chip.facet === "families"
        || chip.facet === "capacities"
        || chip.facet === "colors"
        || chip.facet === "neckThreadSizes"
    ) {
        return {
            ...filters,
            [chip.facet]: filters[chip.facet].filter((value) => value !== chip.value),
        };
    }
    if (chip.facet === "price") return { ...filters, priceMin: null, priceMax: null };
    if (chip.facet === "search") return { ...filters, search: "" };
    return { ...filters, [chip.facet]: null };
}

export function toggleCatalogFacetValue(
    filters: CatalogFilters,
    facet: CatalogArrayFacet,
    value: string,
): CatalogFilters {
    const current = filters[facet] as string[];
    return {
        ...filters,
        [facet]: current.includes(value)
            ? current.filter((item) => item !== value)
            : [...current, value],
    } as CatalogFilters;
}
