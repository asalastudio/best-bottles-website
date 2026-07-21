import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCatalogSearchResult, type CatalogSearchGroup } from "../src/lib/catalogSearchFallback";
import { EMPTY_FILTERS, type CatalogFilters } from "../src/lib/catalogFilters";

// Locks the July 2026 filter-integrity fixes: spray applicator buckets used a
// "-spray" slug suffix that no live slug matches (all four spray filters
// returned zero results), sidebar facets were recomputed from the visible
// page whenever a legacy-override slug appeared on it, the Categories list
// omitted six real categories, and the footer Closures link used a category
// value that does not exist in data.

function makeGroup(overrides: Partial<CatalogSearchGroup> & { slug: string }): CatalogSearchGroup {
    return {
        _id: overrides.slug,
        displayName: overrides.slug,
        family: "Cylinder",
        capacity: "9 ml (0.3 oz)",
        capacityMl: 9,
        color: "Clear",
        category: "Glass Bottle",
        bottleCollection: null,
        neckThreadSize: "17-415",
        variantCount: 1,
        priceRangeMin: 1,
        priceRangeMax: 2,
        applicatorTypes: [],
        ...overrides,
    };
}

function search(groups: CatalogSearchGroup[], applicators: CatalogFilters["applicators"]) {
    return buildCatalogSearchResult({
        groups,
        primarySkus: [],
        variantPreviewRows: [],
        filters: { ...EMPTY_FILTERS, applicators },
        sort: "featured",
        view: "visual",
        limit: 50,
    });
}

describe("catalog filter integrity", () => {
    it("matches every spray bucket against the slug suffixes that actually exist", () => {
        const groups = [
            makeGroup({ slug: "cylinder-3ml-clear-12mm-finemist", applicatorTypes: ["Fine Mist Sprayer"] }),
            makeGroup({ slug: "elegant-30ml-clear-15-415-perfumespray", applicatorTypes: ["Perfume Spray Pump"] }),
            makeGroup({ slug: "round-128ml-frosted-18-415-antiquespray", applicatorTypes: ["Vintage Bulb Sprayer"] }),
            makeGroup({ slug: "empire-50ml-clear-18-415-antiquespray-tassel", applicatorTypes: ["Vintage Bulb Sprayer with Tassel"] }),
            // A colored cap that lists a sprayer in applicatorTypes must NOT
            // pollute the spray filters — the suffix guard exists for this.
            makeGroup({ slug: "cap-closure-0ml-blue", category: "Cap/Closure", applicatorTypes: ["Fine Mist Sprayer"] }),
        ];

        expect(search(groups, ["finemist"]).items.map((g) => g.slug)).toEqual(["cylinder-3ml-clear-12mm-finemist"]);
        expect(search(groups, ["perfumespray"]).items.map((g) => g.slug)).toEqual(["elegant-30ml-clear-15-415-perfumespray"]);
        expect(search(groups, ["antiquespray"]).items.map((g) => g.slug)).toEqual(["round-128ml-frosted-18-415-antiquespray"]);
        expect(search(groups, ["antiquespray-tassel"]).items.map((g) => g.slug)).toEqual(["empire-50ml-clear-18-415-antiquespray-tassel"]);
    });

    it("keeps the Convex and fallback slug-suffix maps identical (no dead '-spray' bucket)", () => {
        const extract = (source: string) => {
            const start = source.indexOf("const SLUG_BUCKET_SUFFIXES");
            const end = source.indexOf("};", start);
            return source.slice(start, end);
        };
        const convexMap = extract(readFileSync("convex/products.ts", "utf8"));
        const fallbackMap = extract(readFileSync("src/lib/catalogSearchFallback.ts", "utf8"));

        for (const map of [convexMap, fallbackMap]) {
            expect(map).toContain('finemist: ["-finemist"]');
            expect(map).toContain('perfumespray: ["-perfumespray"]');
            expect(map).toContain('antiquespray: ["-antiquespray"]');
            expect(map).toContain('"antiquespray-tassel": ["-tassel"]');
            expect(map).not.toContain('"-spray"');
        }
    });

    it("keeps full-result facets when sanitizing legacy-override slugs out of a page", () => {
        const source = readFileSync("src/lib/catalogServer.ts", "utf8");
        // The page-derived recompute collapsed the sidebar to the loaded page.
        expect(source).not.toContain("recomputeVisibleFacets");
        // sanitizeCatalogResult must spread the source result without
        // overriding its facets field.
        const start = source.indexOf("function sanitizeCatalogResult");
        const body = source
            .slice(start, source.indexOf("\n}", start))
            .split("\n")
            .filter((line) => !line.trim().startsWith("//"))
            .join("\n");
        expect(body).toContain("...result");
        expect(body).not.toMatch(/facets\s*:/);
    });

    it("lists every real product category and no phantom ones in the sidebar order", () => {
        const source = readFileSync("src/app/catalog/CatalogClient.tsx", "utf8");
        const start = source.indexOf("const CATEGORY_ORDER");
        const section = source.slice(start, source.indexOf("];", start));
        for (const real of ["Glass Jar", "Aluminum Bottle", "Plastic Bottle", "Roll-On Bottle", "Metal Atomizer", "Packaging"]) {
            expect(section).toContain(`"${real}"`);
        }
        for (const phantom of ["Packaging Box", "Other", "Lotion Bottle", "Roll-On Cap"]) {
            expect(section).not.toContain(`"${phantom}"`);
        }
    });

    it("points the footer Closures link at a category that exists in data", () => {
        const source = readFileSync("src/components/Footer.tsx", "utf8");
        expect(source).toContain("/catalog?category=Component");
        expect(source).not.toContain("category=Closures");
    });
});
