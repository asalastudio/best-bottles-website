import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

// This source-of-truth CSV is gitignored (local-only), so the case-slug
// documentation test only runs where the file is present.
const coverageQueueCsv = resolve(
    root,
    "data/source-of-truth/best-bottles-image-control-center-2026-05-20/madison-pipeline-ui/madison_product_group_coverage_queue.csv",
);

describe("Madison image preflight guardrails", () => {
    it("exposes a read-only product group image target preflight query", () => {
        const source = readFileSync(resolve(root, "convex/products.ts"), "utf8");

        expect(source).toContain("preflightProductGroupImageTarget");
        expect(source).toContain("case_insensitive_slug");
        expect(source).toContain("alias_resolved");
        expect(source).toContain("Use canonical slug");
        expect(source).not.toMatch(/preflightProductGroupImageTarget[\\s\\S]*ctx\\.db\\.patch/);
    });

    it("keeps group hero writes internal and resolves canonical identity before patching", () => {
        const source = readFileSync(resolve(root, "convex/productGroups.ts"), "utf8");

        expect(source).toContain("internalMutation");
        expect(source).toContain("resolveProductGroup");
        expect(source).toContain("productGroupId");
        expect(source).toContain("graceSku");
        expect(source).toContain("websiteSku");
        expect(source).toContain("case_insensitive_slug");
        expect(source).toContain("canonicalSlug");
        expect(source).not.toContain("export const setHeroImageUrl = mutation");
    });

    it.skipIf(!existsSync(coverageQueueCsv))("documents the canonical Pear slug that differs by case from Madison's failed slug", () => {
        const source = readFileSync(coverageQueueCsv, "utf8");

        expect(source).toContain("pear-118ml-clear-Ground-stopper");
        expect(source).not.toContain("pear-118ml-clear-ground-stopper");
    });
});
