export type MatrixFilterState = {
    search: string;
    size: string;
    finish: string;
    neck: string;
    closure: string;
};

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
