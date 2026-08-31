import type {
    PaperDollAssemblyMapping,
    RenderablePaperDollFamily,
    StorefrontPaperDollLayer,
} from "./sanity";
import type { PaperDollConfiguration, PaperDollLayerKeys, PaperDollMode } from "./types";

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

function layerKeysFromMapping(
    mapping: PaperDollAssemblyMapping,
    mode: PaperDollMode,
): PaperDollLayerKeys | null {
    const body = mapping.bodyVariantKey;
    if (!body || !mapping.fitmentVariantKey) return null;
    if (mode === "rollon") {
        if (!mapping.closureVariantKey) return null;
        return { body, roller: mapping.fitmentVariantKey, cap: mapping.closureVariantKey };
    }
    if (mode === "spray") return { body, sprayer: mapping.fitmentVariantKey };
    return { body, pump: mapping.fitmentVariantKey };
}

/**
 * A Madison release is self-describing: its assemblyMappings carry the exact
 * variant keys for every catalog SKU. Prefer that authority over the
 * configurator's derived legacy keys; fall back to the legacy keys only for
 * families that ship no mappings (the pre-release family document).
 */
export function resolveConfigurationLayerKeys(
    family: RenderablePaperDollFamily,
    configuration: PaperDollConfiguration,
): PaperDollLayerKeys {
    const mappings = family.assemblyMappings;
    if (mappings && mappings.length > 0) {
        const mapping = mappings.find((entry) => entry.graceSku === configuration.graceSku)
            ?? mappings.find((entry) => Boolean(entry.websiteSku) && entry.websiteSku === configuration.websiteSku);
        const mapped = mapping ? layerKeysFromMapping(mapping, configuration.mode) : null;
        if (mapped) return mapped;
    }
    return configuration.layerKeys;
}

export function resolvePaperDollLayersResult(
    family: RenderablePaperDollFamily,
    configuration: PaperDollConfiguration,
): PaperDollLayerResolution {
    const order = configuration.mode === "rollon"
        ? family.layerOrderRollon
        : configuration.mode === "spray"
            ? family.layerOrderSpray
            : family.layerOrderLotion;

    const layerKeys = resolveConfigurationLayerKeys(family, configuration);
    const layers: StorefrontPaperDollLayer[] = [];
    for (const slot of order) {
        const variantKey = layerKeys[slot as keyof PaperDollLayerKeys] ?? null;
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
