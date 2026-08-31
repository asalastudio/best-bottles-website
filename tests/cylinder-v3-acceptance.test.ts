import { describe, expect, it } from "vitest";
import { summarizeCylinderStorefrontAudit } from "@/lib/products/cylinder-v3-release";

const passingSnapshot = {
    familyKey: "CYL-9ML",
    capacityMl: 9,
    neckThreadSize: "17-415",
    groupCount: 15,
    configurationSkus: Array.from({ length: 143 }, (_, index) => `CYL-${index + 1}`).concat([
        "GB-CYL-WHT-9ML-MRL-WHT",
        "GB-CYL-WHT-9ML-ROL-WHT",
    ]),
    wrongNeckSkus: [],
    storefrontReady: true,
    canvasWidth: 2080,
    canvasHeight: 2288,
    layerCounts: { body: 5, cap: 10, roller: 2, sprayer: 6, pump: 3 },
    invalidLayerDimensions: [],
    editorialHeroUrl: "https://cdn.sanity.io/images/project/production/cylinder-hero.jpg",
};

describe("Cylinder V3 release gate", () => {
    it("passes only the exact 15-group, 145-SKU, 2080×2288 storefront contract", () => {
        expect(summarizeCylinderStorefrontAudit(passingSnapshot)).toEqual({
            ok: true,
            issues: [],
        });
    });

    it("reports the current two-SKU and unreleased-asset gaps without weakening the contract", () => {
        const result = summarizeCylinderStorefrontAudit({
            ...passingSnapshot,
            configurationSkus: passingSnapshot.configurationSkus.slice(0, 143),
            storefrontReady: false,
            canvasWidth: 1000,
            canvasHeight: 1300,
            layerCounts: { body: 5, cap: 10, roller: 2, sprayer: 6, pump: 3 },
            invalidLayerDimensions: ["body:CLR"],
            editorialHeroUrl: null,
        });

        expect(result.ok).toBe(false);
        expect(result.issues).toEqual(expect.arrayContaining([
            "Expected 145 unique configurations; received 143",
            "Missing Swirl metal roller + white cap SKU GB-CYL-WHT-9ML-MRL-WHT",
            "Missing Swirl plastic roller + white cap SKU GB-CYL-WHT-9ML-ROL-WHT",
            "Sanity Paper Doll family is not storefront-ready",
            "Expected a 2080×2288 Paper Doll canvas; received 1000×1300",
            "1 Paper Doll layer has invalid dimensions",
            "Cylinder editorial hero is missing",
        ]));
    });

    it("fails if a 9 mL 13-415 SKU enters the pilot", () => {
        const result = summarizeCylinderStorefrontAudit({
            ...passingSnapshot,
            wrongNeckSkus: ["GB-TALLCYL-CLR-9ML-MRL-SGLD"],
        });

        expect(result.issues).toContain("Found 1 configuration from a non-17-415 platform");
    });
});
