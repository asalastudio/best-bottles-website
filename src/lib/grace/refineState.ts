import {
    EMPTY_FILTERS,
    canonicalGlassColor,
    filtersToParams,
    normalizeApplicatorBuckets,
    normalizeCapacityFilterValue,
    paramsToFilters,
    type CatalogFilters,
    type SortValue,
    type ViewMode,
} from "@/lib/catalogFilters";

/**
 * Grace speaks the customer's words; the facets speak exact labels. Fold the
 * proposal into the same canonical vocabulary the sidebar and URL use so a
 * "Cobalt Blue" / "9 ml (0.3 oz)" / "Roll-On" request lands on real rows.
 */
function canonicalizeProposal(proposal: GraceRefinementProposal): GraceRefinementProposal {
    const out: GraceRefinementProposal = { ...proposal };
    if (Array.isArray(proposal.capacities)) {
        out.capacities = Array.from(new Set(proposal.capacities.map((value) => normalizeCapacityFilterValue(String(value)))));
    }
    if (Array.isArray(proposal.colors)) {
        out.colors = Array.from(new Set(
            proposal.colors.map((value) => canonicalGlassColor(String(value))).filter((value): value is string => Boolean(value)),
        ));
    }
    if (Array.isArray(proposal.applicators)) {
        out.applicators = normalizeApplicatorBuckets(proposal.applicators.map((value) => String(value)));
    }
    if (Array.isArray(proposal.rollerMaterials)) {
        out.rollerMaterials = proposal.rollerMaterials.filter((value): value is "metal" | "plastic" => value === "metal" || value === "plastic");
    }
    return out;
}

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
    | "rollerMaterials"
    | "families"
    | "colors"
    | "capacities"
    | "neckThreadSizes"
    | "componentType"
    | "price"
    | null;

export type GraceRefinementProposal = Partial<CatalogFilters>;

function exactCapacityFacet(search: string | undefined): string | null {
    const match = search?.trim().match(/^(\d+(?:\.\d+)?)\s*ml(?:\s*\([^)]*\))?$/i);
    return match ? `${Number(match[1])} ml` : null;
}

const ARRAY_FILTERS = [
    "applicators",
    "rollerMaterials",
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

export function graceRefineDestination(state: GraceRefineState): string {
    const query = graceRefineStateToParams(state).toString();
    const filters = state.filters;
    const cylinderFamilySurface =
        filters.families.length === 1
        && filters.families[0] === "Cylinder"
        && !filters.category
        && !filters.collection
        && !filters.componentType
        && !filters.search
        && filters.priceMin === null
        && filters.priceMax === null;
    const base = cylinderFamilySurface ? "/catalog/cylinder" : "/catalog";
    return `${base}${query ? `?${query}` : ""}${cylinderFamilySurface ? "#ready-made" : ""}`;
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
        rollerMaterials: [...filters.rollerMaterials],
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
    const canonical = canonicalizeProposal(proposal);
    const exactCapacity = exactCapacityFacet(canonical.search);
    const effectiveProposal: GraceRefinementProposal = exactCapacity
        ? {
            ...canonical,
            capacities: canonical.capacities?.length ? canonical.capacities : [normalizeCapacityFilterValue(exactCapacity)],
            search: "",
        }
        : canonical;
    const broaden = inferGraceBroadenScope(customerRequest);
    const filters = broaden === "all" ? cloneFilters(EMPTY_FILTERS) : cloneFilters(current.filters);

    if (broaden && broaden !== "all") {
        if (broaden === "price") {
            filters.priceMin = typeof effectiveProposal.priceMin === "number" ? effectiveProposal.priceMin : null;
            filters.priceMax = typeof effectiveProposal.priceMax === "number" ? effectiveProposal.priceMax : null;
        } else if (ARRAY_FILTERS.includes(broaden as (typeof ARRAY_FILTERS)[number])) {
            const key = broaden as (typeof ARRAY_FILTERS)[number];
            (filters[key] as string[]) = Array.isArray(effectiveProposal[key]) ? [...effectiveProposal[key] as string[]] : [];
        } else {
            const key = broaden as "category" | "collection" | "componentType";
            filters[key] = typeof effectiveProposal[key] === "string" ? effectiveProposal[key] : null;
        }
    }

    applyEmptyConstraints(filters, effectiveProposal);
    if (typeof effectiveProposal.search === "string") filters.search = effectiveProposal.search.trim();

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
    if (filters.rollerMaterials.length) lines.push(`Roller material: ${filters.rollerMaterials.join(", ")}`);
    if (filters.componentType) lines.push(`Component type: ${filters.componentType}`);
    if (filters.priceMin !== null || filters.priceMax !== null) lines.push(`Price: ${filters.priceMin ?? "any"}–${filters.priceMax ?? "any"}`);
    if (filters.search) lines.push(`Search: ${filters.search}`);
    lines.push(`Sort: ${state.sort} | View: ${state.view}`);
    lines.push("Do not remove or replace an active constraint unless the customer explicitly asks to broaden that dimension.");
    return lines.join("\n");
}
