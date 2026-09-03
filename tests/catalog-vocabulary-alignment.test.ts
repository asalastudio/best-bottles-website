/**
 * One vocabulary for Convex, the storefront filters, the client fallback,
 * Grace's OpenAI tool schemas and the Shopify push. These tests fail the
 * moment any consumer re-declares a list instead of importing it.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
    APPLICATOR_BUCKETS,
    APPLICATOR_BUCKET_VALUES,
    CANONICAL_GLASS_COLORS,
    CATALOG_CATEGORY_VALUES,
    CATALOG_FAMILIES,
    COMPONENT_FAMILIES,
    FAMILY_ORDER,
    LEGACY_APPLICATOR_VALUES,
    PRODUCT_APPLICATOR_VALUES,
    UNBUCKETED_APPLICATOR_VALUES,
    canonicalGlassColor,
    detectCanonicalGlassColor,
    detectCatalogFamily,
    normalizeCapacityFilterValue,
    paramsToFilters,
    parseCapacityLabelMl,
} from "../src/lib/catalogFilters";
import { CATALOG_CATEGORY_VALUES as GRACE_CATEGORY_VALUES, GRACE_OPENAI_TOOL_SPECS } from "../src/lib/knowledge/toolSchemas";
import { GRACE_TOOLS } from "../convex/graceToolDefs";
import { SHAPE_TO_FAMILIES } from "../src/lib/graceShapeIntent";
import { MASTER_CATALOG_SURFACE } from "../src/lib/catalogSurface";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

/** Pull the `applicator` literal union out of convex/schema.ts without importing Convex. */
function schemaApplicatorLiterals(): string[] {
    const schema = read("convex/schema.ts");
    const open = schema.indexOf("applicator: v.union(");
    expect(open).toBeGreaterThan(0);
    // Walk to the matching close paren — the union spans many lines and each
    // v.literal(...) inside carries its own parens.
    let depth = 0;
    let end = open;
    for (let i = schema.indexOf("(", open); i < schema.length; i += 1) {
        if (schema[i] === "(") depth += 1;
        else if (schema[i] === ")") {
            depth -= 1;
            if (depth === 0) { end = i; break; }
        }
    }
    const block = schema.slice(open, end);
    return Array.from(block.matchAll(/v\.literal\("([^"]+)"\)/g)).map((m) => m[1]);
}

describe("applicator vocabulary", () => {
    it("every products.applicator schema literal is bucketed or explicitly excluded", () => {
        const literals = schemaApplicatorLiterals();
        expect(literals.length).toBeGreaterThan(10);
        const reachable = new Set<string>(APPLICATOR_BUCKETS.flatMap((bucket) => [...bucket.productValues]));
        const excluded = new Set<string>(UNBUCKETED_APPLICATOR_VALUES);
        const orphans = literals.filter((value) => !reachable.has(value) && !excluded.has(value));
        expect(orphans).toEqual([]);
    });

    it("bucket slugs are unique and the Grace refine enum is exactly that list", () => {
        expect(new Set(APPLICATOR_BUCKET_VALUES).size).toBe(APPLICATOR_BUCKET_VALUES.length);
        const refine = GRACE_OPENAI_TOOL_SPECS.find((spec) => spec.name === "setCatalogRefinements");
        const applicators = refine?.parameters.properties.applicators as { items: { enum: string[] }; maxItems: number };
        expect(applicators.items.enum).toEqual([...APPLICATOR_BUCKET_VALUES]);
        expect(applicators.maxItems).toBe(APPLICATOR_BUCKET_VALUES.length);
    });

    it("Grace's searchCatalog.applicatorFilter advertises only current product values", () => {
        for (const legacy of LEGACY_APPLICATOR_VALUES) expect(PRODUCT_APPLICATOR_VALUES).not.toContain(legacy);
        const openai = GRACE_OPENAI_TOOL_SPECS.find((spec) => spec.name === "searchCatalog");
        const description = String((openai?.parameters.properties.applicatorFilter as { description: string }).description);
        for (const value of PRODUCT_APPLICATOR_VALUES) expect(description).toContain(`'${value}'`);
        const chat = GRACE_TOOLS.find((tool) => tool.type === "function" && tool.function.name === "searchCatalog");
        const chatDescription = JSON.stringify(chat);
        for (const value of PRODUCT_APPLICATOR_VALUES) expect(chatDescription).toContain(value);
        expect(chatDescription).not.toContain("Antique Bulb Sprayer,");
    });

    it("Cap/Closure — a quarter of the catalogue — is reachable from the Product Type facet", () => {
        expect(APPLICATOR_BUCKETS.some((bucket) => (bucket.productValues as readonly string[]).includes("Cap/Closure"))).toBe(true);
    });
});

describe("category and family vocabulary", () => {
    it("Grace's category enum IS the catalogue's category list", () => {
        expect(GRACE_CATEGORY_VALUES).toBe(CATALOG_CATEGORY_VALUES);
        expect(CATALOG_CATEGORY_VALUES).not.toContain("Internal");
        expect(CATALOG_CATEGORY_VALUES).toContain("Cap/Closure");
    });

    it("both Grace tool surfaces list every catalogue family verbatim", () => {
        const chatSearch = JSON.stringify(GRACE_TOOLS.find((tool) => tool.type === "function" && tool.function.name === "searchCatalog"));
        const chatOverview = JSON.stringify(GRACE_TOOLS.find((tool) => tool.type === "function" && tool.function.name === "getFamilyOverview"));
        const openaiSearch = JSON.stringify(GRACE_OPENAI_TOOL_SPECS.find((spec) => spec.name === "searchCatalog"));
        for (const family of CATALOG_FAMILIES) {
            expect(chatSearch).toContain(`'${family}'`);
            expect(chatOverview).toContain(`'${family}'`);
            expect(openaiSearch).toContain(`'${family}'`);
        }
        expect(chatSearch).not.toContain("'Specialty'");
    });

    it("every family the shape-intent map routes to exists in the catalogue vocabulary", () => {
        const routed = new Set(Object.values(SHAPE_TO_FAMILIES).flatMap((match) => [...match.primary, ...match.also]));
        const missing = [...routed].filter((family) => !CATALOG_FAMILIES.includes(family));
        expect(missing).toEqual([]);
    });

    it("design families and component families never overlap", () => {
        const overlap = FAMILY_ORDER.filter((family) => COMPONENT_FAMILIES.includes(family));
        expect(overlap).toEqual([]);
    });

    it("family detection prefers the longest name", () => {
        expect(detectCatalogFamily("tall cylinder 30ml")).toBe("Tall Cylinder");
        expect(detectCatalogFamily("boston round amber")).toBe("Boston Round");
        expect(detectCatalogFamily("a round one")).toBe("Round");
        expect(detectCatalogFamily("nothing here")).toBeNull();
    });
});

describe("glass colour vocabulary", () => {
    it("folds raw row spellings into the canonical label", () => {
        expect(canonicalGlassColor("Blue")).toBe("Cobalt Blue");
        expect(canonicalGlassColor("cobalt")).toBe("Cobalt Blue");
        expect(canonicalGlassColor("Frost")).toBe("Frosted");
        expect(canonicalGlassColor("brown")).toBe("Amber");
        expect(canonicalGlassColor("Clear")).toBe("Clear");
        expect(canonicalGlassColor("Lavender")).toBe("Lavender");
        expect(canonicalGlassColor(null)).toBeNull();
    });

    it("detects the canonical colour in free text, longest alias first", () => {
        expect(detectCanonicalGlassColor("cobalt blue roll on")).toBe("Cobalt Blue");
        expect(detectCanonicalGlassColor("frosted 9ml")).toBe("Frosted");
        expect(detectCanonicalGlassColor("clearly nothing")).toBeNull();
    });

    it("every canonical colour survives its own normaliser", () => {
        for (const color of CANONICAL_GLASS_COLORS) expect(canonicalGlassColor(color)).toBe(color);
    });

    it("URL colours are canonicalised so Grace and the sidebar hit the same rows", () => {
        const { filters } = paramsToFilters(new URLSearchParams("colors=Blue,Cobalt%20Blue,frosted"));
        expect(filters.colors).toEqual(["Cobalt Blue", "Frosted"]);
    });
});

describe("capacity labels", () => {
    it("normalises mega-menu and shorthand spellings to the facet label", () => {
        expect(normalizeCapacityFilterValue("1 ml (0.03 oz)")).toBe("1 ml");
        expect(normalizeCapacityFilterValue("30ml")).toBe("30 ml");
        expect(normalizeCapacityFilterValue(" 30 ML ")).toBe("30 ml");
        expect(normalizeCapacityFilterValue("0.5 ml")).toBe("0.5 ml");
        expect(normalizeCapacityFilterValue("1 oz")).toBe("1 oz");
    });

    it("parses the millilitre number the same way everywhere", () => {
        expect(parseCapacityLabelMl("9 ml")).toBe(9);
        expect(parseCapacityLabelMl("9ml (0.3 oz)")).toBe(9);
        expect(parseCapacityLabelMl("Large")).toBeNull();
    });

    it("paramsToFilters applies the normaliser and dedupes", () => {
        const { filters } = paramsToFilters(new URLSearchParams("capacities=1+ml+(0.03+oz),1+ml,30ml"));
        expect(filters.capacities).toEqual(["1 ml", "30 ml"]);
    });
});

describe("no duplicated vocabulary in consumers", () => {
    it("convex/products.ts imports the shared model instead of re-declaring it", () => {
        const source = read("convex/products.ts");
        expect(source).toContain('from "../src/lib/catalogFilters"');
        for (const banned of ["const APPLICATOR_BUCKETS", "const FAMILY_ORDER", "const COMPONENT_CATEGORIES", "const BOTTLE_CATEGORIES", "function normalizeCatalogSearchText", "function classifyCatalogComponentType"]) {
            expect(source).not.toContain(banned);
        }
    });

    it("the client fallback and the sidebar import the shared model", () => {
        const fallback = read("src/lib/catalogSearchFallback.ts");
        expect(fallback).not.toContain("const FAMILY_ORDER");
        expect(fallback).not.toContain("const COMPONENT_CATEGORIES");
        const client = read("src/app/catalog/CatalogClient.tsx");
        expect(client).not.toContain("const CATEGORY_ORDER");
        expect(client).not.toContain("const COMPONENT_CATEGORIES");
        expect(client).not.toContain("useQuery(api.products.getCatalogTaxonomy)");
    });

    it("Grace's Convex search detects families and colours through the shared helpers", () => {
        expect(read("convex/grace.ts")).toContain("detectCatalogFamily(");
        expect(read("convex/grace.ts")).not.toContain("const KNOWN_FAMILIES");
        expect(read("convex/graceSearchUtils.ts")).toContain("detectCanonicalGlassColor(");
    });
});

describe("sidebar hierarchy (Baymard product-list research)", () => {
    it("scope, then fit attributes, then look, then price, then aesthetic line", () => {
        expect(MASTER_CATALOG_SURFACE.visibleFacets).toEqual([
            "category", "collection", "applicators", "capacities", "neckThreadSizes", "colors", "price", "families", "componentType",
        ]);
        expect(MASTER_CATALOG_SURFACE.defaultOpenFacets).toContain("colors");
        expect(MASTER_CATALOG_SURFACE.defaultOpenFacets).toContain("category");
        expect(MASTER_CATALOG_SURFACE.mobileDefaultOpenFacets.length).toBeLessThan(MASTER_CATALOG_SURFACE.defaultOpenFacets.length);
        expect(MASTER_CATALOG_SURFACE.truncateAfter).toBeGreaterThanOrEqual(5);
        expect(MASTER_CATALOG_SURFACE.truncateAfter).toBeLessThanOrEqual(10);
    });

    it("the sidebar renders from the manifest and truncates instead of scroll-boxing", () => {
        const client = read("src/app/catalog/CatalogClient.tsx");
        expect(client).toContain("surface.visibleFacets.map(");
        expect(client).toContain("TruncatedFacetList");
        expect(client).not.toContain("max-h-[280px]");
        expect(client).not.toContain("max-h-[240px]");
        expect(client).toContain('role="dialog"');
        expect(client).toContain("indeterminate={range.partiallyChecked}");
    });
});

describe("Shopify carries the same vocabulary", () => {
    it("the push script emits prefixed tags and the webhook sync reads them back", () => {
        const push = read("scripts/push_convex_to_shopify.mjs");
        for (const prefix of ["family:", "category:", "glass:", "collection:", "capacity:", "neck:", "applicator:"]) {
            expect(push).toContain("`" + prefix);
        }
        const sync = read("convex/shopifySync.ts");
        expect(sync).toContain("parsePrefixedTags(");
        expect(sync).not.toContain('category: args.productType || "Glass Bottle",\n            variantCount');
    });
});
