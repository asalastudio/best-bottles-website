import standards from "../../../data/asset-ledger/pdp-capacity-standards.json";

export type PdpCapacityTarget = {
    publishedPlateScale: number;
    midBodyWidthPercent?: number;
    glassHeightPercent?: number;
    source?: string;
};

type CapacityEntry = PdpCapacityTarget & {
    colors?: Record<string, PdpCapacityTarget>;
};

type FamilyEntry = {
    capacities?: Record<string, CapacityEntry>;
};

const DOCUMENT = standards;

export const PDP_STANDARD_CANVAS = DOCUMENT.canvas;
export const PDP_SAFE_MARGIN_RATIO = DOCUMENT.gates.safeMarginRatio;
export const PDP_MAX_FILL_RATIO = DOCUMENT.gates.maxFillRatio;
export const PDP_MIN_CAPACITY_MIDW_GAP = DOCUMENT.gates.minCapacityMidWGapPercent;
export const PDP_CAP_OFF_FIT_SCALE = DOCUMENT.capOffFitScale;

export function normalizePdpFamily(family: string | null | undefined): string {
    return (family ?? "").trim().toLowerCase().replace(/\s+/g, "-");
}

function familyEntry(family: string | null | undefined): FamilyEntry | undefined {
    const key = normalizePdpFamily(family);
    const families = DOCUMENT.families as Record<string, FamilyEntry>;
    return families[key];
}

export function pdpCapacityTarget(
    family: string | null | undefined,
    capacityMl: number | null | undefined,
    color?: string | null,
): PdpCapacityTarget | null {
    if (capacityMl == null || !Number.isFinite(capacityMl)) return null;
    const entry = familyEntry(family)?.capacities?.[String(capacityMl)];
    if (!entry) return null;
    const colorKey = (color ?? "").trim().toLowerCase();
    if (colorKey && entry.colors?.[colorKey]) return entry.colors[colorKey];
    if (entry.publishedPlateScale) return entry;
    return null;
}

/**
 * Paint-time scale for a published plate. Never greater than 1 — the standard
 * sizes the glass down to the lock; it does not enlarge a small bake.
 */
export function pdpPublishedPlateScale(
    family: string | null | undefined,
    capacityMl: number | null | undefined,
    color?: string | null,
): number {
    const target = pdpCapacityTarget(family, capacityMl, color);
    if (target?.publishedPlateScale && target.publishedPlateScale > 0 && target.publishedPlateScale < 1) {
        return target.publishedPlateScale;
    }
    const key = normalizePdpFamily(family);
    if ((DOCUMENT.overflowFamilies as string[]).includes(key)) {
        return DOCUMENT.overflowPublishedPlateScale;
    }
    return 1;
}

export function circleCapacityTargets(): Record<number, PdpCapacityTarget> {
    const capacities = DOCUMENT.families.circle.capacities;
    return {
        15: capacities["15"],
        30: capacities["30"],
        50: capacities["50"],
        100: capacities["100"],
    };
}
