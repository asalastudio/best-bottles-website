/**
 * Item description resolver for the product page (server side only: the
 * curated JSON is 1 MB and must never reach a client bundle).
 *
 * Order of truth:
 *   1. data/descriptions/pdp/item-descriptions.json, the reviewed copy the
 *      generator wrote from the legacy site plus the catalogue (by website
 *      SKU, then by Grace SKU);
 *   2. the same composer run at request time from the variant's own fields,
 *      for SKUs created after the JSON was generated;
 *   3. the variant's legacy `itemDescription`, framing stripped, complete
 *      sentences only.
 */
import curated from "../../../../data/descriptions/pdp/item-descriptions.json";
import profiles from "../../../../data/descriptions/pdp/family-profiles.json";
import { cleanedLegacyText, composeItemDescription, type ComposeInput, type FamilyProfile } from "./compose";
import { resolveItemType } from "./item-type";

type CuratedEntry = {
    websiteSku: string;
    graceSku: string;
    groupSlug: string;
    itemType: string;
    description: string;
    legacyUrl: string | null;
};

type CuratedFile = {
    generatedAt: string;
    byWebsiteSku: Record<string, CuratedEntry>;
    graceToWebsite: Record<string, string>;
};

type ProfilesFile = { profiles: Record<string, FamilyProfile> };

const CURATED = curated as unknown as CuratedFile;
const PROFILES = (profiles as unknown as ProfilesFile).profiles;

export type ItemDescriptionSource = "curated" | "composed" | "legacy";

export type ItemDescription = {
    description: string;
    itemType: string;
    source: ItemDescriptionSource;
    /** The legacy bestbottles.com page the facts were read from, when one exists. */
    legacyUrl: string | null;
};

export type DescribableVariant = ComposeInput & {
    websiteSku?: string | null;
    graceSku?: string | null;
    itemDescription?: string | null;
};

export function curatedItemDescription(variant: { websiteSku?: string | null; graceSku?: string | null }): CuratedEntry | null {
    const website = variant.websiteSku?.trim();
    if (website && CURATED.byWebsiteSku[website]) return CURATED.byWebsiteSku[website];
    const grace = variant.graceSku?.trim();
    if (grace) {
        const mapped = CURATED.graceToWebsite[grace];
        if (mapped && CURATED.byWebsiteSku[mapped]) return CURATED.byWebsiteSku[mapped];
    }
    return null;
}

export function familyProfileFor(variant: Pick<ComposeInput, "family" | "category" | "capacityMl" | "neckThreadSize">): FamilyProfile | null {
    const key = `${variant.family ?? "null"}|${variant.category ?? "Glass Bottle"}|${variant.capacityMl ?? "null"}|${variant.neckThreadSize ?? "null"}`;
    return PROFILES[key] ?? null;
}

export function resolveItemDescription(variant: DescribableVariant): ItemDescription | null {
    const entry = curatedItemDescription(variant);
    if (entry) {
        return { description: entry.description, itemType: entry.itemType, source: "curated", legacyUrl: entry.legacyUrl };
    }
    const itemType = resolveItemType({ category: variant.category, family: variant.family, applicator: variant.applicator });
    const composed = composeItemDescription({
        ...variant,
        legacyDescription: variant.legacyDescription ?? variant.itemDescription ?? null,
        familyProfile: variant.familyProfile ?? familyProfileFor(variant),
    });
    if (composed) return { description: composed.text, itemType, source: "composed", legacyUrl: null };
    const legacy = cleanedLegacyText(variant.itemDescription);
    if (legacy) return { description: legacy, itemType, source: "legacy", legacyUrl: null };
    return null;
}

/** One lookup per variant of a product group, keyed by website SKU (Grace SKU when the website SKU is blank). */
export function resolveItemDescriptions(variants: readonly DescribableVariant[]): Record<string, ItemDescription> {
    const out: Record<string, ItemDescription> = {};
    for (const variant of variants) {
        const key = variant.websiteSku?.trim() || variant.graceSku?.trim();
        if (!key) continue;
        const resolved = resolveItemDescription(variant);
        if (resolved) out[key] = resolved;
    }
    return out;
}

export function curatedDescriptionCount(): number {
    return Object.keys(CURATED.byWebsiteSku).length;
}
