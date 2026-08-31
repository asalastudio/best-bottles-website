import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    assertPreviewPaperDollFamily,
    type RenderablePaperDollFamily,
} from "@/lib/paper-doll/sanity";
import {
    resolveConfigurationLayerKeys,
    resolvePaperDollLayersResult,
} from "@/lib/paper-doll/render";
import type { PaperDollConfiguration } from "@/lib/paper-doll/types";

function layer(slot: string, variantKey: string) {
    return {
        _key: `${slot}-${variantKey}`,
        slot,
        variantKey,
        imageUrl: `https://cdn.sanity.io/images/project/production/${slot}-${variantKey}.png`,
        imageWidth: 2080,
        imageHeight: 2288,
    };
}

/** Mirrors the 1.3.0-complete-family.1 release: new-vocabulary variant keys plus catalog mappings. */
function releaseFamily(): RenderablePaperDollFamily {
    return assertPreviewPaperDollFamily({
        _id: "paperDollRelease.CYL-9ML.1-3-0-complete-family-1",
        familyKey: "CYL-9ML",
        displayName: "Cylinder 9 mL — 17-415",
        canvasPreset: "pdp-2080x2288",
        canvasWidth: 2080,
        canvasHeight: 2288,
        pipelineVersion: "paper-doll-complete-family-v1",
        assetRevision: "1.3.0-complete-family.1",
        storefrontReady: true,
        layerOrderRollon: ["body", "roller", "cap"],
        layerOrderSpray: ["body", "sprayer"],
        layerOrderShortcap: [],
        layerOrderLotion: ["body", "pump"],
        layerAssets: [
            layer("body", "CLR"),
            layer("body", "AMB"),
            layer("roller", "METAL"),
            layer("roller", "PLASTIC"),
            layer("cap", "WHT"),
            layer("cap", "SSLV"),
            layer("sprayer", "BLK"),
            layer("sprayer", "GLD"),
            layer("pump", "MSLV"),
        ],
        assemblyMappings: [
            {
                _key: "mapping-cyl-9ml-clr-rollon-wht-metal",
                mappingKey: "CYL-9ML:CLR:ROLLON:WHT:METAL",
                recipeKey: "CYL-9ML:ROLLON",
                graceSku: "GB-CYL-CLR-9ML-MRL-WHT",
                websiteSku: "GBCylClr9MtlRollWht",
                bodyVariantKey: "CLR",
                fitmentVariantKey: "METAL",
                closureVariantKey: "WHT",
                overcapVariantKey: null,
            },
            {
                _key: "mapping-cyl-9ml-amb-spray-gld",
                mappingKey: "CYL-9ML:AMB:SPRAY:GLD",
                recipeKey: "CYL-9ML:SPRAY",
                graceSku: "GB-CYL-AMB-9ML-SPR-GLD",
                websiteSku: "GBCylAmb9SpryGl",
                bodyVariantKey: "AMB",
                fitmentVariantKey: "GLD",
                closureVariantKey: null,
                overcapVariantKey: null,
            },
            {
                _key: "mapping-cyl-9ml-clr-lotion-mslv",
                mappingKey: "CYL-9ML:CLR:LOTION:MSLV",
                recipeKey: "CYL-9ML:LOTION",
                graceSku: "LB-CYL-CLR-9ML-LPM-MSLV",
                websiteSku: "LBCylClr9LtnMtSl",
                bodyVariantKey: "CLR",
                fitmentVariantKey: "MSLV",
                closureVariantKey: null,
                overcapVariantKey: null,
            },
        ],
    });
}

/** Mirrors the pre-release family document: legacy variant keys, no mappings. */
function legacyFamily(): RenderablePaperDollFamily {
    return assertPreviewPaperDollFamily({
        _id: "d5291f24-f02b-4fb7-aa99-78c5f63d8c9d",
        familyKey: "CYL-9ML",
        displayName: "Cylinder 9 mL — 17-415",
        canvasPreset: "pdp-2080x2288",
        canvasWidth: 2080,
        canvasHeight: 2288,
        pipelineVersion: "paper-doll-v1",
        assetRevision: "legacy",
        storefrontReady: false,
        layerOrderRollon: ["body", "roller", "cap"],
        layerOrderSpray: ["body", "sprayer"],
        layerOrderShortcap: [],
        layerOrderLotion: ["body", "pump"],
        layerAssets: [
            layer("body", "CLR"),
            layer("roller", "MTL-ROLL"),
            layer("cap", "WHT"),
        ],
    });
}

function configuration(overrides: Partial<PaperDollConfiguration>): PaperDollConfiguration {
    return {
        graceSku: "GB-CYL-CLR-9ML-MRL-WHT",
        websiteSku: "GBCylClr9MtlRollWht",
        mode: "rollon",
        layerKeys: { body: "CLR", roller: "MTL-ROLL", cap: "WHT" },
        ...overrides,
    } as PaperDollConfiguration;
}

describe("release mapping layer-key resolution", () => {
    it("resolves roll-on keys from the release mapping, not the legacy configurator keys", () => {
        const result = resolvePaperDollLayersResult(releaseFamily(), configuration({}));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.layers.map((entry) => `${entry.slot}:${entry.variantKey}`)).toEqual([
            "body:CLR",
            "roller:METAL",
            "cap:WHT",
        ]);
    });

    it("resolves spray keys through fitmentVariantKey", () => {
        const result = resolvePaperDollLayersResult(releaseFamily(), configuration({
            graceSku: "GB-CYL-AMB-9ML-SPR-GLD",
            websiteSku: "GBCylAmb9SpryGl",
            mode: "spray",
            layerKeys: { body: "AMB", sprayer: "GL" },
        }));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.layers.map((entry) => `${entry.slot}:${entry.variantKey}`)).toEqual([
            "body:AMB",
            "sprayer:GLD",
        ]);
    });

    it("resolves lotion keys through fitmentVariantKey", () => {
        const result = resolvePaperDollLayersResult(releaseFamily(), configuration({
            graceSku: "LB-CYL-CLR-9ML-LPM-MSLV",
            websiteSku: "LBCylClr9LtnMtSl",
            mode: "lotion",
            layerKeys: { body: "CLR", pump: "MATT-SL" },
        }));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.layers.map((entry) => `${entry.slot}:${entry.variantKey}`)).toEqual([
            "body:CLR",
            "pump:MSLV",
        ]);
    });

    it("falls back to websiteSku when graceSku spelling drifts", () => {
        const keys = resolveConfigurationLayerKeys(releaseFamily(), configuration({
            graceSku: "GB-CYL-CLR-9ML-MRL-WHT-ALT",
        }));
        expect(keys).toEqual({ body: "CLR", roller: "METAL", cap: "WHT" });
    });

    it("keeps legacy configurator keys for families without mappings", () => {
        const result = resolvePaperDollLayersResult(legacyFamily(), configuration({}));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.layers.map((entry) => `${entry.slot}:${entry.variantKey}`)).toEqual([
            "body:CLR",
            "roller:MTL-ROLL",
            "cap:WHT",
        ]);
    });

    it("fails closed with a visible missing layer when a SKU has no mapping and legacy keys miss", () => {
        const result = resolvePaperDollLayersResult(releaseFamily(), configuration({
            graceSku: "GB-CYL-SWL-9ML-MRL-WHT",
            websiteSku: "GBCylSwl9MtlRollWht",
            layerKeys: { body: "SWL", roller: "MTL-ROLL", cap: "WHT" },
        }));
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.missing).toEqual({
            slot: "body",
            variantKey: "SWL",
            sku: "GB-CYL-SWL-9ML-MRL-WHT",
        });
    });

    it("projects assemblyMappings in the storefront GROQ query for both release and family reads", () => {
        const queriesSource = readFileSync("src/sanity/lib/queries.ts", "utf8");
        const occurrences = queriesSource.match(/assemblyMappings\[\]/g) ?? [];
        expect(occurrences.length).toBeGreaterThanOrEqual(2);
        expect(queriesSource).toContain("fitmentVariantKey");
        expect(queriesSource).toContain("closureVariantKey");
    });
});
