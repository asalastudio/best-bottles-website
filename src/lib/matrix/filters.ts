import { parseCapacityLabelMl } from "@/lib/catalogFilters";

export type MatrixFilterState = {
    search: string;
    size: string;
    finish: string;
    neck: string;
    closure: string;
};

const NECK_THREAD_PATTERN = /^\d{1,3}[-/]\d{3,4}$/;

function parseMatrixCapacityMl(label: string): number | null {
    const trimmed = label.trim();
    if (!trimmed || NECK_THREAD_PATTERN.test(trimmed)) return null;
    const direct = parseCapacityLabelMl(trimmed);
    if (direct != null) return direct;
    const embedded = trimmed.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
    if (!embedded) return null;
    const parsed = Number(embedded[1]);
    return Number.isFinite(parsed) ? parsed : null;
}

function capacityOptionLabel(ml: number): string {
    return `${ml} ml`;
}

/** One dropdown option per milliliter value so "15 ml" and "15 ml (0.51 oz)" do not split the family. */
export function matrixSizeOptions(
    rows: Array<{ capacity?: string | null; capacityMl?: number | null } | string | null | undefined>,
): string[] {
    const byMl = new Map<number, string>();
    for (const row of rows) {
        const capacity = typeof row === "string" || row == null ? row : row.capacity;
        const capacityMl = typeof row === "object" && row !== null ? row.capacityMl : null;
        const ml = capacityMl != null && Number.isFinite(capacityMl)
            ? capacityMl
            : parseMatrixCapacityMl(capacity ?? "");
        if (ml == null || ml > 2000) continue;
        if (!byMl.has(ml)) byMl.set(ml, capacityOptionLabel(ml));
    }
    return [...byMl.entries()].sort((a, b) => a[0] - b[0]).map(([, label]) => label);
}

export function matrixCapacityMatches(
    row: { capacity?: string | null; capacityMl?: number | null } | string | null | undefined,
    selectedSize: string,
): boolean {
    if (!selectedSize) return true;
    const selectedMl = parseMatrixCapacityMl(selectedSize);
    const capacity = typeof row === "object" && row !== null ? row.capacity : row;
    const capacityMl = typeof row === "object" && row !== null ? row.capacityMl : null;
    const rowMl = capacityMl != null && Number.isFinite(capacityMl)
        ? capacityMl
        : parseMatrixCapacityMl(capacity ?? "");
    if (selectedMl != null && rowMl != null) return selectedMl === rowMl;
    return (capacity ?? "").trim() === selectedSize;
}

export function emptyMatrixFilters(): MatrixFilterState {
    return { search: "", size: "", finish: "", neck: "", closure: "" };
}

export type MatrixFamilyState<TConfigs> = {
    family: string | null;
    filters: MatrixFilterState;
    configs: TConfigs;
};

export function createMatrixFamilyState<TConfigs>(
    family: string | null,
    configs: TConfigs,
): MatrixFamilyState<TConfigs> {
    return { family, filters: emptyMatrixFilters(), configs };
}

/** Change only the family-owned refinements; configured bottle rows remain
 * available to the order and cart across family navigation. */
export function switchMatrixFamily<
    TConfigs,
    TState extends MatrixFamilyState<TConfigs>,
>(
    state: TState,
    family: string | null,
): TState {
    return { ...state, family, filters: emptyMatrixFilters() } as TState;
}

/** Incoming route changes can render before an event handler runs. In that
 * interval, never apply one family's filters to another family's rows. */
export function activeMatrixFilters<TConfigs>(
    state: MatrixFamilyState<TConfigs>,
    family: string | null,
): MatrixFilterState {
    return state.family === family ? state.filters : emptyMatrixFilters();
}
