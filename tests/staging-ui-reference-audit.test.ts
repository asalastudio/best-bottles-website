import { describe, expect, it } from "vitest";

import {
    classifyRenderedImage,
    buildRenderedUiAudit,
} from "../scripts/lib/staging-ui-reference-audit.mjs";

const legacyAuditRow = {
    family: "Cylinder",
    product_group_slug: "cylinder-9ml-clear-13-415-finemist",
    sku: "GB-CYL-CLR-9ML-SPR-SBLK",
    website_sku: "GBCyl9SpryBlk",
    shopify_variant_id: "gid://shopify/ProductVariant/1",
    convex_product_id: "convex-1",
    business_product_id: "business-1",
    shopify_image_url: "",
    convex_image_url: "https://www.bestbottles.com/images/store/enlarged_pics/GBCyl9SpryBlk.gif",
    staging_url: "/products/cylinder-9ml-clear-13-415-finemist",
    issue: "legacy_reference_url_still_in_convex",
    recommended_next_action: "Generate Madison image, push to Shopify, sync Convex by graceSku.",
    owner: "madison",
    generation_bucket: "generate_from_legacy_reference",
    reference_source: "legacy_site",
    reference_url: "https://www.bestbottles.com/images/store/enlarged_pics/GBCyl9SpryBlk.gif",
    madison_evidence_url: "",
    notes: "",
};

describe("staging UI reference render audit", () => {
    it("flags direct legacy BestBottles image URLs as needing generation or fix", () => {
        expect(classifyRenderedImage({
            renderedImageUrl: "https://www.bestbottles.com/images/store/enlarged_pics/GBCyl9SpryBlk.gif",
            auditEvidence: null,
        })).toMatchObject({
            imageClassification: "legacy_bestbottles_url",
            needsGenerationOrFix: true,
        });
    });

    it("flags known reference imports without flagging Madison generated CDN images by white background alone", () => {
        expect(classifyRenderedImage({
            renderedImageUrl:
                "https://example.supabase.co/storage/v1/object/public/generated-images/org/best-bottles/reference-imports/cylinder/GBCyl9SpryBlk.png",
            auditEvidence: null,
        })).toMatchObject({
            imageClassification: "reference_import",
            needsGenerationOrFix: true,
        });

        expect(classifyRenderedImage({
            renderedImageUrl: "https://cdn.shopify.com/s/files/1/0739/9420/7524/files/madison-cylinder.png?v=1",
            auditEvidence: null,
        })).toMatchObject({
            imageClassification: "shopify_cdn_unknown",
            needsGenerationOrFix: false,
        });
    });

    it("keeps duplicate website SKUs separated by Grace SKU in the manifest", () => {
        const audit = buildRenderedUiAudit({
            generatedAt: "2026-06-15T12:00:00.000Z",
            baseUrl: "http://localhost:3000",
            renderedImages: [
                {
                    surface: "catalog",
                    stagingUrl: "http://localhost:3000/catalog?families=Cylinder",
                    family: "Cylinder",
                    productGroupSlug: "cylinder-9ml-clear-13-415-finemist",
                    graceSku: "GB-CYL-CLR-9ML-SPR-SBLK",
                    websiteSku: "DUPLICATE",
                    shopifyVariantId: "gid://shopify/ProductVariant/1",
                    renderedImageUrl: legacyAuditRow.convex_image_url,
                },
                {
                    surface: "catalog",
                    stagingUrl: "http://localhost:3000/catalog?families=Cylinder",
                    family: "Cylinder",
                    productGroupSlug: "cylinder-9ml-clear-13-415-rollon",
                    graceSku: "GB-CYL-CLR-9ML-ROL-SBLK",
                    websiteSku: "DUPLICATE",
                    shopifyVariantId: "gid://shopify/ProductVariant/2",
                    renderedImageUrl: "https://cdn.shopify.com/s/files/1/0739/9420/7524/files/madison-rollon.png?v=1",
                },
            ],
            legacyReferenceRows: [legacyAuditRow],
            suspiciousSyncedRows: [],
            reconciliationRows: [],
            skuTruthRows: [],
        });

        expect(audit.rows).toHaveLength(2);
        expect(audit.rows.map((row) => row.graceSku)).toEqual([
            "GB-CYL-CLR-9ML-SPR-SBLK",
            "GB-CYL-CLR-9ML-ROL-SBLK",
        ]);
        expect(audit.summary.flaggedRows).toBe(1);
        expect(audit.rows[0]).toMatchObject({
            needsGenerationOrFix: "yes",
            generationBucket: "generate_from_legacy_reference",
            referenceSource: "legacy_site",
        });
        expect(audit.rows[1]).toMatchObject({
            needsGenerationOrFix: "no",
            imageClassification: "shopify_cdn_unknown",
        });
    });
});
