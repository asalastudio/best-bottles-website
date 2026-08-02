import { describe, expect, it } from "vitest";
import {
    PAPER_DOLL_PDP_CANVAS,
    assertStorefrontPaperDollFamily,
    validateStorefrontPaperDollFamily,
} from "@/lib/paper-doll/sanity";

function validFamily() {
    return {
        _id: "paperDollFamily.CYL-9ML",
        familyKey: "CYL-9ML",
        displayName: "Cylinder 9 mL — 17-415",
        canvasPreset: "pdp-2080x2288",
        canvasWidth: 2080,
        canvasHeight: 2288,
        pipelineVersion: "recanvas-v1",
        assetRevision: "cyl-9ml-2026-08-02",
        storefrontReady: true,
        layerOrderRollon: ["body", "roller", "cap"],
        layerOrderSpray: ["body", "sprayer"],
        layerOrderLotion: ["body", "pump"],
        layerAssets: [
            {
                _key: "body-clr",
                slot: "body",
                variantKey: "CLR",
                imageUrl: "https://cdn.sanity.io/images/project/production/body.png",
                imageWidth: 2080,
                imageHeight: 2288,
            },
            {
                _key: "roller-metal",
                slot: "roller",
                variantKey: "MTL-ROLL",
                imageUrl: "https://cdn.sanity.io/images/project/production/roller.png",
                imageWidth: 2080,
                imageHeight: 2288,
            },
            {
                _key: "cap-white",
                slot: "cap",
                variantKey: "WHT",
                imageUrl: "https://cdn.sanity.io/images/project/production/cap.png",
                imageWidth: 2080,
                imageHeight: 2288,
            },
            {
                _key: "sprayer-black",
                slot: "sprayer",
                variantKey: "BLK",
                imageUrl: "https://cdn.sanity.io/images/project/production/sprayer.png",
                imageWidth: 2080,
                imageHeight: 2288,
            },
            {
                _key: "pump-black",
                slot: "pump",
                variantKey: "BLK",
                imageUrl: "https://cdn.sanity.io/images/project/production/pump.png",
                imageWidth: 2080,
                imageHeight: 2288,
            },
        ],
    };
}

describe("Paper Doll Sanity storefront contract", () => {
    it("accepts only the exact PDP canvas and a complete ready family", () => {
        expect(PAPER_DOLL_PDP_CANVAS).toEqual({ width: 2080, height: 2288 });
        expect(validateStorefrontPaperDollFamily(validFamily())).toMatchObject({ ok: true });
        expect(assertStorefrontPaperDollFamily(validFamily()).familyKey).toBe("CYL-9ML");
    });

    it("rejects a legacy canvas even if the document is marked ready", () => {
        const result = validateStorefrontPaperDollFamily({
            ...validFamily(),
            canvasPreset: "legacy",
            canvasWidth: 1000,
            canvasHeight: 1300,
        });

        expect(result).toMatchObject({ ok: false });
        expect(result.issues).toEqual(expect.arrayContaining([
            expect.stringMatching(/canvasPreset.*pdp-2080x2288/),
            expect.stringMatching(/2080×2288/),
        ]));
    });

    it("rejects families that have not passed the release gate", () => {
        const result = validateStorefrontPaperDollFamily({
            ...validFamily(),
            storefrontReady: false,
        });

        expect(result).toMatchObject({ ok: false });
        expect(result.issues).toContain("storefrontReady must be true");
    });

    it("rejects duplicate slot and variant keys", () => {
        const family = validFamily();
        family.layerAssets.push({ ...family.layerAssets[0], _key: "body-clr-copy" });

        const result = validateStorefrontPaperDollFamily(family);

        expect(result).toMatchObject({ ok: false });
        expect(result.issues).toContain("duplicate layer key body:CLR");
    });

    it("rejects missing URLs and incorrect asset dimensions", () => {
        const family = validFamily();
        family.layerAssets[0] = {
            ...family.layerAssets[0],
            imageUrl: "",
            imageWidth: 1000,
            imageHeight: 1300,
        };

        const result = validateStorefrontPaperDollFamily(family);

        expect(result).toMatchObject({ ok: false });
        expect(result.issues).toEqual(expect.arrayContaining([
            "body:CLR is missing its Sanity image URL",
            "body:CLR asset must be 2080×2288; received 1000×1300",
        ]));
    });

    it("rejects a layer-order slot with no corresponding asset", () => {
        const family = validFamily();
        family.layerAssets = family.layerAssets.filter((asset) => asset.slot !== "pump");

        const result = validateStorefrontPaperDollFamily(family);

        expect(result).toMatchObject({ ok: false });
        expect(result.issues).toContain("layerOrderLotion requires at least one pump asset");
    });

    it("throws a diagnostic instead of silently rendering an invalid family", () => {
        expect(() => assertStorefrontPaperDollFamily({
            ...validFamily(),
            pipelineVersion: "",
            assetRevision: "",
        })).toThrow(/pipelineVersion is required[\s\S]*assetRevision is required/);
    });
});
