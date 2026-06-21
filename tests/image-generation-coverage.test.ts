import { describe, expect, it } from "vitest";
import {
    buildImageGenerationAudit,
    classifyCatalogImageRow,
} from "../scripts/lib/image-generation-coverage.mjs";

const baseProduct = {
    graceSku: "GB-CYL-CLR-9ML-T-01",
    websiteSku: "GB09BlackCapApp",
    family: "Vial",
    productGroupSlug: "vial-9ml-clear-18-400-glasswand",
    itemName: "9 ml Clear Vial Bottle with Black Cap",
    color: "Clear",
    capacity: "9 ml",
    applicator: "Glass Rod",
    imageUrl: null,
    imageUrlCapOff: null,
    productUrl: "https://www.bestbottles.com/product/9-ml-clear-glass-vial-black-cap-glass-rod",
};

describe("image generation coverage audit", () => {
    it("treats Shopify CDN media as covered and legacy Best Bottles media as reference-only", () => {
        expect(classifyCatalogImageRow({
            product: {
                ...baseProduct,
                imageUrl: "https://cdn.shopify.com/s/files/1/0739/9420/7524/files/sku.png?v=1",
            },
            localReferencesBySku: new Map(),
            madisonEvidenceBySku: new Map(),
        })).toMatchObject({
            coverageStatus: "covered",
            coverageSource: "convex_shopify_cdn",
            generationBucket: "covered_existing_media",
        });

        expect(classifyCatalogImageRow({
            product: {
                ...baseProduct,
                imageUrl: "https://www.bestbottles.com/images/store/enlarged_pics/GB09BlackCapApp.gif",
            },
            localReferencesBySku: new Map(),
            madisonEvidenceBySku: new Map(),
        })).toMatchObject({
            coverageStatus: "needs_generation",
            referenceStatus: "legacy_reference_ready",
            generationBucket: "generate_from_legacy_reference",
            referenceUrl: "https://www.bestbottles.com/images/store/enlarged_pics/GB09BlackCapApp.gif",
        });
    });

    it("prefers exact local references before legacy-site fallback for missing media", () => {
        const localReferencesBySku = new Map([
            ["GB-CYL-CLR-9ML-T-01", [{
                source: "pdp-reference-flattened",
                path: "/repo/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/GB-CYL-CLR-9ML-T-01.png",
            }]],
        ]);

        const audit = buildImageGenerationAudit({
            products: [
                {
                    ...baseProduct,
                    imageUrl: "https://www.bestbottles.com/images/store/enlarged_pics/GB09BlackCapApp.gif",
                },
                {
                    ...baseProduct,
                    graceSku: "GB-CYL-CLR-10ML-T-01",
                    websiteSku: "GB10NoImage",
                    imageUrl: null,
                    productUrl: "https://www.bestbottles.com/product/10-ml-clear-glass-vial",
                },
            ],
            localReferencesBySku,
            madisonEvidenceBySku: new Map(),
            generatedAt: "2026-06-09T12:00:00.000Z",
        });

        type AuditRow = {
            graceSku: string;
            generationBucket: string;
            referenceStatus: string;
        };

        expect(audit.rows.map((row: AuditRow) => ({
            graceSku: row.graceSku,
            generationBucket: row.generationBucket,
            referenceStatus: row.referenceStatus,
        }))).toEqual([
            {
                graceSku: "GB-CYL-CLR-9ML-T-01",
                generationBucket: "generate_from_local_reference",
                referenceStatus: "local_reference_ready",
            },
            {
                graceSku: "GB-CYL-CLR-10ML-T-01",
                generationBucket: "legacy_site_lookup_needed",
                referenceStatus: "legacy_site_lookup_needed",
            },
        ]);

        expect(audit.summary).toMatchObject({
            totalProducts: 2,
            coveredExistingMedia: 0,
            needsGeneration: 2,
            generateFromLocalReference: 1,
            generateFromLegacyReference: 0,
            legacySiteLookupNeeded: 1,
        });
    });
});
