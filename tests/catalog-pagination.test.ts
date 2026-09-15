import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "@/lib/catalogFilters";
import { buildCatalogSearchArgs } from "@/lib/catalogSearchClient";
import {
    mergeCatalogSearchPages,
    type CatalogSearchGroup,
    type CatalogSearchResultShape,
} from "@/lib/catalogSearchFallback";
import { MASTER_CATALOG_SURFACE } from "@/lib/catalogSurface";

const read = (path: string) => readFileSync(path, "utf8");

function group(id: string): CatalogSearchGroup {
    return {
        _id: id,
        slug: id,
        displayName: id,
        family: "Cylinder",
        capacity: "9 ml (0.3 oz)",
        capacityMl: 9,
        color: "Clear",
        category: "Glass Bottle",
        bottleCollection: null,
        neckThreadSize: "17-415",
        variantCount: 1,
        priceRangeMin: 1,
        priceRangeMax: 1,
        applicatorTypes: ["Metal Roller Ball"],
    };
}

function page(ids: string[], nextCursor: string | null): CatalogSearchResultShape {
    return {
        items: ids.map(group),
        facets: {
            categories: { "Glass Bottle": 300 },
            collections: {},
            applicators: {},
            rollerMaterials: { metal: 0, plastic: 0 },
            families: { Cylinder: 22 },
            colors: {},
            capacities: {},
            neckThreadSizes: {},
            componentTypes: {},
            priceRange: { min: 1, max: 2 },
        },
        totalCount: 300,
        nextCursor,
        primarySkus: ids.map((id) => ({ groupId: id, websiteSku: id, graceSku: id })),
        variantPreviewRows: ids.map((id) => ({ groupId: id, variants: [] })),
    };
}

describe("catalog cursor pagination", () => {
    it("appends the next page and keeps the latest cursor, facets, and total", () => {
        const first = page(["a", "b"], "24");
        const second = page(["c", "d"], "48");
        const merged = mergeCatalogSearchPages(first, second);
        expect(merged.items.map((item) => item._id)).toEqual(["a", "b", "c", "d"]);
        expect(merged.nextCursor).toBe("48");
        expect(merged.totalCount).toBe(300);
        expect(merged.primarySkus.map((row) => row.groupId)).toEqual(["a", "b", "c", "d"]);
        expect(merged.variantPreviewRows.map((row) => row.groupId)).toEqual(["a", "b", "c", "d"]);
    });

    it("does not duplicate a group if the next page overlaps", () => {
        const first = page(["a", "b"], "24");
        const second = page(["b", "c"], "48");
        const merged = mergeCatalogSearchPages(first, second);
        expect(merged.items.map((item) => item._id)).toEqual(["a", "b", "c"]);
    });

    it("forwards the Convex offset cursor on Load More requests", () => {
        expect(buildCatalogSearchArgs({
            surface: MASTER_CATALOG_SURFACE,
            filters: EMPTY_FILTERS,
            sort: "featured",
            view: "visual",
            limit: 24,
            cursor: "24",
        })).toMatchObject({
            limit: 24,
            cursor: "24",
        });
    });

    it("loads more with a cursor instead of raising the first-page limit", () => {
        const catalog = read("src/app/catalog/CatalogClient.tsx");
        const page = read("src/app/catalog/page.tsx");
        expect(catalog).toContain("mergeCatalogSearchPages");
        expect(catalog).toContain("const cursor = activeResult.nextCursor");
        expect(catalog).toContain("activeResult.nextCursor != null");
        expect(catalog).toContain("data-testid=\"catalog-load-more\"");
        expect(catalog).not.toContain("queryLimit");
        expect(catalog).not.toContain("visibleCount");
        expect(page).toContain("limit: PAGE_SIZE");
        expect(page).not.toContain("MAX_VISIBLE_LIMIT");
    });
});
