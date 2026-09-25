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

    it("shows catalog scope breadcrumbs on mobile and keeps the compact title", () => {
        const catalog = read("src/app/catalog/CatalogClient.tsx");
        expect(catalog).toContain("<Breadcrumbs steps={catalogBreadcrumbSteps(filters)} />");
        expect(catalog).toContain("hidden lg:block");
        expect(catalog).toContain('t("title")');
        expect(catalog).toContain("page-heading");
        expect(catalog).toContain('t("masterTitle")');
        expect(catalog).toContain('data-testid="catalog-result-count"');
        expect(catalog).toContain("hidden lg:inline");
        expect(read("messages/en.json")).toContain("Master Catalog");
    });

    it("keeps search in the field and excludes it from mobile filter chips and the filter badge", () => {
        const catalog = read("src/app/catalog/CatalogClient.tsx");
        expect(catalog).toContain('data-testid="catalog-search-input"');
        expect(catalog).toContain('chips.filter((chip) => chip.facet !== "search")');
        expect(catalog).toContain('activeFilterCount({ ...filters, search: "", category: typeSwitchCategory ? null : filters.category })');
        expect(read("src/components/catalog/CatalogFilterSidebar.tsx")).toContain('title={t("collection")}');
        expect(catalog).not.toContain("mobileQuickRefinements");
    });

    it("puts filters, sort, and view on the one toolbar and gives phones a single-column card with room for the Pack of row", () => {
        const catalog = read("src/app/catalog/CatalogClient.tsx");
        const grid = read("src/components/catalog/CatalogProductGrid.tsx");
        const purchase = read("src/components/catalog/CatalogCardPurchase.tsx");
        expect(catalog).toContain("flex w-[300px] max-w-[85vw] flex-col");
        expect(catalog).toContain("min-h-0 flex-1 overflow-y-auto");
        expect(catalog).toContain('data-testid="catalog-mobile-filter-button"');
        expect(catalog).toContain("<ViewToggle value={viewMode} onChange={handleViewChange}");
        expect(catalog).toContain('"Line item view"');
        expect(grid).toContain("grid-cols-1");
        expect(grid).toContain("sm:grid-cols-2");
        expect(grid).toContain("lg:grid-cols-3");
        // One purchase layout at every width: no compact twins, no tier dialog.
        expect(purchase).not.toContain("-compact");
        expect(purchase).not.toContain("<dialog");
        expect(purchase).toContain('data-testid="catalog-card-pack-toggle"');
    });

    it("clears mobile facet chips without wiping the search query", () => {
        const catalog = read("src/app/catalog/CatalogClient.tsx");
        expect(catalog).toContain("handleClearFacets");
        expect(catalog).toContain("search: filters.search");
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
