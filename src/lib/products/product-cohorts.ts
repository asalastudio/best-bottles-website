export const CYLINDER_9ML_17415_COHORT = {
    slug: "cylinder-9ml-17-415",
    family: "Cylinder",
    capacityMl: 9,
    neckThreadSize: "17-415",
    paperDollFamilyKey: "CYL-9ML",
} as const;

export interface ProductCohortGroupIdentity {
    family: string | null;
    capacityMl: number | null;
    neckThreadSize: string | null;
    paperDollFamilyKey?: string | null;
}

export function isCylinder9ml17415Group(group: ProductCohortGroupIdentity): boolean {
    return group.family === CYLINDER_9ML_17415_COHORT.family
        && group.capacityMl === CYLINDER_9ML_17415_COHORT.capacityMl
        && group.neckThreadSize === CYLINDER_9ML_17415_COHORT.neckThreadSize
        && group.paperDollFamilyKey === CYLINDER_9ML_17415_COHORT.paperDollFamilyKey;
}

