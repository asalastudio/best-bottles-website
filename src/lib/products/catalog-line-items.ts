import { isLegacyBestBottlesImageUrl } from "@/lib/productVariantIntegrity";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import {
    resolveCatalogGroupSku,
    catalogGroupSkuLabel,
    type CatalogSearchGroup,
    type CatalogSearchResultShape,
    type CatalogSearchVariantPreviewRow,
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

type VariantPreview = CatalogSearchVariantPreviewRow["variants"][number];

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

export function getCatalogVariantThumbnail(variant: VariantPreview | null | undefined): string | null {
    if (!variant) return null;
    return usableProductImageUrl(variant.imageUrl) ?? usableProductImageUrl(variant.imageUrlCapOff) ?? null;
}

/**
 * Prefer the variant the primary SKU names, so the thumbnail is of the thing
 * the row is actually selling. Fall back to any variant that has usable art
 * before giving up — a family photo beats an empty tile.
 */
function pickRepresentativeVariant(
    variants: VariantPreview[],
    primarySku: string | null,
): VariantPreview | null {
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
        thumbnailUrl: getCatalogVariantThumbnail(variant) ?? usableProductImageUrl(group.heroImageUrl),
    };
}

export function buildCatalogLineItems(result: CatalogSearchResultShape): CatalogLineItem[] {
    return result.items.map((group) => buildCatalogLineItem(group, result));
}
