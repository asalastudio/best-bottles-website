/**
 * The one rule that turns "this applicator + this finish" into a variant of the
 * current group. The desktop configurator commits through it and the mobile
 * picker previews through it, so what the customer sees while previewing is
 * exactly the variant confirmation will resolve to.
 *
 * Candidates are the variants of the requested applicator in stable SKU order;
 * the finish match wins, else the first candidate (the deterministic fallback
 * the desktop flow has always used when a colourway is not offered in the
 * other material).
 */
export type GuidedVariantSelection = {
    applicator: string | null | undefined;
    capOption: string | null | undefined;
};

export type GuidedVariantDeps<V> = {
    sku: (variant: V) => string | null;
    capFinish: (variant: V) => string;
    applicator: (variant: V) => string | null | undefined;
};

export function resolveGuidedVariant<V>(
    variants: readonly V[],
    selection: GuidedVariantSelection,
    deps: GuidedVariantDeps<V>,
): V | null {
    if (variants.length === 0) return null;
    const targetApplicator = selection.applicator ?? null;
    let candidates = variants.filter((variant) => (deps.applicator(variant) ?? null) === targetApplicator);
    if (candidates.length === 0 && targetApplicator === null) {
        candidates = [...variants];
    }
    candidates.sort((a, b) => (deps.sku(a) ?? "").localeCompare(deps.sku(b) ?? ""));
    if (selection.capOption) {
        return candidates.find((variant) => deps.capFinish(variant) === selection.capOption) ?? candidates[0] ?? null;
    }
    return candidates[0] ?? null;
}

/** True when the requested finish is really offered for that applicator (no fallback needed). */
export function guidedSelectionIsExact<V>(
    variants: readonly V[],
    selection: GuidedVariantSelection,
    deps: GuidedVariantDeps<V>,
): boolean {
    if (!selection.capOption) return true;
    const targetApplicator = selection.applicator ?? null;
    return variants.some((variant) =>
        (deps.applicator(variant) ?? null) === targetApplicator && deps.capFinish(variant) === selection.capOption);
}
