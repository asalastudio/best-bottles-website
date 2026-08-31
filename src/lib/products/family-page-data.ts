import { CYLINDER_9ML_17415_COHORT } from "./product-cohorts";

export interface FamilyPageSourceGroup {
    id: string;
    slug: string;
    family: string;
    capacity: string | null;
    capacityMl: number | null;
    neckThreadSize: string | null;
    color: string | null;
    variantCount: number;
    priceRangeMin: number | null;
    paperDollFamilyKey?: string | null;
    applicatorTypes?: string[] | null;
}

export interface FamilyPageSourceVariant {
    groupId: string;
    applicator: string | null;
}

export interface FamilyPageCohort {
    slug: string;
    capacityLabel: string;
    capacityMl: number;
    neckThreadSize: string;
    colors: string[];
    applicators: string[];
    variantCount: number;
    priceFrom: number | null;
    paperDollFamilyKey: string | null;
    isBuildable: boolean;
    groupSlugs: string[];
}

export interface FamilyPageData {
    family: string;
    totalReadyMadeGroups: number;
    totalVariants: number;
    cohorts: FamilyPageCohort[];
}

export interface ProductCohortSelector {
    family: string;
    capacityMl: number;
    neckThreadSize: string;
    paperDollFamilyKey: string;
}

function cohortSlug(family: string, capacityMl: number, neckThreadSize: string): string {
    if (
        family === CYLINDER_9ML_17415_COHORT.family
        && capacityMl === CYLINDER_9ML_17415_COHORT.capacityMl
        && neckThreadSize === CYLINDER_9ML_17415_COHORT.neckThreadSize
    ) {
        return CYLINDER_9ML_17415_COHORT.slug;
    }

    const familySlug = family.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `${familySlug}-${capacityMl}ml-${neckThreadSize.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function selectProductCohort(
    groups: readonly FamilyPageSourceGroup[],
    selector: ProductCohortSelector,
): FamilyPageSourceGroup[] {
    return groups.filter((group) =>
        group.variantCount > 0
        && group.family === selector.family
        && group.capacityMl === selector.capacityMl
        && group.neckThreadSize === selector.neckThreadSize
        && group.paperDollFamilyKey === selector.paperDollFamilyKey,
    );
}

export function buildFamilyPageData(
    family: string,
    groups: readonly FamilyPageSourceGroup[],
    variants: readonly FamilyPageSourceVariant[],
): FamilyPageData {
    const eligibleGroups = groups.filter((group) => group.family === family && group.variantCount > 0);
    const groupIds = new Set(eligibleGroups.map((group) => group.id));
    const eligibleVariants = variants.filter((variant) => groupIds.has(variant.groupId));
    const variantsByGroup = new Map<string, FamilyPageSourceVariant[]>();

    for (const variant of eligibleVariants) {
        const rows = variantsByGroup.get(variant.groupId) ?? [];
        rows.push(variant);
        variantsByGroup.set(variant.groupId, rows);
    }

    const cohortGroups = new Map<string, FamilyPageSourceGroup[]>();
    for (const group of eligibleGroups) {
        if (group.capacityMl == null || !group.neckThreadSize) continue;
        const key = `${group.capacityMl}::${group.neckThreadSize}`;
        const rows = cohortGroups.get(key) ?? [];
        rows.push(group);
        cohortGroups.set(key, rows);
    }

    const cohorts = [...cohortGroups.values()].map((rows): FamilyPageCohort => {
        const first = rows[0];
        const capacityMl = first.capacityMl!;
        const neckThreadSize = first.neckThreadSize!;
        const colors = [...new Set(rows.map((row) => row.color).filter((value): value is string => Boolean(value)))].sort();
        const cohortVariants = rows.flatMap((row) => variantsByGroup.get(row.id) ?? []);
        const applicators = [...new Set(
            cohortVariants.map((variant) => variant.applicator).filter((value): value is string => Boolean(value)),
        )].sort();
        const prices = rows.map((row) => row.priceRangeMin).filter((value): value is number => value != null && value > 0);
        const familyKeys = [...new Set(
            rows.map((row) => row.paperDollFamilyKey).filter((value): value is string => Boolean(value)),
        )];
        const paperDollFamilyKey = familyKeys.length === 1 ? familyKeys[0] : null;

        return {
            slug: cohortSlug(family, capacityMl, neckThreadSize),
            capacityLabel: first.capacity ?? `${capacityMl} ml`,
            capacityMl,
            neckThreadSize,
            colors,
            applicators,
            variantCount: cohortVariants.length,
            priceFrom: prices.length > 0 ? Math.min(...prices) : null,
            paperDollFamilyKey,
            isBuildable: Boolean(paperDollFamilyKey),
            groupSlugs: rows.map((row) => row.slug).sort(),
        };
    }).sort((a, b) =>
        a.capacityMl - b.capacityMl
        || a.neckThreadSize.localeCompare(b.neckThreadSize)
        || a.slug.localeCompare(b.slug),
    );

    return {
        family,
        totalReadyMadeGroups: eligibleGroups.length,
        totalVariants: eligibleVariants.length,
        cohorts,
    };
}

