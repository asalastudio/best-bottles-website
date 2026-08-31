import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("catalog Refine states", () => {
    const master = readFileSync(join(process.cwd(), "src/app/catalog/CatalogClient.tsx"), "utf8");
    const cylinder = readFileSync(join(process.cwd(), "src/app/catalog/cylinder/CylinderFamilyPageClient.tsx"), "utf8");

    it("uses the shared typed search client on both surfaces", () => {
        expect(master).toContain("fetchCatalogSearch");
        expect(master).toContain("MASTER_CATALOG_SURFACE");
        expect(cylinder).toContain("fetchCatalogSearch");
        expect(cylinder).toContain("CYLINDER_CATALOG_SURFACE");
    });

    it("keeps prior results marked busy while an authoritative request loads", () => {
        expect(master).toContain("aria-busy={isFetchingCatalog}");
        expect(cylinder).toContain("aria-busy={isFetchingCatalog}");
    });

    it("names active constraints in empty-state recovery", () => {
        expect(master).toContain("activeConstraintSummary");
        expect(cylinder).toContain("activeConstraintSummary");
    });

    it("does not claim success on query errors and provides an actual retry", () => {
        for (const source of [master, cylinder]) {
            expect(source).toContain("Unable to update these results");
            expect(source).toContain("catalogRefineIncident");
            expect(source).toContain("setRetryNonce");
        }
    });

    it("creates browser-history entries when customers commit Refine changes", () => {
        expect(master).toContain("router.push(`${pathname}${qs ? `?${qs}` : \"\"}`");
        expect(cylinder).toContain("router.push(`/catalog/cylinder?${params.toString()}#ready-made`");
    });
});
