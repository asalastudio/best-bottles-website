import { isLegacyBestBottlesImageUrl } from "@/lib/productVariantIntegrity";
import { getCatalogHero } from "@/lib/products/catalog-heroes";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import { getReconciledLocalSkuImage } from "@/lib/products/reconciled-sku-images";
import {
    resolveCatalogGroupSku,
    catalogGroupSkuLabel,
    type CatalogSearchGroup,
    type CatalogSearchResultShape,
} from "@/lib/catalogSearchFallback";

/**
 * One row of the catalogue's line-item view.
 *
 * The storefront's `?view=line` table and the portals read the same rows from
 * this module rather than each deriving names and imagery their own way. They
 * had drifted before — a product could carry one name on the shop and another
 * on the order pad, which makes a purchase order an argument rather than a
 * document.
 */
export type CatalogLineItem = {
    groupId: string;
    slug: string;
    /** What a customer should be shown; not the raw `displayName` column. */
    displayName: string;
    category: string;
    family: string | null;
    /** The label to print — website SKU where there is one, else Grace's. */
    skuLabel: string;
    /** The SKU an order pad should actually order. Null when there is none. */
    orderableSku: string | null;
    graceSku: string | null;
    capacity: string | null;
    color: string | null;
    neckThreadSize: string | null;
    variantCount: number;
    priceFrom: number | null;
    thumbnailUrl: string | null;
};


/**
 * Sanity and legacy bestbottles.com URLs point at art that no longer matches
 * the product, so an image from either source is worse than no image at all.
 */
export function isBlockedProductImageUrl(value: string | null | undefined): boolean {
    if (!value) return false;
    if (isLegacyBestBottlesImageUrl(value)) return true;
    try {
        return new URL(value).hostname === "cdn.sanity.io";
    } catch {
        return value.includes("cdn.sanity.io/") || value.includes("www.bestbottles.com/images/store/");
    }
}

export function usableProductImageUrl(value: string | null | undefined): string | null {
    const url = value?.trim();
    if (!url || isBlockedProductImageUrl(url)) return null;
    return url;
}

/** The fields the thumbnail chain reads; every search row and card source carries them. */
export type CatalogThumbnailVariant = {
    websiteSku?: string | null;
    graceSku?: string | null;
    imageUrl?: string | null;
    imageUrlCapOff?: string | null;
    plateThumbUrl?: string | null;
};

/**
 * One variant's own image, in the order the visual card falls back: its
 * paper-doll plate, then a reconciled local image, then a usable Convex URL.
 * Never a blocked legacy or Sanity URL.
 */
export function getCatalogVariantThumbnail(variant: CatalogThumbnailVariant | null | undefined): string | null {
    if (!variant) return null;
    return variant.plateThumbUrl?.trim()
        || getReconciledLocalSkuImage(variant.websiteSku)
        || usableProductImageUrl(variant.imageUrl)
        || usableProductImageUrl(variant.imageUrlCapOff)
        || null;
}

/**
 * The image a line-item row shows for a group, resolved the way the visual
 * card resolves its own: the group's approved hero first (the same assembly
 * the card pictures), else the primary variant's plate, reconciled local
 * image or usable Convex URL, else any sibling's, else the group's own hero URL.
 */
export function resolveCatalogLineThumbnail(
    group: { slug: string; heroImageUrl?: string | null },
    variants: readonly CatalogThumbnailVariant[],
    primarySku: string | null | undefined,
): string | null {
    const hero = getCatalogHero(group.slug, variants, primarySku);
    if (hero) return hero.url;
    // The row is named after the primary SKU's variant, but a sibling's photo
    // still beats an empty tile when that variant has no usable art of its own.
    const named = pickRepresentativeVariant(variants, primarySku ?? null);
    return getCatalogVariantThumbnail(named)
        ?? variants.map(getCatalogVariantThumbnail).find((url): url is string => Boolean(url))
        ?? usableProductImageUrl(group.heroImageUrl);
}

/**
 * Prefer the variant the primary SKU names, so the thumbnail is of the thing
 * the row is actually selling. Fall back to any variant that has usable art
 * before giving up — a family photo beats an empty tile.
 */
function pickRepresentativeVariant<T extends CatalogThumbnailVariant>(
    variants: readonly T[],
    primarySku: string | null,
): T | null {
    const named = primarySku
        ? variants.find((v) => v.websiteSku === primarySku || v.graceSku === primarySku)
        : undefined;
    if (named && getCatalogVariantThumbnail(named)) return named;
    return named ?? variants.find((v) => getCatalogVariantThumbnail(v)) ?? variants[0] ?? null;
}

export function buildCatalogLineItem(
    group: CatalogSearchGroup,
    result: Pick<CatalogSearchResultShape, "primarySkus" | "variantPreviewRows">,
): CatalogLineItem {
    const sku = resolveCatalogGroupSku(group._id, result.primarySkus ?? [], result.variantPreviewRows ?? []);
    const variants = result.variantPreviewRows?.find((row) => row.groupId === group._id)?.variants ?? [];
    const variant = pickRepresentativeVariant(variants, sku.websiteSku ?? sku.graceSku);

    return {
        groupId: group._id,
        slug: group.slug,
        displayName: getCustomerFacingProductName({
            group,
            variant,
            fallbackName: group.displayName,
        }).displayName,
        category: group.category,
        family: group.family,
        skuLabel: catalogGroupSkuLabel(sku),
        orderableSku: sku.websiteSku ?? sku.graceSku ?? null,
        graceSku: sku.graceSku,
        // "0 ml (0 oz)" is how an unset capacity reaches us; printing it would
        // assert the bottle holds nothing.
        capacity: group.capacity && group.capacity !== "0 ml (0 oz)" ? group.capacity : null,
        color: group.color,
        neckThreadSize: group.neckThreadSize,
        variantCount: group.variantCount,
        priceFrom: group.priceRangeMin,
        thumbnailUrl: resolveCatalogLineThumbnail(group, variants, sku.websiteSku ?? sku.graceSku),
    };
}

export function buildCatalogLineItems(result: CatalogSearchResultShape): CatalogLineItem[] {
    return result.items.map((group) => buildCatalogLineItem(group, result));
}
