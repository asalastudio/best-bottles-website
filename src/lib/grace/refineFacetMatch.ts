import {
    APPLICATOR_BUCKETS,
    SPECIALTY_NECK_VALUE,
    canonicalGlassColor,
    expandCapacityFilterValues,
    parseCapacityLabelMl,
    rollerMaterialMatchesProductValues,
    type CatalogFilters,
    type RollerMaterial,
} from "@/lib/catalogFilters";

/**
 * Apply the shopper's active Refine facets to rows Grace's own catalogue search
 * returned.
 *
 * Grace reads a request the way a shopper wrote it ("10 ml roll-on bottle with
 * a gold cap"); the storefront's search box needs every word to appear in a
 * group's text. Until 2026-09-25 the gateway pushed Grace's whole sentence
 * through the storefront search whenever the page carried a Refine state (every
 * page does — the homepage carries an empty one), found nothing, and Grace told
 * the customer we do not carry the product. This module keeps the Refine state
 * authoritative for what it actually says (family, size, glass colour, neck,
 * applicator, roller material, category) and leaves the words to Grace's search.
 */

export type RefineFacetRow = {
    family?: string | null;
    category?: string | null;
    capacityMl?: number | null;
    capacity?: string | null;
    color?: string | null;
    rawColor?: string | null;
    canonicalColor?: string | null;
    neckThreadSize?: string | null;
    applicator?: string | null;
};

export type ActiveRefineFacets = {
    families: string[];
    colors: string[];
    /** Every exact millilitre size the selected capacity values expand to. */
    capacityMls: number[];
    /** The capacity values as selected, for messages. */
    capacityLabels: string[];
    neckThreadSizes: string[];
    /** Canonical applicator bucket keys (rollon, finemist, …). */
    applicators: string[];
    rollerMaterials: RollerMaterial[];
};

/** A whole CatalogFilters object is accepted; only the facet keys are read. */
type FacetSource = Partial<CatalogFilters>;

/**
 * The facets a shopper actually has active. Search text, sort, view, price and
 * shop collections are not facets a product row can be checked against here,
 * so they never make the state "active" on their own. Category is left to
 * Grace's own search as well: the category names the model passes are the
 * product-group vocabulary ("Roll-On Bottle"), which live product rows do not
 * carry — applying it kept two retired Cylinder rows and dropped every real
 * 10 ml roll-on on the first live turn after this module shipped.
 */
export function activeRefineFacets(filters: FacetSource | null | undefined): ActiveRefineFacets | null {
    if (!filters) return null;
    const families = (filters.families ?? []).map((value) => value.trim()).filter(Boolean);
    const colors = (filters.colors ?? [])
        .map((value) => canonicalGlassColor(value) ?? value.trim())
        .filter(Boolean);
    const capacityLabels = (filters.capacities ?? []).map((value) => value.trim()).filter(Boolean);
    const capacityMls = Array.from(new Set(
        expandCapacityFilterValues(capacityLabels)
            .map(parseCapacityLabelMl)
            .filter((value): value is number => value != null),
    ));
    const neckThreadSizes = (filters.neckThreadSizes ?? []).map((value) => value.trim()).filter(Boolean);
    const applicators = (filters.applicators ?? []).map((value) => value.trim()).filter(Boolean);
    const rollerMaterials = ((filters.rollerMaterials ?? []) as readonly string[])
        .filter((value): value is RollerMaterial => value === "metal" || value === "plastic");
    const active = families.length > 0
        || colors.length > 0
        || capacityLabels.length > 0
        || neckThreadSizes.length > 0
        || applicators.length > 0
        || rollerMaterials.length > 0;
    if (!active) return null;
    return { families, colors, capacityMls, capacityLabels, neckThreadSizes, applicators, rollerMaterials };
}

export function describeRefineFacets(facets: ActiveRefineFacets): string {
    const parts: string[] = [];
    if (facets.families.length) parts.push(`family ${facets.families.join("/")}`);
    if (facets.capacityLabels.length) parts.push(`capacity ${facets.capacityLabels.join("/")}`);
    if (facets.colors.length) parts.push(`glass colour ${facets.colors.join("/")}`);
    if (facets.neckThreadSizes.length) parts.push(`neck ${facets.neckThreadSizes.join("/")}`);
    if (facets.applicators.length) parts.push(`applicator ${facets.applicators.join("/")}`);
    if (facets.rollerMaterials.length) parts.push(`roller ${facets.rollerMaterials.join("/")}`);
    return parts.join(", ");
}

function applicatorBucketOf(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    return APPLICATOR_BUCKETS.find((bucket) => (bucket.productValues as readonly string[]).includes(trimmed))?.value ?? null;
}

export function rowMatchesRefineFacets(row: RefineFacetRow, facets: ActiveRefineFacets): boolean {
    if (facets.families.length && !(row.family && facets.families.includes(row.family))) return false;
    if (facets.capacityMls.length) {
        const ml = typeof row.capacityMl === "number"
            ? row.capacityMl
            : row.capacity ? parseCapacityLabelMl(row.capacity) : null;
        if (ml == null || !facets.capacityMls.some((value) => Math.abs(value - ml) < 1e-6)) return false;
    }
    if (facets.colors.length) {
        const colour = canonicalGlassColor(row.canonicalColor ?? row.color ?? row.rawColor ?? null);
        if (!colour || !facets.colors.includes(colour)) return false;
    }
    if (facets.neckThreadSizes.length) {
        const explicit = facets.neckThreadSizes.filter((value) => value !== SPECIALTY_NECK_VALUE);
        const wantsSpecialty = facets.neckThreadSizes.includes(SPECIALTY_NECK_VALUE);
        const neck = row.neckThreadSize?.trim() ?? "";
        // "Specialty" means every non-standard neck; without that list here a
        // specialty selection is never used to exclude a row.
        if (!explicit.includes(neck) && !wantsSpecialty) return false;
    }
    if (facets.applicators.length) {
        const bucket = applicatorBucketOf(row.applicator);
        if (!bucket || !facets.applicators.includes(bucket)) return false;
    }
    if (facets.rollerMaterials.length) {
        const types = row.applicator?.trim() ? [row.applicator.trim()] : [];
        if (!facets.rollerMaterials.some((material) => rollerMaterialMatchesProductValues(material, types))) return false;
    }
    return true;
}

export function applyRefineFacets<T extends RefineFacetRow>(
    rows: readonly T[],
    filters: FacetSource | null | undefined,
): { rows: T[]; active: ActiveRefineFacets | null; excluded: number } {
    const active = activeRefineFacets(filters);
    if (!active) return { rows: [...rows], active: null, excluded: 0 };
    const kept = rows.filter((row) => rowMatchesRefineFacets(row, active));
    return { rows: kept, active, excluded: rows.length - kept.length };
}
