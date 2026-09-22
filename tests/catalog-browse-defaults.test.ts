import { describe, expect, it } from "vitest";
import {
    EMPTY_FILTERS,
    catalogBreadcrumbSteps,
    catalogBrowseRedirect,
    catalogResultScopeTitle,
    paramsToFilters,
} from "@/lib/catalogFilters";
import { buildCatalogSearchResult, type CatalogSearchGroup } from "@/lib/catalogSearchFallback";
import {
    applicationFinderHref,
    applicationLandingRedirect,
    familyFinderHref,
    familyGuideHref,
    familyLandingRedirect,
} from "@/lib/products/focused-shopping";
import { shopCollectionHref } from "@/lib/shopCollections";

function group(id: string, capacityMl: number | null, category: string): CatalogSearchGroup {
    return {
        _id: id,
        slug: id,
        displayName: id,
        family: category === "Component" ? "Sprayer" : "Vial",
        capacity: capacityMl == null ? null : `${capacityMl} ml`,
        capacityMl,
        color: "Clear",
        category,
        bottleCollection: null,
        neckThreadSize: null,
        variantCount: 1,
        priceRangeMin: 1,
        priceRangeMax: 2,
        applicatorTypes: [],
    };
}

const catalog = [
    group("closure", 0.5, "Component"),
    group("ten", 10, "Glass Bottle"),
    group("vial", 1, "Glass Bottle"),
    group("unspecified", null, "Glass Bottle"),
];

function search(category: string | null) {
    return buildCatalogSearchResult({
        groups: catalog,
        primarySkus: [],
        variantPreviewRows: [],
        filters: { ...EMPTY_FILTERS, category },
        sort: "capacity-asc",
        view: "visual",
        limit: 24,
    });
}

describe("size-first catalog browse", () => {
    it("resolves an unfiltered catalog to glass bottles ordered by capacity", () => {
        const href = catalogBrowseRedirect(new URLSearchParams());
        expect(href).toBe("/catalog?category=Glass+Bottle&sort=capacity-asc");
        const parsed = paramsToFilters(new URLSearchParams(href?.split("?")[1]));
        expect(parsed.filters.category).toBe("Glass Bottle");
        expect(parsed.sort).toBe("capacity-asc");

        const glass = search("Glass Bottle");
        expect(glass.items.map((item) => item._id)).toEqual(["vial", "ten", "unspecified"]);
        expect(glass.items.map((item) => item.capacityMl)).toEqual([1, 10, null]);
        expect(glass.items.some((item) => item.category === "Component")).toBe(false);
    });

    it("keeps components available from product type or all products, and keeps search on best match", () => {
        expect(catalogBrowseRedirect(new URLSearchParams("scope=all"))).toBeNull();
        expect(catalogBrowseRedirect(new URLSearchParams("category=Component"))).toBeNull();
        expect(catalogBrowseRedirect(new URLSearchParams("search=vial"))).toBeNull();
        expect(paramsToFilters(new URLSearchParams("scope=all")).sort).toBe("capacity-asc");
        expect(paramsToFilters(new URLSearchParams("search=vial")).sort).toBe("best-match");

        const all = search(null);
        expect(all.items.map((item) => item._id)).toEqual(["closure", "vial", "ten", "unspecified"]);
        const components = search("Component");
        expect(components.items.map((item) => item._id)).toEqual(["closure"]);
    });

    it("points families, applications, and collections at one grid", () => {
        expect(familyFinderHref("Cylinder", {
            application: "rollon",
            capacities: ["9 ml"],
            rollerMaterials: ["metal"],
        })).toBe("/catalog?category=Glass+Bottle&applicators=rollon&roller=metal&families=Cylinder&capacities=9+ml&sort=capacity-asc");
        expect(familyGuideHref("Cylinder")).toBe("/catalog/cylinder?guide=1");
        expect(familyLandingRedirect("Cylinder", new URLSearchParams("applicators=rollon"))).toBe(
            "/catalog?category=Glass+Bottle&applicators=rollon&families=Cylinder&sort=capacity-asc",
        );
        expect(familyLandingRedirect("Cylinder", new URLSearchParams("guide=1"))).toBeNull();
        expect(applicationFinderHref("spray")).toBe("/catalog?applicators=finemist%2Cperfumespray&sort=capacity-asc");
        expect(applicationLandingRedirect("/catalog/application/roll-on", new URLSearchParams())).toBe(
            "/catalog?applicators=rollon&sort=capacity-asc",
        );
        expect(applicationLandingRedirect("/catalog/application/roll-on", new URLSearchParams("guide=1"))).toBeNull();
        expect(shopCollectionHref("cream-jars")).toBe("/catalog?shop=cream-jars&sort=capacity-asc");
        expect(shopCollectionHref("cream-jars")).not.toContain("category=");
    });

    it("names the active scope in the title and breadcrumbs", () => {
        const glass = { ...EMPTY_FILTERS, category: "Glass Bottle" };
        const cylinder = { ...glass, families: ["Cylinder"] };
        const rollOn = { ...EMPTY_FILTERS, shopCollection: "roll-on-bottles" };
        expect(catalogResultScopeTitle(glass)).toBe("Glass bottles");
        expect(catalogResultScopeTitle(cylinder)).toBe("Cylinder");
        expect(catalogResultScopeTitle(rollOn)).toBe("Roll-On Bottles");
        expect(catalogResultScopeTitle(EMPTY_FILTERS)).toBe("All products");
        expect(catalogBreadcrumbSteps(glass)).toEqual([{ label: "Glass bottles" }]);
        expect(catalogBreadcrumbSteps(cylinder)).toEqual([
            { label: "Glass bottles", href: "/catalog?category=Glass+Bottle&sort=capacity-asc" },
            { label: "Cylinder" },
        ]);
        expect(catalogBreadcrumbSteps(rollOn)).toEqual([{ label: "Roll-On Bottles" }]);
    });
});
