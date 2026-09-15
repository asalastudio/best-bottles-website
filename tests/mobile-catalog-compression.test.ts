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
        expect(catalog).toContain("flex w-[300px] max-w-[85vw] flex-col");
        expect(catalog).toContain("min-h-0 flex-1 overflow-y-auto");
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

    it("clears mobile facet chips without wiping the search query", () => {
        const catalog = read("src/app/catalog/CatalogClient.tsx");
        expect(catalog).toContain("handleClearFacets");
        expect(catalog).toContain("search: filters.search");
        expect(catalog).toContain("onClearAll={handleClearFacets}");
        expect(catalog).toContain("onClick={handleClearFacets}");
        expect(catalog).toContain("onClick={handleClearAll}");
    });

    it("shows the existing cart control on the catalog mobile header", () => {
        const navbar = read("src/components/Navbar.tsx");
        expect(navbar).toContain('variant === "catalog" ? "flex" : "hidden xl:flex"');
        expect(navbar).toContain('aria-label="Cart"');
    });

    it("keeps mobile list view as a richer single-column card", () => {
        const catalog = read("src/app/catalog/CatalogClient.tsx");
        expect(catalog).toContain("h-[112px] w-[112px]");
        expect(catalog).toContain("line-clamp-2 whitespace-normal");
        expect(catalog).toContain("LineItemMobileGrid");
        expect(catalog).toContain("hidden lg:block");
    });
});
