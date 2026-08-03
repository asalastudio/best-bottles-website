import type { StorefrontPaperDollFamily, StorefrontPaperDollLayer } from "./sanity";
import type { PaperDollConfiguration, PaperDollLayerKeys } from "./types";

export function resolvePaperDollLayers(
    family: StorefrontPaperDollFamily,
    configuration: PaperDollConfiguration,
): StorefrontPaperDollLayer[] {
    const order = configuration.mode === "rollon"
        ? family.layerOrderRollon
        : configuration.mode === "spray"
            ? family.layerOrderSpray
            : family.layerOrderLotion;

    return order.map((slot) => {
        const variantKey = configuration.layerKeys[slot as keyof PaperDollLayerKeys];
        const layer = family.layerAssets.find((asset) => asset.slot === slot && asset.variantKey === variantKey);
        if (!variantKey || !layer) {
            throw new Error(`Missing Paper Doll layer ${slot}:${variantKey ?? "?"} for ${configuration.graceSku}`);
        }
        return layer;
    });
}
