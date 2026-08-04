import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("continuous catalog product grid", () => {
    it("owns the hairline dividers and responsive columns", () => {
        const source = readFileSync(
            join(process.cwd(), "src/components/catalog/CatalogProductGrid.tsx"),
            "utf8",
        );
        expect(source).toContain("gap-px");
        expect(source).toContain("border-champagne");
        expect(source).toContain("sm:grid-cols-2");
        expect(source).toContain("xl:grid-cols-4");
    });

    it("is used by both visual catalog surfaces", () => {
        for (const file of [
            "src/app/catalog/CatalogClient.tsx",
            "src/app/catalog/cylinder/CylinderFamilyPageClient.tsx",
        ]) {
            const source = readFileSync(join(process.cwd(), file), "utf8");
            expect(source).toContain("<CatalogProductGrid");
        }
    });

    it("removes floating-card decoration from visual product cards", () => {
        const master = readFileSync(join(process.cwd(), "src/app/catalog/CatalogClient.tsx"), "utf8");
        const cylinder = readFileSync(join(process.cwd(), "src/app/catalog/cylinder/CylinderFamilyPageClient.tsx"), "utf8");
        expect(master).not.toContain("hover:shadow-lg");
        expect(cylinder).not.toContain("hover:shadow-md");
        expect(master).toContain("focus-within:outline");
        expect(cylinder).toContain("focus-within:outline");
    });
});
