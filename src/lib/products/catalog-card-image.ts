/**
 * The rendered width of a catalog card image, for next/image `sizes`.
 *
 * CatalogProductGrid is one column below 640px (16px page padding each side),
 * two columns from 640px (24px padding), and three columns from 1024px beside
 * the 240px filter sidebar (32px gap, 40px padding, page capped at 1720px).
 * So a three-column card is (100vw - 352px) / 3 wide, at most 456px.
 */
export const CATALOG_CARD_IMAGE_SIZES =
    "(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) calc(50vw - 24px), (max-width: 1719px) calc((100vw - 352px) / 3), 456px";

/** Cards in the first row on desktop (and the first one or two on phones) load eagerly; the rest stay lazy. */
export const CATALOG_EAGER_CARD_COUNT = 3;

export type CatalogCardImageLoading = { preload?: boolean; loading?: "eager"; fetchPriority?: "high" };

/**
 * Only the first card is the likely LCP element, so only it is preloaded with
 * high fetch priority; the rest of the first row loads eagerly at normal priority.
 */
export function catalogCardImageLoading(index: number | undefined): CatalogCardImageLoading {
    if (index === undefined) return {};
    if (index === 0) return { preload: true, fetchPriority: "high" };
    return index < CATALOG_EAGER_CARD_COUNT ? { loading: "eager" } : {};
}
