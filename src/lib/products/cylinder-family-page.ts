import type { CatalogSearchGroup } from "@/lib/catalogSearchFallback";
import { APPLICATOR_NAV, type ApplicatorNavValue } from "@/lib/catalogFilters";
import {
    buildFamilyPageData,
    type FamilyPageCohort,
} from "@/lib/products/family-page-data";
import { CYLINDER_9ML_17415_COHORT } from "@/lib/products/product-cohorts";

export type CylinderApplicatorSystem = "Roll-On" | "Fine Mist Spray" | "Lotion Pump";

export type CylinderFamilyVariantPreviewRow = {
    groupId: string;
    variants: Array<{
        applicator?: string | null;
    }>;
};

export type CylinderFamilyCardModel = CatalogSearchGroup & {
    id: string;
    applicatorSystems: CylinderApplicatorSystem[];
};

export type CylinderFamilyPageModel = {
    family: "Cylinder";
    featuredCohort: FamilyPageCohort;
    totalReadyMadeGroups: number;
    totalVariants: number;
    cards: CylinderFamilyCardModel[];
};

export type CylinderApplicationOption = {
    value: ApplicatorNavValue;
    label: string;
    description: string;
    count: number;
};

export function buildCylinderApplicationOptions(
    applicatorFacets: Readonly<Record<string, number>>,
): CylinderApplicationOption[] {
    return APPLICATOR_NAV.flatMap((application) => {
        const count = application.buckets.reduce(
            (total, bucket) => total + (applicatorFacets[bucket] ?? 0),
            0,
        );
        return count > 0 ? [{
            value: application.value,
            label: application.label,
            description: application.subtitle,
            count,
        }] : [];
    });
}

export function classifyCylinderApplicatorSystem(
    applicator: string | null | undefined,
): CylinderApplicatorSystem | null {
    const normalized = applicator?.trim().toLowerCase() ?? "";
    if (normalized.includes("roller") || normalized.includes("roll-on")) return "Roll-On";
    if (normalized.includes("mist") || normalized.includes("spray") || normalized.includes("atomizer")) {
        return "Fine Mist Spray";
    }
    if (normalized.includes("lotion") || normalized.includes("pump")) return "Lotion Pump";
    return null;
}

export function buildCylinderFamilyPageModel(
    groups: readonly CatalogSearchGroup[],
    variantRows: readonly CylinderFamilyVariantPreviewRow[],
): CylinderFamilyPageModel {
    const cylinderGroups = groups.filter((group) => group.family === "Cylinder" && group.variantCount > 0);
    const familyData = buildFamilyPageData(
        "Cylinder",
        cylinderGroups.map((group) => ({
            id: group._id,
            slug: group.slug,
            family: group.family!,
            capacity: group.capacity,
            capacityMl: group.capacityMl,
            neckThreadSize: group.neckThreadSize,
            color: group.color,
            variantCount: group.variantCount,
            priceRangeMin: group.priceRangeMin,
            paperDollFamilyKey: group.paperDollFamilyKey ?? null,
            applicatorTypes: group.applicatorTypes ?? [],
        })),
        variantRows.flatMap((row) => row.variants.map((variant) => ({
            groupId: row.groupId,
            applicator: variant.applicator ?? null,
        }))),
    );
    const featuredCohort = familyData.cohorts.find((cohort) =>
        cohort.slug === CYLINDER_9ML_17415_COHORT.slug
        && cohort.capacityMl === CYLINDER_9ML_17415_COHORT.capacityMl
        && cohort.neckThreadSize === CYLINDER_9ML_17415_COHORT.neckThreadSize
        && cohort.paperDollFamilyKey === CYLINDER_9ML_17415_COHORT.paperDollFamilyKey,
    );
    if (!featuredCohort) {
        throw new Error("Cylinder family page is missing the exact CYL-9ML 17-415 featured cohort.");
    }

    const cards = buildCylinderFamilyCards(cylinderGroups, variantRows);

    return {
        family: "Cylinder",
        featuredCohort,
        totalReadyMadeGroups: familyData.totalReadyMadeGroups,
        totalVariants: familyData.totalVariants,
        cards,
    };
}

export function buildCylinderFamilyCards(
    groups: readonly CatalogSearchGroup[],
    variantRows: readonly CylinderFamilyVariantPreviewRow[],
): CylinderFamilyCardModel[] {
    const variantsByGroup = new Map(variantRows.map((row) => [row.groupId, row.variants]));
    return groups
        .filter((group) => group.family === "Cylinder" && group.variantCount > 0)
        .map((group): CylinderFamilyCardModel => {
        const applicators = variantsByGroup.get(group._id)?.map((variant) => variant.applicator) ?? group.applicatorTypes ?? [];
        const applicatorSystems = [...new Set(
            applicators
                .map(classifyCylinderApplicatorSystem)
                .filter((value): value is CylinderApplicatorSystem => Boolean(value)),
        )];
            return { ...group, id: group._id, applicatorSystems };
        });
}

export function summarizeCylinderRefineResults(cards: readonly CylinderFamilyCardModel[]) {
    return {
        groupCount: cards.length,
        configurationCount: cards.reduce((total, card) => total + card.variantCount, 0),
    };
}

type CylinderFamilySelection = {
    glass?: string;
    applicator?: CylinderApplicatorSystem;
    rollerMaterial?: string;
    finish?: string;
};

function buildCylinderConfigurationHref(view: "beauty" | "build", selection?: CylinderFamilySelection): string {
    const params = new URLSearchParams({ view });
    if (selection?.glass) params.set("glass", selection.glass);
    if (selection?.applicator) params.set("applicator", selection.applicator);
    if (selection?.rollerMaterial && selection.applicator === "Roll-On") {
        params.set("roller", selection.rollerMaterial);
    }
    if (selection?.finish) params.set("finish", selection.finish);
    return `/products/${CYLINDER_9ML_17415_COHORT.slug}?${params.toString()}`;
}

export function buildCylinderBuilderHref(selection?: CylinderFamilySelection): string {
    return buildCylinderConfigurationHref("build", selection);
}

export function buildCylinderConfigurationPreviewHref(selection?: CylinderFamilySelection): string {
    return buildCylinderConfigurationHref("beauty", selection);
}

export function buildCylinderReadyMadeHref(
    group: Pick<CatalogSearchGroup, "slug" | "family" | "capacityMl" | "neckThreadSize" | "paperDollFamilyKey">,
    graceSku?: string | null,
): string {
    const isUnifiedCohort = group.family === CYLINDER_9ML_17415_COHORT.family
        && group.capacityMl === CYLINDER_9ML_17415_COHORT.capacityMl
        && group.neckThreadSize === CYLINDER_9ML_17415_COHORT.neckThreadSize
        && group.paperDollFamilyKey === CYLINDER_9ML_17415_COHORT.paperDollFamilyKey;
    if (!isUnifiedCohort) return `/products/${group.slug}`;
    const params = new URLSearchParams({ view: "beauty" });
    if (graceSku) params.set("configuration", graceSku);
    return `/products/${CYLINDER_9ML_17415_COHORT.slug}?${params.toString()}`;
}
