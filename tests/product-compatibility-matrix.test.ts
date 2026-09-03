// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

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
});

describe("Build a Bottle presentation contract", () => {
    const page = readFileSync("src/app/matrix/page.tsx", "utf8");
    const client = readFileSync("src/components/matrix/MatrixClient.tsx", "utf8");
    const navbar = readFileSync("src/components/Navbar.tsx", "utf8");
    const footer = readFileSync("src/components/Footer.tsx", "utf8");
    const matrix = readFileSync("convex/matrix.ts", "utf8");
    const componentUtils = readFileSync("convex/componentUtils.ts", "utf8");
    const pdpDiscovery = readFileSync("src/components/products/PdpDiscoverySections.tsx", "utf8");

    it("presents the public matrix as Build a Bottle with Product Compatibility Matrix metadata", () => {
        expect(client).toMatch(/<h1[^>]*>\s*Build a Bottle\s*<\/h1>/);
        expect(client).toContain("Product Compatibility Matrix");
        expect(page).toContain('title: { absolute: "Build a Bottle — Product Compatibility Matrix | Best Bottles" }');
        expect(page).toContain("Product Compatibility Matrix");
        expect(page).toContain("Everyone pays the same");
        expect(page).toContain("approved resale certificate are not charged tax");
        expect(page).not.toContain("wholesale-only pricing");
        expect(page).not.toContain("wholesale price");
    });

    it("keeps the stable public family-preselected route and family-scoped filters", () => {
        expect(page).toContain('alternates: { canonical: `${SITE_URL}/matrix` }');
        expect(page).toContain("searchParams: Promise<{ family?: string }>");
        expect(page).toContain("families.some((f) => f.family === familyParam)");
        expect(client).toContain("router.replace(`/matrix?family=${encodeURIComponent(e.target.value)}`)");
        expect(client).toContain("const rows = useMemo(() => initialRows?.rows ?? [], [initialRows]);");
        for (const label of ["All sizes", "All finishes", "All necks", "All closures"]) {
            expect(client).toContain(`label="${label}"`);
        }
        expect(pdpDiscovery).toContain("/matrix?family=${encodeURIComponent(family)}");
    });

    it("continues to use the one server-resolved compatibility engine", () => {
        expect(matrix).toContain('from "./componentUtils"');
        for (const resolver of [
            "normalizeComponentsByType",
            "selectBestFitmentRule",
            "filterGroupedComponentsByFitmentRule",
        ]) {
            expect(matrix).toContain(`${resolver}(`);
            expect(componentUtils).toContain(`export function ${resolver}`);
        }
        expect(client).toContain("convex/matrix.ts");
        expect(client).toContain('const unknown = row.resolution === "unknown";');
        expect(client).toContain("Compatibility not mapped — bottle only");
        expect(client).not.toContain("includes a component");
        expect(client).not.toContain("comes with");
    });

    it("links each exact bottle and selected component to its catalog identity", () => {
        expect(client).toContain("function catalogIdentityHref");
        expect(client).toContain("href={catalogIdentityHref(row.websiteSku ?? row.graceSku)}");
        expect(client).toContain("href={catalogIdentityHref(config.component.websiteSku ?? config.component.graceSku)}");
        expect(client).not.toContain("components are included");
    });

    it("keeps one Build a Bottle utility entry in each Navbar variant and one in the Footer", () => {
        const navigation = navbar.slice(navbar.indexOf("const NAV_LINKS"), navbar.indexOf("const SEARCH_SUGGESTIONS"));
        expect(navigation.match(/label: "Build a Bottle", href: "\/matrix"/g)).toHaveLength(2);
        expect(navigation.match(/label: "Catalog", href: "\/catalog"/g)).toHaveLength(2);
        expect(footer.match(/\["Build a Bottle", "\/matrix"\]/g)).toHaveLength(1);
    });
});
