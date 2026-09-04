import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FocusedFinderResults from "@/components/catalog/FocusedFinderResults";
import type { GuidedFinderFamily } from "@/lib/products/guided-finder";

const cylinderFamilies: GuidedFinderFamily[] = [{
    family: "Cylinder",
    exactProducts: [{
        id: "cylinder-9ml-rollon-variant",
        groupId: "cylinder-9ml-rollon",
        displayName: "9 ml Clear Cylinder Roll-On Bottle",
        imageUrl: null,
        family: "Cylinder",
        capacity: "9 ml",
        color: "Clear",
        application: "Roll-On",
        rollerMaterial: "metal",
        neckFinish: "17-415",
        stockStatus: "In Stock",
        availability: "in-stock",
        caseQuantity: 144,
        webPrice1pc: 0.72,
        startingUnitPrice: 0.72,
        shopifyVariantId: "gid://shopify/ProductVariant/1",
        shopifySellable: true,
        checkoutReady: true,
        href: "/products/cylinder-9ml-rollon",
    }],
}];

function renderCylinderResults(isUpdating = false): string {
    return renderToStaticMarkup(createElement(FocusedFinderResults, {
        families: cylinderFamilies,
        finderUrl: "/catalog/cylinder?applicators=rollon",
        resultCount: 1,
        isUpdating,
    }));
}

describe("continuous catalog product grid", () => {
    it("keeps B2B exact-result decision fields aligned between fallback and Convex preview producers", () => {
        const fallback = readFileSync(join(process.cwd(), "src/lib/catalogSearchFallback.ts"), "utf8");
        const convex = readFileSync(join(process.cwd(), "convex/products.ts"), "utf8");

        for (const field of ["stockStatus", "caseQuantity", "webPrice1pc", "shopifyVariantId", "shopifySellable"]) {
            expect(fallback).toContain(`${field}:`);
            expect(convex).toContain(`${field}: variant.${field} ?? null`);
        }
    });

    it("owns the hairline dividers and responsive columns", () => {
        const source = readFileSync(
            join(process.cwd(), "src/components/catalog/CatalogProductGrid.tsx"),
            "utf8",
        );
        expect(source).toContain("gap-px");
        expect(source).toContain("border-champagne");
        expect(source).toContain("sm:grid-cols-2");
        expect(source).toContain("xl:grid-cols-4");
    });

    it("keeps the master continuous grid and gives Cylinder exact focused results", () => {
        const master = readFileSync(join(process.cwd(), "src/app/catalog/CatalogClient.tsx"), "utf8");
        const cylinder = renderCylinderResults();

        expect(master).toContain("<CatalogProductGrid");
        expect(cylinder).toContain("1 exact product");
        expect(cylinder).toContain(
            "/products/cylinder-9ml-rollon?from=%2Fcatalog%2Fcylinder%3Fapplicators%3Drollon",
        );
    });

    it("removes floating-card decoration from visual product cards", () => {
        const master = readFileSync(join(process.cwd(), "src/app/catalog/CatalogClient.tsx"), "utf8");
        const cylinder = renderCylinderResults();
        expect(master).not.toContain("hover:shadow-lg");
        expect(cylinder).not.toContain("hover:shadow-md");
        expect(master).not.toContain("hover:bg-bone/25");
        expect(cylinder).not.toContain("hover:bg-bone/25");
        expect(master).toContain("focus-within:outline");
        expect(cylinder).toContain("focus-within:outline");
    });

    it("keeps product titles readable instead of truncating them", () => {
        const master = readFileSync(join(process.cwd(), "src/app/catalog/CatalogClient.tsx"), "utf8");
        expect(master).not.toContain("leading-snug line-clamp-2 mb-3");
    });
});
