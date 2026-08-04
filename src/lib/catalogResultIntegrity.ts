import {
    applicatorBucketMatchesProductValues,
    type CatalogFilters,
} from "@/lib/catalogFilters";

type AuditableCatalogGroup = {
    _id: string;
    family: string | null;
    capacityMl: number | null;
    color: string | null;
    neckThreadSize: string | null;
    applicatorTypes?: string[] | null;
};

export type CatalogIntegrityResult =
    | {
        status: "verified";
        expectedCount: number;
        renderedCount: number;
        violatingGroupIds: [];
    }
    | {
        status: "count_mismatch" | "constraint_mismatch";
        expectedCount: number;
        renderedCount: number;
        violatingGroupIds: string[];
    };

function capacityMl(value: string): number | null {
    const match = value.match(/^(\d+(?:\.\d+)?)\s*ml\b/i);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
}

function violatesFilters(group: AuditableCatalogGroup, filters: CatalogFilters): boolean {
    if (filters.families.length > 0 && (!group.family || !filters.families.includes(group.family))) {
        return true;
    }
    if (filters.colors.length > 0 && (!group.color || !filters.colors.includes(group.color))) {
        return true;
    }
    if (filters.neckThreadSizes.length > 0 && (
        !group.neckThreadSize || !filters.neckThreadSizes.includes(group.neckThreadSize)
    )) {
        return true;
    }
    if (filters.capacities.length > 0) {
        const selected = filters.capacities
            .map(capacityMl)
            .filter((value): value is number => value !== null);
        if (group.capacityMl === null || !selected.includes(group.capacityMl)) return true;
    }
    if (filters.applicators.length > 0 && !filters.applicators.some((bucket) =>
        applicatorBucketMatchesProductValues(bucket, group.applicatorTypes ?? [])
    )) {
        return true;
    }
    return false;
}

export function auditCatalogResult(input: {
    filters: CatalogFilters;
    expectedCount: number;
    items: AuditableCatalogGroup[];
}): CatalogIntegrityResult {
    const violatingGroupIds = input.items
        .filter((group) => violatesFilters(group, input.filters))
        .map((group) => group._id);
    if (violatingGroupIds.length > 0) {
        return {
            status: "constraint_mismatch",
            expectedCount: input.expectedCount,
            renderedCount: input.items.length,
            violatingGroupIds,
        };
    }
    if (input.expectedCount !== input.items.length) {
        return {
            status: "count_mismatch",
            expectedCount: input.expectedCount,
            renderedCount: input.items.length,
            violatingGroupIds: [],
        };
    }
    return {
        status: "verified",
        expectedCount: input.expectedCount,
        renderedCount: input.items.length,
        violatingGroupIds: [],
    };
}
