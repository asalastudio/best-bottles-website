import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
    PdpDiscoveryContent,
    PdpDiscoveryMatrixLink,
    selectDiscoveryCompatibility,
    type PdpCompatibilityPayload,
} from "@/components/products/PdpDiscoverySections";

const relations = {
    currentApplication: "rollon" as const,
    sameApplicationSizes: [
        {
            slug: "cylinder-9ml-rollon",
            displayName: "9 ml Clear Cylinder Roll-On",
            family: "Cylinder",
            capacity: "9 ml",
            capacityMl: 9,
            color: "Clear",
            application: "rollon" as const,
            applicationLabel: "Roll-On",
            neckThreadSize: "17-415",
            neckThreadLabel: "17-415 neck finish",
            heroImageUrl: "https://cdn.shopify.com/9ml.jpg",
            priceRangeMin: 1.15,
            variantCount: 1,
            isCurrent: true,
        },
        {
            slug: "cylinder-15ml-rollon",
            displayName: "15 ml Clear Cylinder Roll-On",
            family: "Cylinder",
            capacity: "15 ml",
            capacityMl: 15,
            color: "Clear",
            application: "rollon" as const,
            applicationLabel: "Roll-On",
            neckThreadSize: "18-415",
            neckThreadLabel: "18-415 neck finish",
            heroImageUrl: null,
            priceRangeMin: 1.4,
            variantCount: 1,
            isCurrent: false,
        },
    ],
    otherApplications: [{
        slug: "cylinder-9ml-spray",
        displayName: "9 ml Clear Cylinder Fine Mist Spray",
        family: "Cylinder",
        capacity: "9 ml",
        capacityMl: 9,
        color: "Clear",
        application: "spray" as const,
        applicationLabel: "Fine Mist & Spray",
        neckThreadSize: "18-415",
        neckThreadLabel: "18-415 neck finish",
        heroImageUrl: "https://cdn.shopify.com/spray.jpg",
        priceRangeMin: 1.6,
        variantCount: 1,
        isCurrent: false,
    }],
};

const compatibility: PdpCompatibilityPayload = {
    bottle: {
        graceSku: "GB-CYL-9",
        websiteSku: "Cyl9ClrRollOn",
        itemName: "9 ml Clear Cylinder Roll-On",
        imageUrl: "https://cdn.shopify.com/bottle.jpg",
        shopifyVariantId: "gid://shopify/ProductVariant/9",
        shopifySellable: true,
        category: "Bottle",
        family: "Cylinder",
        capacity: "9 ml",
        color: "Clear",
        neckThreadSize: "17-415",
        applicator: "Metal Roller Ball",
        capColor: null,
        capStyle: null,
        heightWithCap: null,
        heightWithoutCap: null,
        diameter: null,
        bottleWeightG: null,
        caseWeightG: null,
        caseQuantity: 144,
        useCaseDescription: null,
        webPrice1pc: 1.15,
        webPrice10pc: null,
        webPrice12pc: null,
        stockStatus: "In Stock",
    },
    componentTypes: ["Roll-On Cap"],
    totalComponents: 2,
    components: {
        "Roll-On Cap": [
            {
                graceSku: "CMP-ROLLER-17",
                websiteSku: "Roller17Blk",
                itemName: "Black Roll-On Cap",
                imageUrl: "https://cdn.shopify.com/roller.jpg",
                shopifyVariantId: "gid://shopify/ProductVariant/17",
                shopifySellable: true,
                webPrice1pc: 0.5,
                webPrice12pc: 0.4,
                capColor: "Black",
                stockStatus: "In Stock",
            },
            {
                graceSku: "CMP-ROLLER-QUOTE",
                websiteSku: "Roller17Gold",
                itemName: "Gold Roll-On Cap",
                imageUrl: null,
                shopifyVariantId: null,
                shopifySellable: false,
                webPrice1pc: 0.7,
                webPrice12pc: null,
                capColor: "Gold",
                stockStatus: "Lead time applies",
            },
        ],
    },
};

function render(compatibilityPayload = compatibility) {
    return renderToStaticMarkup(createElement(PdpDiscoveryContent, {
        family: "Cylinder",
        relations,
        compatibility: compatibilityPayload,
        onAskGrace: () => undefined,
        onAddComponent: () => undefined,
    }));
}

function renderPageOrder() {
    return renderToStaticMarkup(createElement(
        Fragment,
        null,
        createElement(PdpDiscoveryContent, {
            family: "Cylinder",
            relations,
            compatibility,
            onAskGrace: () => undefined,
            onAddComponent: () => undefined,
        }),
        createElement("div", null, "Technical specifications follow below"),
        createElement(PdpDiscoveryMatrixLink, { family: "Cylinder" }),
    ));
}

describe("PdpDiscoverySections", () => {
    it("places the real PDP's lower content in the binding buying order", () => {
        const page = readFileSync("src/app/products/[slug]/ProductDetailClient.tsx", "utf8");
        const discovery = page.indexOf("<PdpDiscoverySections");
        const specifications = page.indexOf("Specifications", discovery);
        const volumeFulfillment = page.indexOf('data-testid="pdp-volume-fulfillment"', discovery);
        const editorial = page.indexOf("<PdpEditorialZone", discovery);
        const matrix = page.indexOf("<PdpDiscoveryMatrixLink", discovery);

        expect(discovery).toBeGreaterThan(-1);
        expect(specifications).toBeGreaterThan(discovery);
        expect(volumeFulfillment).toBeGreaterThan(specifications);
        expect(editorial).toBeGreaterThan(volumeFulfillment);
        expect(matrix).toBeGreaterThan(editorial);
    });

    it("keeps fitment claims out of the legacy sibling-derived buy-panel summary", () => {
        const page = readFileSync("src/app/products/[slug]/ProductDetailClient.tsx", "utf8");

        expect(page).not.toContain("ProductConfidenceSummary");
        expect(page).not.toContain("Compatibility Snapshot");
        expect(page).not.toContain("Fitment ready");
        expect(page).not.toContain("Use neck size to match caps, rollers, sprayers, reducers, and droppers.");
    });

    it("keeps the three buying sections ahead of specifications and the matrix escape hatch", () => {
        const markup = renderPageOrder();

        const size = markup.indexOf("Also available in these sizes");
        const applications = markup.indexOf("Other ways to dispense");
        const components = markup.indexOf("Compatible components");
        const specifications = markup.indexOf("Technical specifications follow below");
        const matrix = markup.indexOf("Compare all compatible combinations");

        expect(size).toBeGreaterThan(-1);
        expect(applications).toBeGreaterThan(size);
        expect(components).toBeGreaterThan(applications);
        expect(specifications).toBeGreaterThan(components);
        expect(matrix).toBeGreaterThan(specifications);
        expect(markup).toContain('href="/matrix?family=Cylinder&amp;from=pdp"');
    });

    it("labels product-intent alternatives without claiming they come with the bottle", () => {
        const markup = render();

        expect(markup).toContain("Also available as");
        expect(markup).not.toMatch(/comes with/i);
        expect(markup).toContain("Fine Mist &amp; Spray");
    });

    it("renders fitment-resolved component truth and an honest media fallback", () => {
        const markup = render();

        expect(markup).toContain("Compatible with this bottle");
        expect(markup).toContain("Roller17Blk");
        expect(markup).toContain("CMP-ROLLER-17");
        expect(markup).toContain("roller.jpg");
        expect(markup).toContain("In Stock");
        expect(markup).toContain("$0.50 /ea");
        expect(markup).toContain("Add to Cart");
        expect(markup).toContain("Roller17Gold");
        expect(markup).toContain("Lead time applies");
        expect(markup).toContain("$0.70 /ea");
        expect(markup).toContain("Request Quote");
        expect(markup).toContain("Media preparation in progress");
    });

    it("states when compatibility is unmapped and directs the buyer to Grace", () => {
        const markup = render({ ...compatibility, components: {}, componentTypes: [], totalComponents: 0 });

        expect(markup).toContain("Compatibility is unmapped for this SKU.");
        expect(markup).toContain("Ask Grace about fitment");
        expect(markup).not.toContain("No compatible components");
    });

    it("keeps the server compatibility visible until the selected-SKU refresh resolves", () => {
        expect(selectDiscoveryCompatibility(compatibility, undefined)).toBe(compatibility);

        const refreshed = { ...compatibility, bottle: { ...compatibility.bottle, websiteSku: "Cyl15ClrRollOn" } };
        expect(selectDiscoveryCompatibility(compatibility, refreshed)).toBe(refreshed);
    });
});
