import { describe, expect, it } from "vitest";
import {
    buildFamilyPageData,
    selectProductCohort,
    type FamilyPageSourceGroup,
    type FamilyPageSourceVariant,
} from "@/lib/products/family-page-data";

const groups: FamilyPageSourceGroup[] = [
    {
        id: "classic-rollon",
        slug: "cylinder-9ml-clear-17-415-rollon",
        family: "Cylinder",
        capacity: "9 ml (0.3 oz)",
        capacityMl: 9,
        neckThreadSize: "17-415",
        color: "Clear",
        variantCount: 2,
        priceRangeMin: 0.55,
        paperDollFamilyKey: "CYL-9ML",
        applicatorTypes: ["Metal Roller Ball"],
    },
    {
        id: "classic-spray",
        slug: "cylinder-9ml-amber-17-415-finemist",
        family: "Cylinder",
        capacity: "9 ml (0.3 oz)",
        capacityMl: 9,
        neckThreadSize: "17-415",
        color: "Amber",
        variantCount: 1,
        priceRangeMin: 0.9,
        paperDollFamilyKey: "CYL-9ML",
        applicatorTypes: ["Fine Mist Sprayer"],
    },
    {
        id: "tall-rollon",
        slug: "tall-cylinder-9ml-clear-13-415-rollon",
        family: "Cylinder",
        capacity: "9 ml (0.3 oz)",
        capacityMl: 9,
        neckThreadSize: "13-415",
        color: "Clear",
        variantCount: 1,
        priceRangeMin: 0.7,
        paperDollFamilyKey: "TALLCYL-9ML",
        applicatorTypes: ["Metal Roller Ball"],
    },
    {
        id: "empty-group",
        slug: "cylinder-9ml-white-17-415-rollon",
        family: "Cylinder",
        capacity: "9 ml (0.3 oz)",
        capacityMl: 9,
        neckThreadSize: "17-415",
        color: "White",
        variantCount: 0,
        priceRangeMin: null,
        paperDollFamilyKey: null,
        applicatorTypes: ["Plastic Roller Ball"],
    },
];

const variants: FamilyPageSourceVariant[] = [
    { groupId: "classic-rollon", applicator: "Metal Roller Ball" },
    { groupId: "classic-rollon", applicator: "Plastic Roller Ball" },
    { groupId: "classic-spray", applicator: "Fine Mist Sprayer" },
    { groupId: "tall-rollon", applicator: "Metal Roller Ball" },
];

describe("family page data", () => {
    it("derives option breadth from product rows rather than group summaries", () => {
        const page = buildFamilyPageData("Cylinder", groups, variants);
        const classic = page.cohorts.find((cohort) => cohort.slug === "cylinder-9ml-17-415");

        expect(classic).toMatchObject({
            capacityMl: 9,
            neckThreadSize: "17-415",
            colors: ["Amber", "Clear"],
            applicators: ["Fine Mist Sprayer", "Metal Roller Ball", "Plastic Roller Ball"],
            variantCount: 3,
            paperDollFamilyKey: "CYL-9ML",
            isBuildable: true,
        });
    });

    it("keeps 9 ml 13-415 separate from 9 ml 17-415", () => {
        const page = buildFamilyPageData("Cylinder", groups, variants);

        expect(page.cohorts.map((cohort) => [cohort.capacityMl, cohort.neckThreadSize])).toEqual([
            [9, "13-415"],
            [9, "17-415"],
        ]);
    });

    it("omits zero-variant groups from family counts and colors", () => {
        const page = buildFamilyPageData("Cylinder", groups, variants);

        expect(page.totalReadyMadeGroups).toBe(3);
        expect(page.totalVariants).toBe(4);
        expect(page.cohorts.flatMap((cohort) => cohort.colors)).not.toContain("White");
    });

    it("selects only the exact family, capacity, neck, and paper doll key", () => {
        const selected = selectProductCohort(groups, {
            family: "Cylinder",
            capacityMl: 9,
            neckThreadSize: "17-415",
            paperDollFamilyKey: "CYL-9ML",
        });

        expect(selected.map((group) => group.id)).toEqual(["classic-rollon", "classic-spray"]);
    });
});

