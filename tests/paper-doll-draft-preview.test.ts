import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    assertPreviewPaperDollFamily,
    assertStorefrontPaperDollFamily,
} from "@/lib/paper-doll/sanity";
import { isPaperDollDraftPreviewAllowed } from "@/lib/paper-doll/preview";
import { resolvePaperDollLayersResult } from "@/lib/paper-doll/render";
import type { PaperDollConfiguration } from "@/lib/paper-doll/types";

function draftFamily() {
    return {
        _id: "drafts.paperDollRelease.CYL-9ML.1-2-0",
        familyKey: "CYL-9ML",
        displayName: "Cylinder 9 mL — 17-415",
        canvasPreset: "pdp-2080x2288",
        canvasWidth: 2080,
        canvasHeight: 2288,
        pipelineVersion: "paper-doll-capped-source-v3",
        assetRevision: "1.2.0-capped-dispensers.1",
        storefrontReady: false,
        layerOrderRollon: ["body", "roller", "cap"],
        layerOrderSpray: ["body", "sprayer"],
        layerOrderShortcap: [],
        layerOrderLotion: ["body", "pump"],
        layerAssets: [
            {
                _key: "body-clr",
                slot: "body",
                variantKey: "CLR",
                imageUrl: "https://cdn.sanity.io/images/project/production/body.png",
                imageWidth: 2080,
                imageHeight: 2288,
            },
            {
                _key: "roller-metal",
                slot: "roller",
                variantKey: "MTL-ROLL",
                imageUrl: "https://cdn.sanity.io/images/project/production/roller.png",
                imageWidth: 2080,
                imageHeight: 2288,
            },
            {
                _key: "sprayer-black",
                slot: "sprayer",
                variantKey: "BLK",
                imageUrl: "https://cdn.sanity.io/images/project/production/sprayer.png",
                imageWidth: 2080,
                imageHeight: 2288,
            },
            {
                _key: "pump-black",
                slot: "pump",
                variantKey: "BLK",
                imageUrl: "https://cdn.sanity.io/images/project/production/pump.png",
                imageWidth: 2080,
                imageHeight: 2288,
            },
        ],
    };
}

describe("Paper Doll draft preview contract", () => {
    it("allows an explicit preview only in local development or signed Draft Mode", () => {
        expect(isPaperDollDraftPreviewAllowed({
            requested: true,
            draftModeEnabled: false,
            nodeEnv: "development",
        })).toBe(true);
        expect(isPaperDollDraftPreviewAllowed({
            requested: true,
            draftModeEnabled: true,
            nodeEnv: "production",
        })).toBe(true);
        expect(isPaperDollDraftPreviewAllowed({
            requested: true,
            draftModeEnabled: false,
            nodeEnv: "production",
        })).toBe(false);
        expect(isPaperDollDraftPreviewAllowed({
            requested: false,
            draftModeEnabled: true,
            nodeEnv: "production",
        })).toBe(false);
    });

    it("accepts a structurally valid draft without weakening the public release gate", () => {
        expect(() => assertStorefrontPaperDollFamily(draftFamily())).toThrow("storefrontReady must be true");
        expect(assertPreviewPaperDollFamily(draftFamily())).toMatchObject({
            familyKey: "CYL-9ML",
            storefrontReady: false,
            assetRevision: "1.2.0-capped-dispensers.1",
        });
    });

    it("keeps draft reads server-only; the product page reads plates from the index, never a Sanity draft", () => {
        const serverClientSource = readFileSync("src/sanity/lib/serverClient.ts", "utf8");
        const queriesSource = readFileSync("src/sanity/lib/queries.ts", "utf8");
        const productPageSource = readFileSync("src/app/products/[slug]/page.tsx", "utf8");

        expect(serverClientSource).toContain('import "server-only"');
        expect(serverClientSource).toContain('createServerClient("previewDrafts")');
        expect(serverClientSource).toContain("SANITY_API_READ_TOKEN");
        expect(serverClientSource).not.toContain("NEXT_PUBLIC_SANITY_API_READ_TOKEN");
        expect(queriesSource).toContain("getPreviewPaperDollFamily");
        // The plates a product page shows come from the Convex index (bytes on
        // Blob); the page has no draft path at all, so nothing can leak one.
        expect(productPageSource).toContain('from "@/lib/paper-doll/plates"');
        expect(productPageSource).toContain("loadPlatesForVariants(");
        expect(productPageSource).toContain("platesBySku={platesBySku}");
        expect(productPageSource).not.toContain("isPaperDollDraftPreviewAllowed");
        expect(productPageSource).not.toContain("paperDollPreview");
    });

    it("preflights each draft configuration without throwing or substituting layers", () => {
        const spray = {
            graceSku: "GB-CYL-CLR-9ML-SPR-BLK",
            mode: "spray",
            layerKeys: { body: "CLR", sprayer: "BLK" },
        } as PaperDollConfiguration;
        const rollon = {
            graceSku: "GB-CYL-CLR-9ML-MRL-WHT",
            mode: "rollon",
            layerKeys: { body: "CLR", roller: "MTL-ROLL", cap: "WHT" },
        } as PaperDollConfiguration;
        const family = assertPreviewPaperDollFamily(draftFamily());

        expect(resolvePaperDollLayersResult(family, spray)).toMatchObject({ ok: true });
        expect(resolvePaperDollLayersResult(family, rollon)).toEqual({
            ok: false,
            missing: { slot: "cap", variantKey: "WHT", sku: rollon.graceSku },
        });
    });
});
