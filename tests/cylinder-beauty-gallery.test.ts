import { describe, expect, it } from "vitest";
import {
    assertStorefrontCylinderBeautyGallery,
    resolveCylinderBeautyHero,
} from "@/lib/products/cylinder-beauty-gallery";

const heroKeys = ["CLR", "AMB", "BLU", "FRS", "SWL"] as const;

function gallery(overrides: Record<string, unknown> = {}) {
    return {
        _id: "paperDollBeautyGallery.CYL-9ML",
        familyKey: "CYL-9ML",
        displayName: "Cylinder 9 mL Beauty Gallery",
        canvasWidth: 2080,
        canvasHeight: 2288,
        referenceRoller: "metal-roller",
        referenceCapFinish: "matte-silver",
        assetRevision: "sandstone-v1",
        storefrontReady: true,
        heroes: heroKeys.map((glassKey) => ({
            glassKey,
            glassLabel: {
                CLR: "Clear",
                AMB: "Amber",
                BLU: "Cobalt Blue",
                FRS: "Frosted",
                SWL: "Swirl",
            }[glassKey],
            imageUrl: `https://cdn.sanity.io/images/project/production/${glassKey}.png`,
            imageWidth: 2080,
            imageHeight: 2288,
            alt: `${glassKey} empty Cylinder bottle on natural sandstone`,
        })),
        ...overrides,
    };
}

describe("Cylinder beauty gallery storefront contract", () => {
    it("accepts one clean 2080 x 2288 hero for each Cylinder glass body", () => {
        const result = assertStorefrontCylinderBeautyGallery(gallery());

        expect(result.heroes.map((hero) => hero.glassKey)).toEqual(heroKeys);
        expect(result.referenceRoller).toBe("metal-roller");
        expect(result.referenceCapFinish).toBe("matte-silver");
    });

    it("resolves the selected glass and falls back to Clear", () => {
        const result = assertStorefrontCylinderBeautyGallery(gallery());

        expect(resolveCylinderBeautyHero(result, "AMB")?.glassLabel).toBe("Amber");
        expect(resolveCylinderBeautyHero(result, "UNKNOWN")?.glassKey).toBe("CLR");
        expect(resolveCylinderBeautyHero(null, "AMB")).toBeNull();
    });

    it("rejects incomplete, watermarked-review-sized, or unreleased galleries", () => {
        expect(() => assertStorefrontCylinderBeautyGallery(gallery({
            heroes: gallery().heroes.slice(0, 4),
        }))).toThrow(/exactly five/i);

        expect(() => assertStorefrontCylinderBeautyGallery(gallery({
            heroes: gallery().heroes.map((hero, index) => index === 0
                ? { ...hero, imageWidth: 1952, imageHeight: 2176 }
                : hero),
        }))).toThrow(/2080.*2288/i);

        expect(() => assertStorefrontCylinderBeautyGallery(gallery({ storefrontReady: false })))
            .toThrow(/storefront ready/i);
    });
});
