import { describe, expect, it } from "vitest";
import {
    buildCylinderBuilderHref,
    buildCylinderConfigurationPreviewHref,
    buildCylinderFamilyPageModel,
    buildCylinderReadyMadeHref,
    classifyCylinderApplicatorSystem,
} from "@/lib/products/cylinder-family-page";

const groups = [
    {
        _id: "clear-rollon",
        slug: "cylinder-9ml-clear-17-415-rollon",
        displayName: "9ml Clear Cylinder Roll-On Bottle",
        family: "Cylinder",
        capacity: "9 ml (0.3 oz)",
        capacityMl: 9,
        color: "Clear",
        category: "Glass Bottle",
        bottleCollection: null,
        neckThreadSize: "17-415",
        variantCount: 2,
        priceRangeMin: 0.71,
        priceRangeMax: 0.85,
        paperDollFamilyKey: "CYL-9ML",
        applicatorTypes: ["Metal Roller Ball"],
    },
    {
        _id: "amber-spray",
        slug: "cylinder-9ml-amber-17-415-spray",
        displayName: "9ml Amber Cylinder Fine Mist Bottle",
        family: "Cylinder",
        capacity: "9 ml (0.3 oz)",
        capacityMl: 9,
        color: "Amber",
        category: "Glass Bottle",
        bottleCollection: null,
        neckThreadSize: "17-415",
        variantCount: 1,
        priceRangeMin: 0.8,
        priceRangeMax: 0.8,
        paperDollFamilyKey: "CYL-9ML",
        applicatorTypes: ["Fine Mist Sprayer"],
    },
    {
        _id: "tall-clear-rollon",
        slug: "tall-cylinder-9ml-clear-13-415-rollon",
        displayName: "9ml Tall Clear Cylinder Roll-On Bottle",
        family: "Cylinder",
        capacity: "9 ml (0.3 oz)",
        capacityMl: 9,
        color: "Clear",
        category: "Glass Bottle",
        bottleCollection: null,
        neckThreadSize: "13-415",
        variantCount: 1,
        priceRangeMin: 0.77,
        priceRangeMax: 0.77,
        paperDollFamilyKey: "TALLCYL-9ML",
        applicatorTypes: ["Metal Roller Ball"],
    },
];

const variantPreviewRows = [
    {
        groupId: "clear-rollon",
        variants: [
            { id: "metal", applicator: "Metal Roller Ball" },
            { id: "plastic", applicator: "Plastic Roller Ball" },
        ],
    },
    {
        groupId: "amber-spray",
        variants: [{ id: "spray", applicator: "Fine Mist Sprayer" }],
    },
    {
        groupId: "tall-clear-rollon",
        variants: [{ id: "tall", applicator: "Metal Roller Ball" }],
    },
];

describe("Cylinder family page model", () => {
    it("identifies the exact buildable cohort without merging the tall 13-415 bottle", () => {
        const model = buildCylinderFamilyPageModel(groups, variantPreviewRows);

        expect(model.featuredCohort).toMatchObject({
            slug: "cylinder-9ml-17-415",
            capacityMl: 9,
            neckThreadSize: "17-415",
            paperDollFamilyKey: "CYL-9ML",
            groupSlugs: [
                "cylinder-9ml-amber-17-415-spray",
                "cylinder-9ml-clear-17-415-rollon",
            ],
        });
        expect(model.featuredCohort.groupSlugs).not.toContain("tall-cylinder-9ml-clear-13-415-rollon");
    });

    it("keeps the 9 ml 13-415 conventional platform as a separate ready-made group", () => {
        const model = buildCylinderFamilyPageModel(groups, variantPreviewRows);

        expect(model.cards.map((card) => card.slug)).toEqual([
            "cylinder-9ml-clear-17-415-rollon",
            "cylinder-9ml-amber-17-415-spray",
            "tall-cylinder-9ml-clear-13-415-rollon",
        ]);
        expect(model.totalReadyMadeGroups).toBe(3);
        expect(model.totalVariants).toBe(4);
        expect(model.cards.find((card) => card.neckThreadSize === "13-415")?.paperDollFamilyKey)
            .toBe("TALLCYL-9ML");
    });

    it("derives roll-on breadth from product rows, not the incomplete group summary", () => {
        const model = buildCylinderFamilyPageModel(groups, variantPreviewRows);
        const rollon = model.cards.find((card) => card.id === "clear-rollon");

        expect(rollon?.applicatorSystems).toEqual(["Roll-On"]);
        expect(model.featuredCohort.applicators).toEqual([
            "Fine Mist Sprayer",
            "Metal Roller Ball",
            "Plastic Roller Ball",
        ]);
    });

    it("uses three customer-facing applicator types", () => {
        expect(classifyCylinderApplicatorSystem("Metal Roller Ball")).toBe("Roll-On");
        expect(classifyCylinderApplicatorSystem("Plastic Roller Ball")).toBe("Roll-On");
        expect(classifyCylinderApplicatorSystem("Fine Mist Sprayer")).toBe("Fine Mist Spray");
        expect(classifyCylinderApplicatorSystem("Lotion Pump")).toBe("Lotion Pump");
    });

    it("builds a specific unified-PDP builder URL", () => {
        expect(buildCylinderBuilderHref({
            glass: "Amber",
            applicator: "Roll-On",
            rollerMaterial: "Metal",
            finish: "Shiny Gold",
        })).toBe(
            "/products/cylinder-9ml-17-415?view=build&glass=Amber&applicator=Roll-On&roller=Metal&finish=Shiny+Gold",
        );
    });

    it("builds an honest Beauty preview URL before the layered release is ready", () => {
        expect(buildCylinderConfigurationPreviewHref({
            glass: "Amber",
            applicator: "Roll-On",
            rollerMaterial: "Metal",
            finish: "Shiny Gold",
        })).toBe(
            "/products/cylinder-9ml-17-415?view=beauty&glass=Amber&applicator=Roll-On&roller=Metal&finish=Shiny+Gold",
        );
    });

    it("routes only 9 ml 17-415 cards into the unified PDP", () => {
        expect(buildCylinderReadyMadeHref(groups[0], "GB-CYL-CLR-9ML-T-11")).toBe(
            "/products/cylinder-9ml-17-415?view=beauty&configuration=GB-CYL-CLR-9ML-T-11",
        );
        expect(buildCylinderReadyMadeHref(groups[2], "GB-TALLCYL-CLR-9ML-T-11")).toBe(
            "/products/tall-cylinder-9ml-clear-13-415-rollon",
        );
    });
});
