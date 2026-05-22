import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync("scripts/audit_madison_supabase_image_truth.mjs", "utf8");

describe("Madison Supabase image truth audit", () => {
    it("targets the known Madison Best Bottles image tables", () => {
        expect(script).toContain("best_bottles_pipeline_groups");
        expect(script).toContain("paper_doll_approved_assets");
        expect(script).toContain("best_bottles_pipeline_sku_jobs");
        expect(script).toContain("shopify_publish_log");
    });

    it("uses read-only Supabase REST requests", () => {
        expect(script).toContain("method: \"GET\"");
        expect(script).not.toMatch(/method:\s*["']POST["']/);
        expect(script).not.toMatch(/method:\s*["']PATCH["']/);
        expect(script).not.toMatch(/method:\s*["']DELETE["']/);
        expect(script).not.toMatch(/\.insert\s*\(/);
        expect(script).not.toMatch(/\.update\s*\(/);
        expect(script).not.toMatch(/\.delete\s*\(/);
    });

    it("redacts Supabase key values from report output", () => {
        expect(script).toContain("supabaseKey: \"[redacted]\"");
    });
});
