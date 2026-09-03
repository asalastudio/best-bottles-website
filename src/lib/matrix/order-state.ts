type MatrixConfiguration<TComponent> = {
    component?: TComponent | null;
    qty: number;
};

export type RetainedMatrixConfiguration<TRow, TComponent> = {
    row: TRow;
    configuration: MatrixConfiguration<TComponent>;
};

export type RetainedMatrixConfigurations<TRow, TComponent> = Record<
    string,
    RetainedMatrixConfiguration<TRow, TComponent>
>;

/** Capture only an explicit, server-resolved selection. Clearing the component
 * removes its order snapshot instead of leaving a stale cart line behind. */
export function retainMatrixConfiguration<TRow, TComponent>(
    retained: RetainedMatrixConfigurations<TRow, TComponent>,
    identity: string,
    row: TRow,
    configuration: MatrixConfiguration<TComponent>,
): RetainedMatrixConfigurations<TRow, TComponent> {
    if (configuration.component === undefined) {
        const remaining = { ...retained };
        delete remaining[identity];
        return remaining;
    }
    return {
        ...retained,
        [identity]: { row, configuration },
    };
}

/** Prefer newly received server truth for visible identities without touching
 * retained rows belonging to other families. */
export function reconcileRetainedMatrixRows<TRow, TComponent>(
    retained: RetainedMatrixConfigurations<TRow, TComponent>,
    currentRows: readonly TRow[],
    identityForRow: (row: TRow) => string,
    resolveComponent?: (row: TRow, component: TComponent) => TComponent | undefined,
): RetainedMatrixConfigurations<TRow, TComponent> {
    const currentByIdentity = new Map(currentRows.map((row) => [identityForRow(row), row]));
    let changed = false;
    const next: RetainedMatrixConfigurations<TRow, TComponent> = {};

    for (const [identity, entry] of Object.entries(retained)) {
        const currentRow = currentByIdentity.get(identity);
        if (!currentRow) {
            next[identity] = entry;
            continue;
        }
        const selectedComponent = entry.configuration.component;
        const component = selectedComponent && resolveComponent
            ? resolveComponent(currentRow, selectedComponent)
            : selectedComponent;
        next[identity] = {
            row: currentRow,
            configuration: { ...entry.configuration, component },
        };
        changed = changed || currentRow !== entry.row || component !== selectedComponent;
    }

    return changed ? next : retained;
}

/** Exact retained rows, not the currently visible filter result, own the
 * matrix order and Add-to-Cart payload. */
export function retainedMatrixCartLines<TRow, TComponent>(
    retained: RetainedMatrixConfigurations<TRow, TComponent>,
) {
    return Object.values(retained)
        .filter((entry) => entry.configuration.component !== undefined && entry.configuration.qty > 0)
        .map(({ row, configuration }) => ({
            row,
            component: configuration.component ?? null,
            quantity: configuration.qty,
        }));
}
