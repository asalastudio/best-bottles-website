import {
    EMPTY_FILTERS,
    filtersToParams,
    paramsToFilters,
    type CatalogFilters,
    type SortValue,
    type ViewMode,
} from "@/lib/catalogFilters";

export type GraceRefineState = {
    filters: CatalogFilters;
    sort: SortValue;
    view: ViewMode;
};

export type GraceBroadenScope =
    | "all"
    | "category"
    | "collection"
    | "applicators"
    | "families"
    | "colors"
    | "capacities"
    | "neckThreadSizes"
    | "componentType"
    | "price"
    | null;

export type GraceRefinementProposal = Partial<CatalogFilters>;

const ARRAY_FILTERS = [
    "applicators",
    "families",
    "colors",
    "capacities",
    "neckThreadSizes",
] as const satisfies ReadonlyArray<keyof CatalogFilters>;

export function getGraceRefineState(searchParams: URLSearchParams): GraceRefineState {
    return paramsToFilters(searchParams);
}

export function graceRefineStateToParams(state: GraceRefineState): URLSearchParams {
    return filtersToParams(state.filters, state.sort, state.view);
}

export function inferGraceBroadenScope(customerRequest: string): GraceBroadenScope {
    const request = customerRequest.trim().toLowerCase();
    if (!request) return null;
    if (/\b(broaden|widen|clear|remove|reset)\b.{0,24}\b(search|filters?|results?)\b|\bstart over\b/.test(request)) return "all";
    if (/\b(other|different|more|any)\b.{0,20}\b(sizes?|capacities?|volumes?)\b|\bshow me other sizes\b/.test(request)) return "capacities";
    if (/\b(other|different|more|any)\b.{0,20}\b(colou?rs?|glass)\b/.test(request)) return "colors";
    if (/\b(other|different|more|any)\b.{0,20}\b(famil(?:y|ies)|shapes?|bottle styles?)\b/.test(request)) return "families";
    if (/\b(other|different|more|any)\b.{0,20}\b(threads?|neck finishes?)\b/.test(request)) return "neckThreadSizes";
    if (/\b(other|different|more|any)\b.{0,20}\b(applicators?|fitments?|delivery systems?|caps?|closures?|sprays?|pumps?)\b/.test(request)) return "applicators";
    if (/\b(other|different|more|any)\b.{0,20}\b(categories|category)\b/.test(request)) return "category";
    if (/\b(other|different|more|any)\b.{0,20}\b(collections?)\b/.test(request)) return "collection";
    if (/\b(other|different|more|any)\b.{0,20}\b(component types?|components?)\b/.test(request)) return "componentType";
    if (/\b(other|different|more|any)\b.{0,20}\b(prices?|price ranges?|budgets?)\b/.test(request)) return "price";
    return null;
}

function cloneFilters(filters: CatalogFilters): CatalogFilters {
    return {
        ...filters,
        applicators: [...filters.applicators],
        families: [...filters.families],
        colors: [...filters.colors],
        capacities: [...filters.capacities],
        neckThreadSizes: [...filters.neckThreadSizes],
    };
}

function applyEmptyConstraints(target: CatalogFilters, proposal: GraceRefinementProposal) {
    if (!target.category && typeof proposal.category === "string") target.category = proposal.category;
    if (!target.collection && typeof proposal.collection === "string") target.collection = proposal.collection;
    if (!target.componentType && typeof proposal.componentType === "string") target.componentType = proposal.componentType;
    if (target.priceMin === null && typeof proposal.priceMin === "number") target.priceMin = proposal.priceMin;
    if (target.priceMax === null && typeof proposal.priceMax === "number") target.priceMax = proposal.priceMax;
    for (const key of ARRAY_FILTERS) {
        if (target[key].length === 0 && Array.isArray(proposal[key])) {
            (target[key] as string[]) = [...proposal[key] as string[]];
        }
    }
}

export function applyGraceRefinementRequest(
    current: GraceRefineState,
    proposal: GraceRefinementProposal,
    customerRequest: string,
): GraceRefineState {
    const broaden = inferGraceBroadenScope(customerRequest);
    const filters = broaden === "all" ? cloneFilters(EMPTY_FILTERS) : cloneFilters(current.filters);

    if (broaden && broaden !== "all") {
        if (broaden === "price") {
            filters.priceMin = typeof proposal.priceMin === "number" ? proposal.priceMin : null;
            filters.priceMax = typeof proposal.priceMax === "number" ? proposal.priceMax : null;
        } else if (ARRAY_FILTERS.includes(broaden as (typeof ARRAY_FILTERS)[number])) {
            const key = broaden as (typeof ARRAY_FILTERS)[number];
            (filters[key] as string[]) = Array.isArray(proposal[key]) ? [...proposal[key] as string[]] : [];
        } else {
            const key = broaden as "category" | "collection" | "componentType";
            filters[key] = typeof proposal[key] === "string" ? proposal[key] : null;
        }
    }

    applyEmptyConstraints(filters, proposal);
    if (typeof proposal.search === "string") filters.search = proposal.search.trim();

    return { filters, sort: current.sort, view: current.view };
}

export function formatGraceRefineState(state: GraceRefineState): string {
    const { filters } = state;
    const lines = ["=== ACTIVE REFINE STATE (AUTHORITATIVE) ==="];
    if (filters.category) lines.push(`Category: ${filters.category}`);
    if (filters.collection) lines.push(`Collection: ${filters.collection}`);
    if (filters.families.length) lines.push(`Family: ${filters.families.join(", ")}`);
    if (filters.colors.length) lines.push(`Glass color: ${filters.colors.join(", ")}`);
    if (filters.capacities.length) lines.push(`Capacity: ${filters.capacities.join(", ")}`);
    if (filters.neckThreadSizes.length) lines.push(`Neck thread: ${filters.neckThreadSizes.join(", ")}`);
    if (filters.applicators.length) lines.push(`Applicator: ${filters.applicators.join(", ")}`);
    if (filters.componentType) lines.push(`Component type: ${filters.componentType}`);
    if (filters.priceMin !== null || filters.priceMax !== null) lines.push(`Price: ${filters.priceMin ?? "any"}–${filters.priceMax ?? "any"}`);
    if (filters.search) lines.push(`Search: ${filters.search}`);
    lines.push(`Sort: ${state.sort} | View: ${state.view}`);
    lines.push("Do not remove or replace an active constraint unless the customer explicitly asks to broaden that dimension.");
    return lines.join("\n");
}
