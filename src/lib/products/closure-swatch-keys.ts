/**
 * The guided page draws a closure's finish pills from the catalogue (the
 * variant's `capColor`: "Pink with Dots", "Matte Copper") and their
 * photographs from the per-neck component families, whose rows are keyed by
 * the finish token spelt in the component's website SKU ("Pink", "Copper").
 * The two vocabularies agree on tokens, not on names — so the join is made
 * on the token the VARIANT's own website SKU spells, never on the label.
 *
 * Pure so it can be unit-tested with real SKUs; Convex and React never see it.
 */
import { getFinishFromWebsiteSku } from "@/lib/paper-doll/tokens.generated";

export type SwatchKeyVariant = {
    websiteSku?: string | null;
    graceSku?: string | null;
};

/** Token-vocabulary swatch names a variant's SKUs spell, most specific first. */
export function photoKeysForVariant(variant: SwatchKeyVariant): string[] {
    const keys: string[] = [];
    const fromWebsite = getFinishFromWebsiteSku(variant.websiteSku)?.swatchName;
    if (fromWebsite) keys.push(fromWebsite);
    return keys;
}

/**
 * For each catalogue pill name, the token swatch names its variants spell —
 * `{ "Pink with Dots": ["Pink"], "Matte Copper": ["Copper"], … }`. A name whose
 * variants spell nothing recognisable maps to [] and the caller falls back to
 * the colour dot.
 */
export function buildCapOptionPhotoKeys<V extends SwatchKeyVariant>(
    options: readonly string[],
    variants: readonly V[],
    swatchNameOf: (variant: V) => string,
): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const name of options) {
        const keys = new Set<string>();
        for (const variant of variants) {
            if (swatchNameOf(variant) !== name) continue;
            for (const key of photoKeysForVariant(variant)) keys.add(key);
        }
        out[name] = Array.from(keys);
    }
    return out;
}

/** The photograph for a pill: the pill's own name first, then the token keys its SKUs spell. */
export function resolveCapOptionPhoto(
    name: string,
    thumbBySwatch: ReadonlyMap<string, string>,
    photoKeys: Readonly<Record<string, readonly string[]>> | undefined,
): string | undefined {
    const direct = thumbBySwatch.get(name);
    if (direct) return direct;
    for (const key of photoKeys?.[name] ?? []) {
        const hit = thumbBySwatch.get(key);
        if (hit) return hit;
    }
    return undefined;
}
