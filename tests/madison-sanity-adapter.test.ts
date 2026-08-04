import { describe, expect, it } from "vitest";

import {
    buildMadisonSanityDraftDocuments,
    assertSanityReleaseIsImmutable,
    resolveMadisonReleaseAssetPath,
    validateMadisonReleaseManifest,
    type MadisonPaperDollReleaseManifest,
} from "@/lib/paper-doll/madison-sanity-adapter";

function releaseManifest(): MadisonPaperDollReleaseManifest {
    return {
        schemaVersion: 1,
        familyKey: "TEST-FAMILY",
        releaseVersion: "1.0.0",
        status: "ready",
        canvas: { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" },
        assets: [
            {
                componentVersionId: "body-clear@1",
                componentKey: "body__cylinder__9ml__clear",
                geometryFamilyId: "body__cylinder__9ml__v1",
                slot: "body",
                variantKey: "CLR",
                materialVariant: "clear-glass",
                imagePath: "private/releases/CYL-9ML/layers/body/CLR.png",
                imageSha256: "a".repeat(64),
                geometryMaskPath: null,
                geometryMaskSha256: null,
                widthPx: 2080,
                heightPx: 2288,
                alphaBounds: { left: 850, top: 700, right: 1230, bottom: 2100 },
                mountAxisXPx: 1040,
                seatYPx: 2100,
                approvalStatus: "approved",
            },
            {
                componentVersionId: "roller-metal@1",
                componentKey: "roller__17-415__metal",
                geometryFamilyId: "roller__17-415__v1",
                slot: "roller",
                variantKey: "METAL",
                materialVariant: "metal",
                imagePath: "private/releases/CYL-9ML/layers/roller/METAL.png",
                imageSha256: "b".repeat(64),
                geometryMaskPath: "private/releases/CYL-9ML/geometry/roller.png",
                geometryMaskSha256: "c".repeat(64),
                widthPx: 2080,
                heightPx: 2288,
                alphaBounds: { left: 900, top: 520, right: 1180, bottom: 820 },
                mountAxisXPx: 1040,
                seatYPx: 820,
                approvalStatus: "approved",
            },
        ],
        assemblyRecipes: [
            { recipeKey: "rollon", mode: "rollon", layerOrder: ["body", "roller"] },
        ],
        assemblyMappings: [
            {
                mappingKey: "CYL-9ML:CLR:ROLLON:METAL",
                websiteSku: "GBCyl9MtlRollClr",
                graceSku: "GB-CYL-CLR-9ML-MRL-01",
                recipeKey: "rollon",
                bodyVariantKey: "CLR",
                fitmentVariantKey: "METAL",
                closureVariantKey: null,
                overcapVariantKey: null,
            },
        ],
        qaEvidence: [
            {
                evidenceId: "geometry-v1",
                subjectId: "roller__17-415__v1",
                gateKey: "shared-geometry",
                gateVersion: "1",
                status: "passed",
                blocking: true,
                calibratedWith: ["CLR", "AMB", "BLU", "FRS", "SWL"],
                measurements: { minIoU: 1 },
                issues: [],
            },
        ],
        blockers: [],
        provenance: {
            sourceGitCommit: "abc123",
            rendererVersion: "component-factory-v2",
        },
    };
}

describe("Madison → Sanity Paper Doll adapter", () => {
    it("builds draft-only immutable release and storefront documents without private paths", async () => {
        const documents = await buildMadisonSanityDraftDocuments({
            manifest: releaseManifest(),
            displayName: "Cylinder 9 mL — 17-415",
            existingFamilyDocumentId: "d5291f24-f02b-4fb7-aa99-78c5f63d8c9d",
            sanityAssetRefsBySha256: {
                ["a".repeat(64)]: "image-body-2080x2288-png",
                ["b".repeat(64)]: "image-roller-2080x2288-png",
            },
        });

        expect(documents.releaseDocument._id).toBe("drafts.paperDollRelease.TEST-FAMILY.1-0-0");
        expect(documents.familyDocument._id).toBe("drafts.d5291f24-f02b-4fb7-aa99-78c5f63d8c9d");
        expect(documents.familyDocument.currentRelease).toEqual({
            _type: "reference",
            _ref: "paperDollRelease.TEST-FAMILY.1-0-0",
        });
        expect(documents.familyDocument.storefrontReady).toBe(false);
        expect(documents.familyDocument.canvasPreset).toBe("pdp-2080x2288");
        expect(documents.familyDocument.layerAssets).toHaveLength(2);
        expect(documents.familyDocument.layerAssets[0].image.asset._ref).toBe("image-body-2080x2288-png");
        expect(documents.releaseDocument.assemblyMappings[0].graceSku).toBe("GB-CYL-CLR-9ML-MRL-01");
        expect(documents.releaseDocument.qaEvidence[0]).not.toHaveProperty("measurements");
        expect(documents.releaseDocument.qaEvidence[0].measurementsJson).toBe('{"minIoU":1}');
        expect(documents.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(JSON.stringify(documents)).not.toMatch(/private\/releases|imagePath|geometryMaskPath/);
    });

    it("rejects blocked, unapproved, and incorrectly sized release input", () => {
        const blocked = releaseManifest();
        blocked.status = "blocked";
        blocked.blockers = ["placement_lock_required"];
        expect(validateMadisonReleaseManifest(blocked)).toEqual(expect.arrayContaining([
            "release status must be ready or published",
            "release blockers must be empty",
        ]));

        const unapproved = releaseManifest();
        unapproved.assets[0].approvalStatus = "candidate";
        unapproved.assets[1].widthPx = 1000;
        expect(validateMadisonReleaseManifest(unapproved)).toEqual(expect.arrayContaining([
            "body:CLR must be approved",
            "roller:METAL must be 2080×2288",
        ]));
    });

    it("rejects duplicate layer identities before any Sanity write", () => {
        const manifest = releaseManifest();
        manifest.assets.push({ ...manifest.assets[0], componentVersionId: "body-clear@2" });

        expect(validateMadisonReleaseManifest(manifest)).toContain("duplicate layer body:CLR");
    });

    it("requires an uploaded Sanity image reference for every exact release hash", async () => {
        await expect(buildMadisonSanityDraftDocuments({
            manifest: releaseManifest(),
            displayName: "Cylinder 9 mL — 17-415",
            sanityAssetRefsBySha256: {
                ["a".repeat(64)]: "image-body-2080x2288-png",
            },
        })).rejects.toThrow(/missing Sanity image reference.*roller:METAL/i);
    });

    it("allows only release assets contained by the declared release root", () => {
        expect(resolveMadisonReleaseAssetPath("/releases/CYL-9ML/1.0.0", "layers/body/CLR.png"))
            .toBe("/releases/CYL-9ML/1.0.0/layers/body/CLR.png");
        expect(() => resolveMadisonReleaseAssetPath("/releases/CYL-9ML/1.0.0", "../../secret.png"))
            .toThrow(/escapes the release root/i);
        expect(() => resolveMadisonReleaseAssetPath("/releases/CYL-9ML/1.0.0", "/tmp/other.png"))
            .toThrow(/must be relative/i);
    });

    it("holds the CYL-9ML 17-415 pilot to 145 exact mappings including both white-cap rollers", () => {
        const manifest = releaseManifest();
        manifest.familyKey = "CYL-9ML";
        manifest.assemblyMappings = Array.from({ length: 143 }, (_, index) => ({
            ...manifest.assemblyMappings[0],
            mappingKey: `CYL-9ML:FIXTURE:${index}`,
            websiteSku: `WEB-${index}`,
            graceSku: `GRACE-${index}`,
        })).concat([
            {
                ...manifest.assemblyMappings[0],
                mappingKey: "CYL-9ML:SWL:ROLLON:WHT:METAL",
                websiteSku: "GBCylSwrl9MtlRollWht",
                graceSku: "GB-CYL-WHT-9ML-MRL-WHT",
            },
            {
                ...manifest.assemblyMappings[0],
                mappingKey: "CYL-9ML:SWL:ROLLON:WHT:PLASTIC",
                websiteSku: "GBCylSwrl9RollWht",
                graceSku: "GB-CYL-WHT-9ML-ROL-WHT",
            },
        ]);
        expect(validateMadisonReleaseManifest(manifest)).toEqual([]);

        manifest.assemblyMappings.pop();
        manifest.assemblyMappings[0].mappingKey = "CYL-9ML:13-415:INVALID";
        expect(validateMadisonReleaseManifest(manifest)).toEqual(expect.arrayContaining([
            "CYL-9ML must contain exactly 145 catalog mappings; received 144",
            "CYL-9ML is missing plastic roller with white cap GB-CYL-WHT-9ML-ROL-WHT",
            "CYL-9ML release must not contain 13-415 identities",
        ]));
    });

    it("allows an idempotent retry but rejects reusing a release version for different bytes", () => {
        expect(() => assertSanityReleaseIsImmutable([
            { _id: "drafts.paperDollRelease.TEST-FAMILY.1-0-0", manifestSha256: "a".repeat(64) },
            { _id: "paperDollRelease.TEST-FAMILY.1-0-0", manifestSha256: "a".repeat(64) },
        ], "a".repeat(64))).not.toThrow();
        expect(() => assertSanityReleaseIsImmutable([
            { _id: "paperDollRelease.TEST-FAMILY.1-0-0", manifestSha256: "b".repeat(64) },
        ], "a".repeat(64))).toThrow(/already belongs to a different manifest/i);
        expect(() => assertSanityReleaseIsImmutable([
            { _id: "paperDollRelease.TEST-FAMILY.1-0-0", manifestSha256: null },
        ], "a".repeat(64))).toThrow(/missing its immutable manifest hash/i);
    });
});
