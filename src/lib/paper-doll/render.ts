import type { RenderablePaperDollFamily, StorefrontPaperDollLayer } from "./sanity";
import type { PaperDollConfiguration, PaperDollLayerKeys } from "./types";

export type PaperDollLayerResolution =
    | { ok: true; layers: StorefrontPaperDollLayer[] }
    | {
          ok: false;
          missing: {
              slot: string;
              variantKey: string | null;
              sku: string;
          };
      };

export function resolvePaperDollLayersResult(
    family: RenderablePaperDollFamily,
    configuration: PaperDollConfiguration,
): PaperDollLayerResolution {
    const order = configuration.mode === "rollon"
        ? family.layerOrderRollon
        : configuration.mode === "spray"
            ? family.layerOrderSpray
            : family.layerOrderLotion;

    const layers: StorefrontPaperDollLayer[] = [];
    for (const slot of order) {
        const variantKey = configuration.layerKeys[slot as keyof PaperDollLayerKeys] ?? null;
        const layer = variantKey
            ? family.layerAssets.find((asset) => asset.slot === slot && asset.variantKey === variantKey)
            : undefined;
        if (!variantKey || !layer) {
            return {
                ok: false,
                missing: { slot, variantKey, sku: configuration.graceSku },
            };
        }
        layers.push(layer);
    }

    return { ok: true, layers };
}

export function resolvePaperDollLayers(
    family: RenderablePaperDollFamily,
    configuration: PaperDollConfiguration,
): StorefrontPaperDollLayer[] {
    const result = resolvePaperDollLayersResult(family, configuration);
    if (!result.ok) {
        throw new Error(
            `Missing Paper Doll layer ${result.missing.slot}:${result.missing.variantKey ?? "?"} for ${result.missing.sku}`,
        );
    }
    return result.layers;
}
