import { describe, expect, it } from "vitest";
import {
    resolveGracePaperDollSelection,
    type GracePaperDollSelectionRequest,
} from "../src/lib/grace/paperDollController";
import type { PaperDollConfiguration, PaperDollMode } from "../src/lib/paper-doll/types";

function configuration({
    sku,
    glass,
    mode,
    roller,
    finish,
}: {
    sku: string;
    glass: string;
    mode: PaperDollMode;
    roller?: "Metal" | "Plastic";
    finish: string;
}): PaperDollConfiguration {
    return {
        graceSku: sku,
        websiteSku: sku,
        productGroupSlug: "9ml-cylinder-17-415",
        familyKey: "CYL-9ML",
        family: "Cylinder",
        capacityMl: 9,
        neckThreadSize: "17-415",
        glassLabel: glass,
        glassKey: glass.toLowerCase(),
        applicatorLabel: mode === "rollon" ? `${roller} Roller` : mode === "spray" ? "Fine Mist Spray" : "Lotion Pump",
        applicatorKey: mode === "rollon" ? `${roller?.toLowerCase()}-roller` : mode,
        mode,
        finishLabel: finish,
        layerKeys: { body: glass.toLowerCase() },
        price1pc: 1,
        priceTiers: [],
        stockStatus: "In Stock",
        shopifyVariantId: null,
        shopifySellable: false,
    };
}

const configurations = [
    configuration({ sku: "CLEAR-METAL-GOLD", glass: "Clear", mode: "rollon", roller: "Metal", finish: "Gold" }),
    configuration({ sku: "AMBER-METAL-GOLD", glass: "Amber", mode: "rollon", roller: "Metal", finish: "Gold" }),
    configuration({ sku: "AMBER-PLASTIC-WHITE", glass: "Amber", mode: "rollon", roller: "Plastic", finish: "White" }),
    configuration({ sku: "AMBER-SPRAY-SILVER", glass: "Amber", mode: "spray", finish: "Silver" }),
];

describe("Grace Paper Doll controller", () => {
    it("resolves an exact compatible layered selection", () => {
        const request: GracePaperDollSelectionRequest = {
            glass: "Amber",
            deliverySystem: "rollon",
            rollerMaterial: "Plastic",
            finish: "White",
            configurationSku: null,
            view: "build",
        };
        const result = resolveGracePaperDollSelection(configurations, configurations[0], request);

        expect(result.ok).toBe(true);
        if (result.ok) expect(result.configuration.graceSku).toBe("AMBER-PLASTIC-WHITE");
    });

    it("uses an exact SKU only when it belongs to the 9 mL 17-415 configuration set", () => {
        const result = resolveGracePaperDollSelection(configurations, configurations[0], {
            glass: null,
            deliverySystem: null,
            rollerMaterial: null,
            finish: null,
            configurationSku: "NOT-IN-17-415-SET",
            view: "build",
        });

        expect(result).toEqual({ ok: false, reason: "That configuration is not available for this 9 mL 17-415 bottle." });
    });

    it("fails closed instead of showing a partially compatible combination", () => {
        const result = resolveGracePaperDollSelection(configurations, configurations[0], {
            glass: "Clear",
            deliverySystem: "spray",
            rollerMaterial: null,
            finish: "Silver",
            configurationSku: null,
            view: "build",
        });

        expect(result.ok).toBe(false);
    });
});
