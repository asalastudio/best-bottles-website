import type {
    CylinderApplicatorSystem,
    CylinderFamilyCardModel,
} from "./cylinder-family-page";

export type CylinderFamilySort = "capacity" | "price" | "name" | "variants";

export type CylinderFamilyRefineState = {
    capacities: string[];
    colors: string[];
    applicators: CylinderApplicatorSystem[];
    neckThreadSizes: string[];
    sort: CylinderFamilySort;
};

export type CylinderFamilyRefineOptions = Omit<CylinderFamilyRefineState, "sort">;

export type CylinderRefineDimension = keyof CylinderFamilyRefineOptions;

export type CylinderRefineChip = {
    dimension: CylinderRefineDimension;
    value: string;
    label: string;
};

const APPLICATOR_FROM_PARAM: Record<string, CylinderApplicatorSystem> = {
    rollon: "Roll-On",
    finemist: "Fine Mist Spray",
    lotionpump: "Lotion Pump",
};

const APPLICATOR_TO_PARAM: Record<CylinderApplicatorSystem, string> = {
    "Roll-On": "rollon",
    "Fine Mist Spray": "finemist",
    "Lotion Pump": "lotionpump",
};

const SORT_VALUES = new Set<CylinderFamilySort>(["capacity", "price", "name", "variants"]);

function values(params: URLSearchParams, key: string): string[] {
    return params.getAll(key)
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean);
}

function unique<T extends string>(items: readonly T[]): T[] {
    return [...new Set(items)];
}

function capacityMl(value: string): number | null {
    const match = value.match(/^(\d+(?:\.\d+)?)\s*ml\b/i);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
}

function customerCapacityLabel(value: string, options: readonly string[]): string | null {
    if (options.includes(value)) return value;
    const selectedMl = capacityMl(value);
    if (selectedMl === null) return null;
    return options.find((option) => capacityMl(option) === selectedMl) ?? null;
}

function canonicalCapacityParam(value: string): string {
    const ml = capacityMl(value);
    return ml === null ? value : `${ml} ml`;
}

export function emptyCylinderFamilyRefine(): CylinderFamilyRefineState {
    return {
        capacities: [],
        colors: [],
        applicators: [],
        neckThreadSizes: [],
        sort: "capacity",
    };
}

export function parseCylinderFamilyRefine(params: URLSearchParams): CylinderFamilyRefineState {
    const sort = params.get("sort") as CylinderFamilySort | null;
    return {
        capacities: unique(values(params, "capacities")),
        colors: unique(values(params, "colors")),
        applicators: unique(values(params, "applicators")
            .map((value) => APPLICATOR_FROM_PARAM[value])
            .filter((value): value is CylinderApplicatorSystem => Boolean(value))),
        neckThreadSizes: unique(values(params, "threads")),
        sort: sort && SORT_VALUES.has(sort) ? sort : "capacity",
    };
}

export function sanitizeCylinderFamilyRefine(
    state: CylinderFamilyRefineState,
    options: CylinderFamilyRefineOptions,
): CylinderFamilyRefineState {
    return {
        capacities: unique(state.capacities
            .map((value) => customerCapacityLabel(value, options.capacities))
            .filter((value): value is string => Boolean(value))),
        colors: state.colors.filter((value) => options.colors.includes(value)),
        applicators: state.applicators.filter((value) => options.applicators.includes(value)),
        neckThreadSizes: state.neckThreadSizes.filter((value) => options.neckThreadSizes.includes(value)),
        sort: SORT_VALUES.has(state.sort) ? state.sort : "capacity",
    };
}

export function serializeCylinderFamilyRefine(state: CylinderFamilyRefineState): URLSearchParams {
    const params = new URLSearchParams();
    params.set("families", "Cylinder");
    if (state.capacities.length) params.set("capacities", state.capacities.map(canonicalCapacityParam).join(","));
    if (state.colors.length) params.set("colors", state.colors.join(","));
    if (state.applicators.length) {
        params.set("applicators", state.applicators.map((value) => APPLICATOR_TO_PARAM[value]).join(","));
    }
    if (state.neckThreadSizes.length) params.set("threads", state.neckThreadSizes.join(","));
    if (state.sort !== "capacity") params.set("sort", state.sort);
    return params;
}

export function filterCylinderFamilyCards(
    cards: readonly CylinderFamilyCardModel[],
    state: CylinderFamilyRefineState,
): CylinderFamilyCardModel[] {
    const rows = cards.filter((card) =>
        (state.capacities.length === 0 || Boolean(card.capacity && state.capacities.includes(card.capacity)))
        && (state.colors.length === 0 || Boolean(card.color && state.colors.includes(card.color)))
        && (state.applicators.length === 0 || state.applicators.some((value) => card.applicatorSystems.includes(value)))
        && (state.neckThreadSizes.length === 0 || Boolean(card.neckThreadSize && state.neckThreadSizes.includes(card.neckThreadSize))),
    );
    return [...rows].sort((a, b) => {
        if (state.sort === "price") return (a.priceRangeMin ?? Infinity) - (b.priceRangeMin ?? Infinity);
        if (state.sort === "name") return a.displayName.localeCompare(b.displayName);
        if (state.sort === "variants") return b.variantCount - a.variantCount;
        return (a.capacityMl ?? Infinity) - (b.capacityMl ?? Infinity)
            || (a.color ?? "").localeCompare(b.color ?? "")
            || a.displayName.localeCompare(b.displayName);
    });
}

export function summarizeCylinderRefineResults(cards: readonly CylinderFamilyCardModel[]) {
    return {
        groupCount: cards.length,
        configurationCount: cards.reduce((total, card) => total + card.variantCount, 0),
    };
}

export function cylinderRefineChips(state: CylinderFamilyRefineState): CylinderRefineChip[] {
    return [
        ...state.capacities.map((value) => ({ dimension: "capacities" as const, value, label: `Capacity: ${value}` })),
        ...state.colors.map((value) => ({ dimension: "colors" as const, value, label: `Glass: ${value}` })),
        ...state.applicators.map((value) => ({ dimension: "applicators" as const, value, label: `Delivery: ${value}` })),
        ...state.neckThreadSizes.map((value) => ({ dimension: "neckThreadSizes" as const, value, label: `Neck: ${value}` })),
    ];
}

export function removeCylinderRefineChip(
    state: CylinderFamilyRefineState,
    chip: Pick<CylinderRefineChip, "dimension" | "value">,
): CylinderFamilyRefineState {
    return {
        ...state,
        [chip.dimension]: state[chip.dimension].filter((value) => value !== chip.value),
    };
}
