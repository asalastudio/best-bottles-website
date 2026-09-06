// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import {
    activeMatrixFilters,
    createMatrixFamilyState,
    emptyMatrixFilters,
    matrixCapacityMatches,
    matrixSizeOptions,
    switchMatrixFamily,
} from "@/lib/matrix/filters";
import {
    reconcileRetainedMatrixRows,
    retainMatrixConfiguration,
    retainedMatrixCartLines,
} from "@/lib/matrix/order-state";
import { summarizeMatrixOrder } from "@/lib/matrix/cart";
import { matrixProductHref } from "@/lib/matrix/product-identity";

const modules = import.meta.glob("../convex/**/*.ts");

function product(family: string, graceSku: string) {
    return {
        websiteSku: `${graceSku}-WEB`,
        graceSku,
        category: "Glass Bottle",
        family,
        shape: "Cylinder",
        color: "Clear",
        capacity: "10 ml",
        capacityMl: 10,
        capacityOz: null,
        applicator: null,
        capColor: null,
        trimColor: null,
        capStyle: null,
        neckThreadSize: "18-415",
        heightWithCap: null,
        heightWithoutCap: null,
        diameter: null,
        bottleWeightG: null,
        caseQuantity: null,
        qbPrice: null,
        webPrice1pc: 1.5,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
        itemName: `${family} bottle`,
        itemDescription: null,
        productUrl: null,
        dataGrade: "A",
        bottleCollection: null,
        fitmentStatus: null,
        components: [],
        graceDescription: null,
        verified: true,
    };
}

function group(family: string) {
    return {
        slug: family.toLowerCase().replaceAll(" ", "-"),
        displayName: family,
        family,
        capacity: "10 ml",
        capacityMl: 10,
        color: "Clear",
        category: "Glass Bottle",
        bottleCollection: null,
        neckThreadSize: "18-415",
        variantCount: 1,
        priceRangeMin: 1.5,
        priceRangeMax: 1.5,
    };
}

describe("customer Product Compatibility Matrix families", () => {
    it("returns only families backed by products and never exposes Unknown", async () => {
        const t = convexTest(schema, modules);
        await t.run(async (ctx) => {
            await ctx.db.insert("productGroups", group("Apothecary"));
            await ctx.db.insert("productGroups", group("Cylinder"));
            await ctx.db.insert("productGroups", group("Unknown"));
            await ctx.db.insert("products", product("Cylinder", "GB-CYL-10"));
            await ctx.db.insert("products", product("Unknown", "GB-UNK-10"));
        });

        await expect(t.query(api.matrix.listFamilies, {})).resolves.toEqual([
            { family: "Cylinder", groups: 1 },
        ]);
        await expect(t.query(api.matrix.listFamilies, { includeEmpty: true })).resolves.toEqual([
            { family: "Apothecary", groups: 1 },
            { family: "Cylinder", groups: 1 },
            { family: "Unknown", groups: 1 },
        ]);
    });

    it("carries canonical product group slugs for the bottle and server-resolved components", async () => {
        const t = convexTest(schema, modules);
        const bottleGroup = await t.run(async (ctx) => ctx.db.insert("productGroups", group("Cylinder")));
        const componentGroup = await t.run(async (ctx) => ctx.db.insert("productGroups", {
            ...group("Closure"),
            slug: "closure-18-415",
            category: "Component",
        }));

        await t.run(async (ctx) => {
            await ctx.db.insert("products", {
                ...product("Cylinder", "GB-CYL-NONPRIMARY"),
                productGroupId: bottleGroup,
                components: {
                    Cap: [{
                        graceSku: "COMP-NONPRIMARY",
                        itemName: "18-415 Cap",
                        imageUrl: null,
                        webPrice1pc: 0.25,
                        webPrice12pc: null,
                        capColor: "Black",
                        stockStatus: "In Stock",
                    }],
                },
            });
            await ctx.db.insert("products", {
                ...product("Closure", "COMP-NONPRIMARY"),
                category: "Component",
                productGroupId: componentGroup,
            });
        });

        const result = await t.query(api.matrix.getFamilyRows, { family: "Cylinder" });
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toMatchObject({
            productGroupSlug: "cylinder",
            graceSku: "GB-CYL-NONPRIMARY",
        });
        expect(result.rows[0].components.Cap[0]).toMatchObject({
            productGroupSlug: "closure-18-415",
            graceSku: "COMP-NONPRIMARY",
        });
    });
});

describe("matrix family and product identity helpers", () => {
    it("creates an atomic empty state for switching to a family with disjoint filters", () => {
        expect(emptyMatrixFilters()).toEqual({
            search: "",
            size: "",
            finish: "",
            neck: "",
            closure: "",
        });
    });

    it("switches families without discarding configured rows or cart state", () => {
        const configs = {
            "GB-CYL-10": {
                component: { graceSku: "CMP-CAP-18" },
                qty: 50,
            },
        };
        const cylinder = {
            ...createMatrixFamilyState("Cylinder", configs),
            filters: {
                search: "Cylinder",
                size: "10 ml",
                finish: "Clear",
                neck: "18-415",
                closure: "Cap",
            },
        };

        const sleek = switchMatrixFamily(cylinder, "Sleek");

        expect(sleek.configs).toBe(configs);
        expect(sleek.filters).toEqual(emptyMatrixFilters());
        expect(activeMatrixFilters(cylinder, "Sleek")).toEqual(emptyMatrixFilters());
        expect(activeMatrixFilters(sleek, "Sleek")).toEqual(emptyMatrixFilters());
    });

    it("retains configured rows from both families in order totals and cart lines", () => {
        const cylinderRow = {
            graceSku: "GB-CYL-10",
            itemName: "10 ml Cylinder bottle",
            family: "Cylinder",
            capacity: "10 ml",
            color: "Clear",
            neckThreadSize: "18-415",
            category: "Glass Bottle",
            webPrice1pc: 4,
        };
        const sleekRow = {
            graceSku: "GB-SLK-30",
            itemName: "30 ml Sleek bottle",
            family: "Sleek",
            capacity: "30 ml",
            color: "Amber",
            neckThreadSize: "20-410",
            category: "Glass Bottle",
            webPrice1pc: 3,
        };
        const cylinderComponent = {
            graceSku: "CMP-CYL-CAP",
            itemName: "Cylinder cap",
            webPrice1pc: 1,
        };
        const sleekComponent = {
            graceSku: "CMP-SLK-SPR",
            itemName: "Sleek sprayer",
            webPrice1pc: 2,
        };

        const cylinderConfigured = retainMatrixConfiguration({}, "GB-CYL-10", cylinderRow, {
            component: cylinderComponent,
            qty: 10,
        });
        const bothFamilies = retainMatrixConfiguration(cylinderConfigured, "GB-SLK-30", sleekRow, {
            component: sleekComponent,
            qty: 10,
        });
        const refreshedCylinder = { ...cylinderRow, webPrice1pc: 5 };
        const reconciled = reconcileRetainedMatrixRows(bothFamilies, [refreshedCylinder], (row) => row.graceSku);
        const summary = summarizeMatrixOrder(retainedMatrixCartLines(reconciled), 50);

        expect(summary.items.map((item) => item.graceSku)).toEqual([
            "GB-CYL-10", "CMP-CYL-CAP", "GB-SLK-30", "CMP-SLK-SPR",
        ]);
        expect(summary.subtotal).toBe(110);
        expect(summary.meetsMinimum).toBe(true);
    });

    it("keeps an explicit bottle-only or unmatched component instead of wiping the order line", () => {
        const bottleOnly = retainMatrixConfiguration({}, "GB-CYL-10", { graceSku: "GB-CYL-10" }, {
            component: null,
            qty: 12,
        });
        const unmatched = retainMatrixConfiguration({}, "GB-CYL-11", { graceSku: "GB-CYL-11" }, {
            component: { graceSku: "CMP-OLD" },
            qty: 12,
        });
        const resolvedBottleOnly = reconcileRetainedMatrixRows(
            bottleOnly,
            [{ graceSku: "GB-CYL-10" }],
            (row) => row.graceSku,
            () => undefined,
        );
        const resolvedUnmatched = reconcileRetainedMatrixRows(
            unmatched,
            [{ graceSku: "GB-CYL-11" }],
            (row) => row.graceSku,
            () => undefined,
        );

        expect(resolvedBottleOnly["GB-CYL-10"]?.configuration.component).toBeNull();
        expect(resolvedUnmatched["GB-CYL-11"]?.configuration.component).toEqual({ graceSku: "CMP-OLD" });
        expect(retainedMatrixCartLines(resolvedBottleOnly)).toHaveLength(1);
        expect(retainedMatrixCartLines(resolvedUnmatched)).toHaveLength(1);
    });

    it("links a non-primary variant to its real group PDP and exact SKU", () => {
        expect(matrixProductHref({
            productGroupSlug: "cylinder-10ml-clear",
            websiteSku: "GB-CYL-NONPRIMARY-WEB",
            graceSku: "GB-CYL-NONPRIMARY",
        })).toBe("/products/cylinder-10ml-clear?sku=GB-CYL-NONPRIMARY-WEB");
        expect(matrixProductHref({
            productGroupSlug: null,
            websiteSku: "GB-UNMAPPED-WEB",
            graceSku: "GB-UNMAPPED",
        })).toBeNull();
    });
});

describe("Build Your Bottle route contract", () => {
    const page = readFileSync("src/app/matrix/page.tsx", "utf8");
    const navbar = readFileSync("src/components/Navbar.tsx", "utf8");
    const footer = readFileSync("src/components/Footer.tsx", "utf8");
    const matrix = readFileSync("convex/matrix.ts", "utf8");
    const componentUtils = readFileSync("convex/componentUtils.ts", "utf8");

    it("preserves the public route and breadcrumb under the builder name", () => {
        expect(page).toContain('title: { absolute: "Build Your Bottle | Best Bottles" }');
        expect(page).toContain('alternates: { canonical: `${SITE_URL}/matrix` }');
        expect(page).toContain('{ name: "Build Your Bottle", url: `${SITE_URL}/matrix` }');
    });

    it("continues to use the shared server compatibility engine", () => {
        expect(matrix).toContain('from "./componentUtils"');
        for (const resolver of ["normalizeComponentsByType", "selectBestFitmentRule", "filterGroupedComponentsByFitmentRule"]) {
            expect(matrix).toContain(`${resolver}(`);
            expect(componentUtils).toContain(`export function ${resolver}`);
        }
    });

    it("keeps the same navigation destinations with the new customer-facing name", () => {
        const navigation = navbar.slice(navbar.indexOf("const NAV_LINKS"), navbar.indexOf("const SEARCH_SUGGESTIONS"));
        expect(navigation.match(/label: "Build Your Bottle", href: "\/matrix"/g)).toHaveLength(2);
        expect(footer.match(/\["Build Your Bottle", "\/matrix"\]/g)).toHaveLength(1);
    });
});

describe("matrix capacity filters", () => {
    it("collapses equivalent milliliter labels into one size option", () => {
        expect(matrixSizeOptions([
            "9 ml (0.3 oz)",
            "9 ml (0.30 oz)",
            "9 ml (1/3 oz)",
            "5 ml (0.17 oz)",
            "5.0 ml",
            "5 ml (1/6 oz)",
            "15 ml (0.51 oz)",
            "15 ml",
            "15ml(0.51oz)",
            "0.51 oz (15 ml)",
        ])).toEqual(["5 ml", "9 ml", "15 ml"]);
    });

    it("matches rows whose capacity label uses a different ounce spelling of the same milliliters", () => {
        expect(matrixCapacityMatches("9 ml (1/3 oz)", "9 ml")).toBe(true);
        expect(matrixCapacityMatches("5.0 ml", "5 ml")).toBe(true);
        expect(matrixCapacityMatches({ capacity: "15 ml (0.51 oz)", capacityMl: 15 }, "15 ml")).toBe(true);
        expect(matrixCapacityMatches("13 ml (0.44 oz)", "9 ml")).toBe(false);
    });

    it("does not treat neck threads or leftover 2400-style labels as bottle sizes", () => {
        expect(matrixSizeOptions([
            { capacity: "15 ml (0.51 oz)", capacityMl: 15 },
            { capacity: "20-400", capacityMl: null },
            { capacity: "2400", capacityMl: null },
            { capacity: "30 ml", capacityMl: 30 },
        ])).toEqual(["15 ml", "30 ml"]);
    });
});
