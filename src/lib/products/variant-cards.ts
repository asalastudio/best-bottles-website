import { getReleasedCatalogHero } from "./catalog-heroes";

/**
 * Families whose finishes are separate products to a shopper. The catalog shows
 * one card per SKU for these, each with its own hero and link, instead of one
 * card per product group that hides every colour but the first.
 *
 * This is presentation only: product groups, PDP routes and Shopify stay as they are.
 * A card links to its group's PDP with `?sku=` so the page opens on that finish.
 */
export const VARIANT_CARD_FAMILIES: ReadonlySet<string> = new Set(["Atomizer"]);

/** Separator in the synthetic card id; group ids and SKUs never contain it. */
const CARD_ID_SEPARATOR = "~";

type ExpandableGroup = { _id: string; family: string | null; variantCount: number };
type ExpandableVariant = { websiteSku?: string | null; graceSku?: string | null };
type ExpandableResult<G extends ExpandableGroup, V extends ExpandableVariant> = {
    items: G[];
    totalCount: number;
    primarySkus: { groupId: string; websiteSku: string | null; graceSku: string | null }[];
    variantPreviewRows: { groupId: string; variants: V[] }[];
};

export function isVariantCardFamily(family: string | null | undefined): boolean {
    return Boolean(family && VARIANT_CARD_FAMILIES.has(family));
}

export function variantCardId(groupId: string, variant: ExpandableVariant): string {
    return `${groupId}${CARD_ID_SEPARATOR}${variant.websiteSku ?? variant.graceSku ?? ""}`;
}

/**
 * Replace each multi-SKU group of a variant-card family with one single-SKU
 * entry per variant. Every downstream map (hero, name, price, purchase) keys on
 * the entry id, so each card resolves exactly its own SKU.
 *
 * `totalCount` stays a count of products (groups), the unit every sidebar and
 * product-type count uses: adding the extra cards made "Packaging & more" read
 * 36 on the switch and 47 on the page, and the total grew as pages loaded.
 */
export function expandVariantCards<G extends ExpandableGroup, V extends ExpandableVariant, R extends ExpandableResult<G, V>>(result: R): R {
    const rowsByGroup = new Map(result.variantPreviewRows.map((row) => [row.groupId, row.variants]));
    const items: G[] = [];
    const primarySkus: R["primarySkus"] = [];
    const variantPreviewRows: R["variantPreviewRows"] = [];
    let changed = false;

    const expandedGroupIds = new Set<string>();
    for (const group of result.items) {
        const variants = rowsByGroup.get(group._id) ?? [];
        if (!isVariantCardFamily(group.family) || variants.length < 2) {
            items.push(group);
            continue;
        }
        changed = true;
        expandedGroupIds.add(group._id);
        for (const variant of variants) {
            const id = variantCardId(group._id, variant);
            items.push({ ...group, _id: id, variantCount: 1 } as G);
            primarySkus.push({ groupId: id, websiteSku: variant.websiteSku ?? null, graceSku: variant.graceSku ?? null });
            variantPreviewRows.push({ groupId: id, variants: [variant] });
        }
    }
    if (!changed) return result;

    return {
        ...result,
        items,
        primarySkus: [...result.primarySkus.filter((row) => !expandedGroupIds.has(row.groupId)), ...primarySkus],
        variantPreviewRows: [...result.variantPreviewRows.filter((row) => !expandedGroupIds.has(row.groupId)), ...variantPreviewRows],
    };
}

type AtomizerNameVariant = { capColor?: string | null; itemName?: string | null; websiteSku?: string | null };

/**
 * "10 ml Blue Atomizer", "5 ml Silver Atomizer with Stars", "5 ml Black Slim Atomizer".
 * The glass colour field reads "Clear" under every metal shell, so the shell
 * finish (capColor) and the pattern in the item description name the product.
 */
export function atomizerVariantCardName(capacityMl: number | null | undefined, variant: AtomizerNameVariant): string | null {
    const finish = variant.capColor?.trim();
    if (!finish) return null;
    const text = `${variant.itemName ?? ""} ${variant.websiteSku ?? ""}`;
    const slim = /slim/i.test(text);
    const pattern = /stars?\b|star pattern/i.test(text) ? " with Stars" : /dots?\b/i.test(text) ? " with Dots" : "";
    const size = capacityMl != null ? `${capacityMl} ml ` : "";
    return `${size}${finish}${slim ? " Slim" : ""} Atomizer${pattern}`;
}

type StagePlate = { image: string; imageCapOff: string | null; thumb?: string; thumbCapOff?: string | null; heroStage?: boolean };

/**
 * The PDP stage for a variant-card family shows the same released hero as the
 * SKU's catalog card, so the card a shopper clicked and the page agree. Plates
 * stay for SKUs without a released hero. Keys match the plate index: graceSku and websiteSku.
 */
export function withReleasedHeroStages<P extends StagePlate>(
    group: { slug: string; family: string | null } | null | undefined,
    variants: readonly { websiteSku?: string | null; graceSku?: string | null }[],
    plates: Record<string, P>,
): Record<string, P | StagePlate> {
    if (!group || !isVariantCardFamily(group.family)) return plates;
    let next: Record<string, P | StagePlate> | null = null;
    for (const variant of variants) {
        const hero = getReleasedCatalogHero(group.slug, variant.websiteSku);
        if (!hero) continue;
        next ??= { ...plates };
        for (const key of [variant.graceSku, variant.websiteSku]) {
            if (!key) continue;
            next[key] = { ...plates[key], image: hero.url, imageCapOff: null, heroStage: true };
        }
    }
    return next ?? plates;
}
