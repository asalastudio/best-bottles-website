import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { PaperDollConfiguration } from "@/lib/paper-doll/types";
import {
    getCylinderConfiguratorOptions,
    isUnifiedCylinderBuildReady,
    resolveCylinderConfigurationFromQuery,
    resolveUnifiedPdpView,
    selectCylinderConfiguration,
} from "@/lib/products/unified-cylinder-pdp";
import { buildCylinder9mlConfigurations } from "@/lib/products/cylinder-9ml-configurator";
import { resolvePaperDollLayers, resolvePaperDollLayersResult } from "@/lib/paper-doll/render";
import type { StorefrontPaperDollFamily } from "@/lib/paper-doll/sanity";
import { swirlWhiteCapFixtures } from "./fixtures/cylinder-9ml";

function configuration(values: Partial<PaperDollConfiguration>): PaperDollConfiguration {
    return {
        graceSku: "GB-CYL-CLR-9ML-MRL-WHT",
        websiteSku: "GBCyl9MtlRollWht",
        productGroupSlug: "cylinder-9ml-clear-17-415-rollon",
        familyKey: "CYL-9ML",
        family: "Cylinder",
        capacityMl: 9,
        neckThreadSize: "17-415",
        glassLabel: "Clear",
        glassKey: "CLR",
        applicatorLabel: "Metal Roller Ball",
        applicatorKey: "metal-roller",
        mode: "rollon",
        finishLabel: "White",
        layerKeys: { body: "CLR", roller: "MTL-ROLL", cap: "WHT" },
        price1pc: 0.76,
        priceTiers: [{ minQty: 1, totalPrice: 0.76, unitPrice: 0.76 }],
        stockStatus: "In Stock",
        shopifyVariantId: "gid://shopify/ProductVariant/1",
        shopifySellable: true,
        ...values,
    };
}

const configurations = [
    configuration({}),
    configuration({
        graceSku: "GB-CYL-AMB-9ML-MRL-WHT",
        websiteSku: "GBCylAmb9MtlRollWht",
        glassLabel: "Amber",
        glassKey: "AMB",
        layerKeys: { body: "AMB", roller: "MTL-ROLL", cap: "WHT" },
        price1pc: 0.82,
    }),
    configuration({
        graceSku: "GB-CYL-AMB-9ML-MRL-SGLD",
        websiteSku: "GBCylAmb9MtlRollShnGl",
        glassLabel: "Amber",
        glassKey: "AMB",
        finishLabel: "Shiny Gold",
        layerKeys: { body: "AMB", roller: "MTL-ROLL", cap: "SHN-GL" },
        price1pc: 0.91,
    }),
    configuration({
        graceSku: "GB-CYL-AMB-9ML-ROL-WHT",
        websiteSku: "GBCylAmb9RollWht",
        glassLabel: "Amber",
        glassKey: "AMB",
        applicatorLabel: "Plastic Roller Ball",
        applicatorKey: "plastic-roller",
        layerKeys: { body: "AMB", roller: "PLS-ROLL", cap: "WHT" },
        price1pc: 0.79,
    }),
    configuration({
        graceSku: "GB-CYL-AMB-9ML-SPR-BLK",
        websiteSku: "GBCylAmb9SpryBlk",
        glassLabel: "Amber",
        glassKey: "AMB",
        applicatorLabel: "Fine Mist Sprayer",
        applicatorKey: "fine-mist-sprayer",
        mode: "spray",
        finishLabel: "Black",
        layerKeys: { body: "AMB", sprayer: "BLK" },
        price1pc: 0.9,
    }),
] as const;

describe("unified Cylinder PDP state", () => {
    it("preserves an explicitly requested Build view while the release is still preparing", () => {
        expect(resolveUnifiedPdpView("build")).toBe("build");
        expect(resolveUnifiedPdpView(null)).toBe("beauty");
    });

    it("keeps unreleased layered media out of the configurator while preserving its future release path", () => {
        const source = readFileSync("src/components/products/UnifiedBottlePdp.tsx", "utf8");

        expect(source).toContain("Product photos");
        expect(source).toContain("Build preview · 145 configurations");
        expect(source).toContain("min-h-[360px] sm:min-h-[420px]");
        expect(source).toContain('{buildReady && <div className="min-w-0">');
        expect(source).toContain('"mx-auto max-w-[820px]"');
        expect(source).toContain("Choose from every verified component below");
        expect(source).not.toContain('next.set("view", "beauty");\n            router.replace');
    });

    it("uses the Sanity beauty gallery for the glass-level hero without replacing exact builder truth", () => {
        const component = readFileSync("src/components/products/UnifiedBottlePdp.tsx", "utf8");
        const page = readFileSync("src/app/products/[slug]/page.tsx", "utf8");
        const queries = readFileSync("src/sanity/lib/queries.ts", "utf8");
        const serverClient = readFileSync("src/sanity/lib/serverClient.ts", "utf8");

        expect(component).toContain("resolveCylinderBeautyHero(beautyGallery, selected.glassKey)");
        expect(component).toContain('className="object-cover"');
        expect(component).toContain("max-w-[1040px]");
        expect(component).toContain("Beauty reference · Metal roller · Matte silver");
        expect(component).not.toContain('rows.push({\n                url: beautyHero.imageUrl');
        expect(component).toContain("<PaperDollCanvas");
        expect(page).toContain("getStorefrontCylinderBeautyGallery");
        expect(page).toContain("beautyGallery={beautyGallery}");
        expect(queries).toContain("authenticatedServerClient ?? client");
        expect(serverClient).toContain('import "server-only"');
        expect(serverClient).toContain("SANITY_API_READ_TOKEN");
        expect(serverClient).not.toContain("NEXT_PUBLIC_SANITY_API_READ_TOKEN");
    });

    it("selects a valid configuration SKU and flags an invalid SKU for URL cleanup", () => {
        expect(resolveCylinderConfigurationFromQuery(configurations, "GB-CYL-AMB-9ML-MRL-SGLD")).toMatchObject({
            configuration: { graceSku: "GB-CYL-AMB-9ML-MRL-SGLD" },
            invalidConfiguration: false,
        });
        expect(resolveCylinderConfigurationFromQuery(configurations, "NOT-A-REAL-SKU")).toMatchObject({
            configuration: { graceSku: "GB-CYL-CLR-9ML-MRL-WHT" },
            invalidConfiguration: true,
        });
    });

    it("uses a Clear Roll-On as the default even when data arrives in another order", () => {
        const result = resolveCylinderConfigurationFromQuery(
            [configurations[4], configurations[1], configurations[0]],
            null,
        );

        expect(result.configuration.graceSku).toBe("GB-CYL-CLR-9ML-MRL-WHT");
    });

    it("preserves compatible downstream choices when glass changes", () => {
        const selected = selectCylinderConfiguration(
            configurations,
            configurations[0],
            { dimension: "glass", value: "Amber" },
        );

        expect(selected.graceSku).toBe("GB-CYL-AMB-9ML-MRL-WHT");
        expect(selected.finishLabel).toBe("White");
        expect(selected.applicatorKey).toBe("metal-roller");
    });

    it("resets only choices downstream of a changed delivery system", () => {
        const selected = selectCylinderConfiguration(
            configurations,
            configurations[2],
            { dimension: "deliverySystem", value: "spray" },
        );

        expect(selected).toMatchObject({
            graceSku: "GB-CYL-AMB-9ML-SPR-BLK",
            glassLabel: "Amber",
            mode: "spray",
            finishLabel: "Black",
        });
    });

    it("shows roller material only for Roll-On paths", () => {
        expect(getCylinderConfiguratorOptions(configurations, configurations[1]).rollerMaterials).toEqual(["Metal", "Plastic"]);
        expect(getCylinderConfiguratorOptions(configurations, configurations[4]).rollerMaterials).toEqual([]);
    });

    it("resolves both Swirl white-cap roller materials to their exact SKUs", () => {
        const rows = buildCylinder9mlConfigurations(swirlWhiteCapFixtures);
        const metal = selectCylinderConfiguration(rows, rows[0], { dimension: "rollerMaterial", value: "Metal" });
        const plastic = selectCylinderConfiguration(rows, rows[0], { dimension: "rollerMaterial", value: "Plastic" });

        expect(metal.graceSku).toBe("GB-CYL-WHT-9ML-MRL-WHT");
        expect(plastic.graceSku).toBe("GB-CYL-WHT-9ML-ROL-WHT");
    });

    it("keeps price, stock, SKU, and Shopify cart identity on the selected row", () => {
        const selected = selectCylinderConfiguration(
            configurations,
            configurations[0],
            { dimension: "finish", value: "Shiny Gold" },
        );

        expect(selected).toMatchObject({
            graceSku: "GB-CYL-CLR-9ML-MRL-WHT",
            price1pc: 0.76,
            stockStatus: "In Stock",
            shopifyVariantId: "gid://shopify/ProductVariant/1",
        });
    });

    it("carries the selected source row's commerce and gallery fields into the unified configuration", () => {
        const [source] = swirlWhiteCapFixtures;
        const [selected] = buildCylinder9mlConfigurations([{
            group: source.group,
            variant: {
                ...source.variant,
                _id: "product-row-1",
                itemDescription: "Swirl glass roll-on bottle.",
                imageUrl: "https://cdn.shopify.com/s/files/swirl-white.png",
                imageUrlCapOff: "https://cdn.shopify.com/s/files/swirl-white-open.png",
                webPrice10pc: 0.7,
                webPrice12pc: 0.68,
                category: "Bottles",
                heightWithCap: "87 ±1 mm",
                heightWithoutCap: "74 ±1 mm",
                diameter: "21 ±0.5 mm",
                bottleWeightG: 28,
                caseQuantity: 144,
            },
        }]);

        expect(selected).toMatchObject({
            variantId: "product-row-1",
            itemDescription: "Swirl glass roll-on bottle.",
            imageUrl: "https://cdn.shopify.com/s/files/swirl-white.png",
            imageUrlCapOff: "https://cdn.shopify.com/s/files/swirl-white-open.png",
            webPrice10pc: 0.7,
            webPrice12pc: 0.68,
            category: "Bottles",
            heightWithCap: "87 ±1 mm",
            heightWithoutCap: "74 ±1 mm",
            diameter: "21 ±0.5 mm",
            bottleWeightG: 28,
            caseQuantity: 144,
        });
    });

    it("requires 145 unique configurations and released assets before showing the Paper Doll tab", () => {
        const complete = Array.from({ length: 145 }, (_, index) => configuration({ graceSku: `CYL-${index + 1}` }));

        expect(isUnifiedCylinderBuildReady(complete, true)).toBe(true);
        expect(isUnifiedCylinderBuildReady(complete.slice(0, 143), true)).toBe(false);
        expect(isUnifiedCylinderBuildReady(complete, false)).toBe(false);
        expect(isUnifiedCylinderBuildReady([...complete.slice(0, 144), complete[0]], true)).toBe(false);
    });

    it("renders full-canvas Paper Doll layers in the explicit mode order", () => {
        const family = {
            layerOrderRollon: ["body", "roller", "cap"],
            layerOrderSpray: ["body", "sprayer"],
            layerOrderLotion: ["body", "pump"],
            layerAssets: [
                { slot: "cap", variantKey: "WHT", imageUrl: "https://cdn.sanity.io/cap.png" },
                { slot: "body", variantKey: "CLR", imageUrl: "https://cdn.sanity.io/body.png" },
                { slot: "roller", variantKey: "MTL-ROLL", imageUrl: "https://cdn.sanity.io/roller.png" },
            ],
        } as StorefrontPaperDollFamily;

        expect(resolvePaperDollLayers(family, configurations[0]).map((layer) => layer.imageUrl)).toEqual([
            "https://cdn.sanity.io/body.png",
            "https://cdn.sanity.io/roller.png",
            "https://cdn.sanity.io/cap.png",
        ]);
    });

    it("rejects a configuration when any required Paper Doll layer is absent", () => {
        const family = {
            layerOrderRollon: ["body", "roller", "cap"],
            layerOrderSpray: ["body", "sprayer"],
            layerOrderLotion: ["body", "pump"],
            layerAssets: [
                { slot: "body", variantKey: "CLR", imageUrl: "https://cdn.sanity.io/body.png" },
                { slot: "cap", variantKey: "WHT", imageUrl: "https://cdn.sanity.io/cap.png" },
            ],
        } as StorefrontPaperDollFamily;

        expect(() => resolvePaperDollLayers(family, configurations[0])).toThrow(/roller:MTL-ROLL/);
        expect(resolvePaperDollLayersResult(family, configurations[0])).toEqual({
            ok: false,
            missing: {
                slot: "roller",
                variantKey: "MTL-ROLL",
                sku: "GB-CYL-CLR-9ML-MRL-WHT",
            },
        });
    });

    it("labels draft preview and exposes exact missing-layer diagnostics", () => {
        const source = readFileSync("src/components/products/UnifiedBottlePdp.tsx", "utf8");

        expect(source).toContain("Draft preview — not publicly released");
        expect(source).toContain("resolvePaperDollLayersResult");
        expect(source).toContain("layerResolution.missing.slot");
        expect(source).toContain("layerResolution.missing.variantKey");
    });
});
