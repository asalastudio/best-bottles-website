import type { CatalogSearchGroup } from "@/lib/catalogSearchFallback";
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

export const CYLINDER_9ML_BUILDER_OPTIONS = Object.freeze({
    glassColors: ["Clear", "Amber", "Frosted", "Cobalt Blue", "Swirl"],
    applicatorSystems: ["Roll-On", "Fine Mist Spray", "Lotion Pump"] as CylinderApplicatorSystem[],
    rollerMaterials: ["Metal", "Plastic"],
    rollonFinishes: [
        "Black Dotted",
        "Matte Copper",
        "Matte Gold",
        "Matte Silver",
        "Pink Dotted",
        "Shiny Black",
        "Shiny Gold",
        "Shiny Silver",
        "Silver Dotted",
        "White",
    ],
    sprayFinishes: ["Black", "Gold", "Matte Silver", "Red", "Shiny Silver", "Turquoise"],
    lotionFinishes: ["Black", "Gold", "Matte Silver"],
});

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
    const variantsByGroup = new Map(variantRows.map((row) => [row.groupId, row.variants]));
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

    const cards = cylinderGroups.map((group): CylinderFamilyCardModel => {
        const applicators = variantsByGroup.get(group._id)?.map((variant) => variant.applicator) ?? group.applicatorTypes ?? [];
        const applicatorSystems = [...new Set(
            applicators
                .map(classifyCylinderApplicatorSystem)
                .filter((value): value is CylinderApplicatorSystem => Boolean(value)),
        )];
        return { ...group, id: group._id, applicatorSystems };
    });

    return {
        family: "Cylinder",
        featuredCohort,
        totalReadyMadeGroups: familyData.totalReadyMadeGroups,
        totalVariants: familyData.totalVariants,
        cards,
    };
}

export function buildCylinderBuilderHref(selection?: {
    glass?: string;
    applicator?: CylinderApplicatorSystem;
    rollerMaterial?: string;
    finish?: string;
}): string {
    const params = new URLSearchParams({ view: "build" });
    if (selection?.glass) params.set("glass", selection.glass);
    if (selection?.applicator) params.set("applicator", selection.applicator);
    if (selection?.rollerMaterial && selection.applicator === "Roll-On") {
        params.set("roller", selection.rollerMaterial);
    }
    if (selection?.finish) params.set("finish", selection.finish);
    return `/products/${CYLINDER_9ML_17415_COHORT.slug}?${params.toString()}`;
}
