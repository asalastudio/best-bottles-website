import { describe, expect, it } from "vitest";
import {
    capacityMlFromSlug,
    filterVariantsForGroupIntent,
    groupApplicatorIntent,
    parseProductSlug,
} from "../src/lib/products/group-variant-intent";
import { inferSkuApplicatorKind, isPlainScrewCapSku } from "../src/lib/products/sku-applicator-kind";

const circleCapGroup = [
    { websiteSku: "GBCrcl15Gl", graceSku: "GB-CIR-CLR-15ML-GLD-T", applicator: null, itemName: "Circle 15ml clear with shiny gold cap" },
    { websiteSku: "GBCrcl15Sl", graceSku: "GB-CIR-CLR-15ML-SLV-T", applicator: null, itemName: "Circle 15ml clear with shiny silver cap" },
    { websiteSku: "GBCrcl15BlkSht", graceSku: "GB-CIR-CLR-15ML-BLK-S", applicator: null, itemName: "Circle 15ml clear with short black cap" },
    { websiteSku: "GBCrcl15WhtSht", graceSku: "GB-CIR-WHT-15ML-WHT-S", applicator: null, itemName: "Circle 15ml clear with short white cap" },
];

const leakedSprayAndRoll = [
    { websiteSku: "GBCrcl15SpryCuMatt", graceSku: "GB-CIR-CLR-15ML-SPR-MCPR", applicator: "Fine Mist Sprayer", itemName: "Circle 15ml matte copper spray" },
    { websiteSku: "GBCrcl15SprySlMatt", graceSku: "GB-CIR-CLR-15ML-SPR-MSLV", applicator: "Fine Mist Sprayer", itemName: "Circle 15ml matte silver spray" },
    { websiteSku: "GBCrcl15RollCuMatt", graceSku: "GB-CIR-CLR-15ML-ROL-MCPR", applicator: "Plastic Roller Ball", itemName: "Circle 15ml matte copper roll-on" },
    { websiteSku: "GBCrcl15MtlRollCuMatt", graceSku: "GB-CIR-CLR-15ML-MRL-MCPR", applicator: "Metal Roller Ball", itemName: "Circle 15ml metal roller matte copper" },
];

describe("SKU applicator kind", () => {
    it("reads Circle 15 cap SKUs as screw-cap even when applicator is null", () => {
        for (const sku of circleCapGroup) {
            expect(inferSkuApplicatorKind(sku), sku.websiteSku).toBe("cap");
            expect(isPlainScrewCapSku(sku), sku.websiteSku).toBe(true);
        }
    });

    it("keeps spray and roll-on tokens off the cap kind", () => {
        expect(inferSkuApplicatorKind(leakedSprayAndRoll[0])).toBe("sprayer");
        expect(inferSkuApplicatorKind(leakedSprayAndRoll[2])).toBe("rollon");
        expect(inferSkuApplicatorKind(leakedSprayAndRoll[3])).toBe("rollon");
        expect(isPlainScrewCapSku(leakedSprayAndRoll[0])).toBe(false);
    });
});

describe("group slug applicator intent", () => {
    it("treats a bottle slug with no closure suffix as Cap", () => {
        expect(groupApplicatorIntent("circle-15ml-clear-13-415")).toBe("cap");
        expect(parseProductSlug("circle-15ml-clear-13-415")?.closure).toBeNull();
        expect(capacityMlFromSlug("circle-15ml-clear-13-415")).toBe(15);
    });

    it("reads sibling applicator suffixes", () => {
        expect(groupApplicatorIntent("circle-15ml-clear-13-415-finemist")).toBe("sprayer");
        expect(groupApplicatorIntent("circle-15ml-clear-13-415-rollon")).toBe("rollon");
        expect(groupApplicatorIntent("circle-30ml-clear-15-415-perfumespray")).toBe("sprayer");
    });

    it("does not invent intent for component slugs", () => {
        expect(groupApplicatorIntent("cap-closure-13-415")).toBeNull();
    });
});

describe("Cap PDP finish-rail isolation", () => {
    it("strips spray and roll-on SKUs from the Circle 15 Cap group", () => {
        const mixed = [...circleCapGroup, ...leakedSprayAndRoll];
        const kept = filterVariantsForGroupIntent("circle-15ml-clear-13-415", mixed);
        expect(kept.map((row) => row.websiteSku)).toEqual([
            "GBCrcl15Gl",
            "GBCrcl15Sl",
            "GBCrcl15BlkSht",
            "GBCrcl15WhtSht",
        ]);
    });

    it("still lists spray finishes on the Fine Mist sibling", () => {
        const kept = filterVariantsForGroupIntent(
            "circle-15ml-clear-13-415-finemist",
            [...circleCapGroup, ...leakedSprayAndRoll],
        );
        expect(kept.map((row) => row.websiteSku)).toEqual([
            "GBCrcl15SpryCuMatt",
            "GBCrcl15SprySlMatt",
        ]);
    });

    it("keeps both metal and plastic rollers on a roll-on page", () => {
        const kept = filterVariantsForGroupIntent(
            "circle-15ml-clear-13-415-rollon",
            [...circleCapGroup, ...leakedSprayAndRoll],
        );
        expect(kept.map((row) => row.websiteSku)).toEqual([
            "GBCrcl15RollCuMatt",
            "GBCrcl15MtlRollCuMatt",
        ]);
    });

    it("fails open when no SKU matches so an unknown family still renders", () => {
        const onlySpray = leakedSprayAndRoll.slice(0, 2);
        expect(filterVariantsForGroupIntent("unknown-family", onlySpray)).toEqual(onlySpray);
    });
});

const square15OpenMouth = [
    { websiteSku: "GBSqr15WhtSht", graceSku: "GB-SQR-CLR-15ML-WHT-S", applicator: null, itemName: "15 ml Clear Square short white cap" },
    { websiteSku: "GBSqr15BlkSht", graceSku: "GB-SQR-CLR-15ML-S", applicator: null, itemName: "15 ml Clear Square short black cap" },
    { websiteSku: "GBSqr15Gl", graceSku: "GB-SQR-CLR-15ML-GLD", applicator: null, itemName: "15 ml Clear Square shiny gold cap" },
    { websiteSku: "GBSqr15Sl", graceSku: "GB-SQR-CLR-15ML-SLV", applicator: null, itemName: "15 ml Clear Square shiny silver cap" },
];

const square15DisallowedOpenMouth = [
    { websiteSku: "GBSqr15CuMatt", graceSku: "GB-SQR-CLR-15ML-CPR", applicator: null, itemName: "15 ml Clear Square copper cap" },
    { websiteSku: "GBSqr15GlMatt", graceSku: "GB-SQR-CLR-15ML-MGLD", applicator: null, itemName: "15 ml Clear Square matte gold cap" },
    { websiteSku: "GBSqr15SlMatt", graceSku: "GB-SQR-CLR-15ML-MSLV", applicator: null, itemName: "15 ml Clear Square matte silver cap" },
    { websiteSku: "GBSqr15Blk", graceSku: "GB-SQR-CLR-15ML-BLK", applicator: null, itemName: "15 ml Clear Square plain black cap" },
];

describe("Square 15 ml open-mouth finish rail (ASA-195)", () => {
    it("keeps only short white, short black, shiny gold, and shiny silver on the open-mouth page", () => {
        const kept = filterVariantsForGroupIntent(
            "square-15ml-clear-13-415",
            [...square15OpenMouth, ...square15DisallowedOpenMouth, ...leakedSprayAndRoll],
        );
        expect(kept.map((row) => row.websiteSku)).toEqual([
            "GBSqr15WhtSht",
            "GBSqr15BlkSht",
            "GBSqr15Gl",
            "GBSqr15Sl",
        ]);
    });

    it("does not narrow Square 15 ml spray or roll-on rails with the open-mouth allowlist", () => {
        const spray = [
            { websiteSku: "GBSqr15SpryCuMatt", graceSku: "GB-SQR-CLR-15ML-SPR-MCPR", applicator: "Fine Mist Sprayer", itemName: "Square 15ml matte copper spray" },
            { websiteSku: "GBSqr15SpryGlSh", graceSku: "GB-SQR-CLR-15ML-SPR-SGLD", applicator: "Fine Mist Sprayer", itemName: "Square 15ml shiny gold spray" },
        ];
        expect(filterVariantsForGroupIntent("square-15ml-clear-13-415-finemist", spray).map((row) => row.websiteSku)).toEqual([
            "GBSqr15SpryCuMatt",
            "GBSqr15SpryGlSh",
        ]);

        const rollOn = [
            { websiteSku: "GBSqr15RollCuMatt", graceSku: "GB-SQR-CLR-15ML-ROL-MCPR", applicator: "Plastic Roller Ball", itemName: "Square 15ml matte copper roll-on" },
            { websiteSku: "GBSqr15RollBlkSh", graceSku: "GB-SQR-CLR-15ML-ROL-SBLK", applicator: "Plastic Roller Ball", itemName: "Square 15ml shiny black roll-on" },
        ];
        expect(filterVariantsForGroupIntent("square-15ml-clear-13-415-rollon", rollOn).map((row) => row.websiteSku)).toEqual([
            "GBSqr15RollCuMatt",
            "GBSqr15RollBlkSh",
        ]);
    });
});
