import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync("scripts/audit_madison_image_naming.mjs", "utf8");

describe("Madison image naming audit", () => {
    it("treats Grace/Shopify SKU as the canonical render filename identity", () => {
        expect(script).toContain("Render/source image files should be labeled by grace_sku/shopify_sku");
        expect(script).toContain("website_sku is accepted as the Best Bottles UI/Convex crosswalk");
    });

    it("checks the Madison tables that carry image/SKU truth", () => {
        expect(script).toContain("best_bottles_pipeline_sku_jobs");
        expect(script).toContain("best_bottles_pipeline_groups");
        expect(script).toContain("paper_doll_approved_assets");
        expect(script).toContain("shopify_publish_log");
        expect(script).toContain("generated_images");
    });

    it("can audit a local render folder before Madison ingestion", () => {
        expect(script).toContain("--folder");
        expect(script).toContain("local_file_name_does_not_match_any_pipeline_sku");
    });

    it("is read-only", () => {
        expect(script).toContain("method: \"GET\"");
        expect(script).not.toMatch(/method:\s*["']POST["']/);
        expect(script).not.toMatch(/method:\s*["']PATCH["']/);
        expect(script).not.toMatch(/method:\s*["']DELETE["']/);
        expect(script).not.toMatch(/\.insert\s*\(/);
        expect(script).not.toMatch(/\.update\s*\(/);
        expect(script).not.toMatch(/\.delete\s*\(/);
    });
});
