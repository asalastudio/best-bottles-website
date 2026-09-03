import {
    APPLICATOR_NAV,
    normalizeApplicatorBuckets,
    parseCapacityLabelMl,
    type ApplicatorNavValue,
} from "@/lib/catalogFilters";

export type ProductGroupRelationSource = {
    slug: string;
    displayName: string;
    family: string;
    capacity?: string | null;
    capacityMl?: number | null;
    color?: string | null;
    neckThreadSize?: string | null;
    applicatorTypes?: readonly string[];
    heroImageUrl?: string | null;
    priceRangeMin?: number | null;
    variantCount?: number;
};

export type ProductGroupRelation = {
    slug: string;
    displayName: string;
    family: string;
    capacity: string | null;
    capacityMl: number | null;
    color: string | null;
    application: ApplicatorNavValue | null;
    applicationLabel: string | null;
    neckThreadSize: string | null;
    neckThreadLabel: string | null;
    heroImageUrl: string | null;
    priceRangeMin: number | null;
    variantCount: number;
    isCurrent: boolean;
};

export type FocusedPdpRelations = {
    currentApplication: ApplicatorNavValue | null;
    sameApplicationSizes: ProductGroupRelation[];
    otherApplications: ProductGroupRelation[];
};

type PrimaryProductGroupIdentity = {
    primaryWebsiteSku?: string | null;
    primaryGraceSku?: string | null;
};

type ProductVariantIdentity = {
    websiteSku?: string | null;
    graceSku?: string | null;
};

/**
 * Resolve the group's primary product from catalog identity only. Website SKU
 * is authoritative; optional media must never change the selected product.
 */
export function selectPrimaryProductVariant<T extends ProductVariantIdentity>(
    group: PrimaryProductGroupIdentity,
    variants: readonly T[],
): T | null {
    const primaryWebsiteSku = group.primaryWebsiteSku?.trim();
    if (primaryWebsiteSku) {
        const websitePrimary = variants.find((variant) => variant.websiteSku === primaryWebsiteSku);
        if (websitePrimary) return websitePrimary;
    }

    const primaryGraceSku = group.primaryGraceSku?.trim();
    if (primaryGraceSku) {
        const gracePrimary = variants.find((variant) => variant.graceSku === primaryGraceSku);
        if (gracePrimary) return gracePrimary;
    }

    return variants.find((variant) => Boolean(variant.websiteSku?.trim()))
        ?? variants.find((variant) => Boolean(variant.graceSku?.trim()))
        ?? null;
}

/** Resolve raw product applicator values through the catalog's one canonical application vocabulary. */
export function canonicalApplicationForGroup(
    group: Pick<ProductGroupRelationSource, "applicatorTypes">,
): ApplicatorNavValue | null {
    const buckets = new Set(normalizeApplicatorBuckets(group.applicatorTypes ?? []));
    return APPLICATOR_NAV.find((application) => (
        application.buckets.some((bucket) => buckets.has(bucket))
    ))?.value ?? null;
}

function relationForGroup(
    group: ProductGroupRelationSource,
    currentSlug: string,
): ProductGroupRelation {
    const application = canonicalApplicationForGroup(group);
    const applicationLabel = APPLICATOR_NAV.find((candidate) => candidate.value === application)?.label ?? null;
    const neckThreadSize = group.neckThreadSize?.trim() || null;
    return {
        slug: group.slug,
        displayName: group.displayName,
        family: group.family,
        capacity: group.capacity ?? null,
        capacityMl: group.capacityMl ?? null,
        color: group.color ?? null,
        application,
        applicationLabel,
        neckThreadSize,
        neckThreadLabel: neckThreadSize ? `${neckThreadSize} neck finish` : null,
        heroImageUrl: group.heroImageUrl ?? null,
        priceRangeMin: group.priceRangeMin ?? null,
        variantCount: group.variantCount ?? 0,
        isCurrent: group.slug === currentSlug,
    };
}

function compareRelations(a: ProductGroupRelation, b: ProductGroupRelation): number {
    if (a.capacityMl !== b.capacityMl) {
        if (a.capacityMl == null) return 1;
        if (b.capacityMl == null) return -1;
        return a.capacityMl - b.capacityMl;
    }
    const applicationOrder = (value: ApplicatorNavValue | null) => {
        const index = APPLICATOR_NAV.findIndex((candidate) => candidate.value === value);
        return index === -1 ? APPLICATOR_NAV.length : index;
    };
    const applicationDelta = applicationOrder(a.application) - applicationOrder(b.application);
    if (applicationDelta !== 0) return applicationDelta;
    return a.slug.localeCompare(b.slug);
}

function hasGenuineCapacityDifference(
    currentGroup: ProductGroupRelationSource,
    candidate: ProductGroupRelationSource,
): boolean {
    const numericCapacity = (group: ProductGroupRelationSource) => (
        typeof group.capacityMl === "number" && Number.isFinite(group.capacityMl)
            ? group.capacityMl
            : group.capacity
                ? parseCapacityLabelMl(group.capacity)
                : null
    );
    const currentMl = numericCapacity(currentGroup);
    const candidateMl = numericCapacity(candidate);
    if (currentMl != null && candidateMl != null) return currentMl !== candidateMl;

    const currentLabel = currentGroup.capacity?.trim().toLowerCase() || null;
    const candidateLabel = candidate.capacity?.trim().toLowerCase() || null;
    return currentLabel != null && candidateLabel != null && currentLabel !== candidateLabel;
}

/**
 * Partition one family's canonical product groups by purchasing intent.
 * A neck finish is descriptive relation metadata here; it never establishes compatibility.
 */
export function buildFocusedPdpRelations(
    currentGroup: ProductGroupRelationSource,
    familyGroups: readonly ProductGroupRelationSource[],
): FocusedPdpRelations {
    const currentApplication = canonicalApplicationForGroup(currentGroup);
    const byCanonicalSlug = new Map<string, ProductGroupRelationSource>();

    for (const group of [currentGroup, ...familyGroups]) {
        if (group.family !== currentGroup.family || byCanonicalSlug.has(group.slug)) continue;
        byCanonicalSlug.set(group.slug, group);
    }

    const sameApplicationSizes: ProductGroupRelation[] = [];
    const otherApplications: ProductGroupRelation[] = [];
    for (const group of byCanonicalSlug.values()) {
        const relation = relationForGroup(group, currentGroup.slug);
        if (relation.application === currentApplication) {
            if (relation.isCurrent || hasGenuineCapacityDifference(currentGroup, group)) {
                sameApplicationSizes.push(relation);
            }
        } else {
            otherApplications.push(relation);
        }
    }

    sameApplicationSizes.sort(compareRelations);
    otherApplications.sort(compareRelations);
    return { currentApplication, sameApplicationSizes, otherApplications };
}
