import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("mobile catalog compression", () => {
    it("removes the oversized mobile header offset instead of masking it", () => {
        const catalog = read("src/app/catalog/CatalogClient.tsx");
        expect(catalog).toContain("pt-[82px]");
        expect(catalog).not.toContain("pt-[160px]");
        expect(catalog).toContain("lg:pt-[120px]");
    });

    it("hides the mobile breadcrumb and compact title without dropping desktop catalog chrome", () => {
        const catalog = read("src/app/catalog/CatalogClient.tsx");
        expect(catalog).toContain("hidden lg:block");
        expect(catalog).toContain("<span className=\"lg:hidden\">Catalog</span>");
        expect(catalog).toContain("Master Catalog");
        expect(catalog).toContain("Need help? Talk with Grace");
        expect(catalog).toContain("hidden lg:inline");
    });

    it("keeps search in the field and excludes it from mobile filter chips and the filter badge", () => {
        const catalog = read("src/app/catalog/CatalogClient.tsx");
        expect(catalog).toContain('data-testid="catalog-search-input"');
        expect(catalog).toContain('chips.filter((chip) => chip.facet !== "search")');
        expect(catalog).toContain('activeFilterCount({ ...filters, search: "" })');
        expect(catalog).toContain("title=\"Collection\"");
        expect(catalog).not.toContain("mobileQuickRefinements");
    });

    it("puts filters, sort, and view on one mobile toolbar and keeps two-column visual cards", () => {
        const catalog = read("src/app/catalog/CatalogClient.tsx");
        const grid = read("src/components/catalog/CatalogProductGrid.tsx");
        const preview = read("src/components/catalog/CatalogCardPreview.tsx");
        const purchase = read("src/components/catalog/CatalogCardPurchase.tsx");
        expect(catalog).toContain("lg:hidden mb-3 flex items-center gap-2");
        expect(catalog).toContain("<ViewToggle value={viewMode} onChange={handleViewChange} />");
        expect(catalog).toContain('aria-label="Line item view"');
        expect(grid).toContain("grid-cols-2");
        expect(preview).toContain("lg:hidden");
        expect(preview).toContain("cap option");
        expect(preview).toContain("hidden lg:block");
        expect(purchase).toContain("catalog-card-add-compact");
        expect(purchase).toContain("hidden items-start gap-3 lg:flex");
    });
});
