import { getProductHero, getReleasedCatalogHero } from "@/lib/products/catalog-heroes";
import { isLegacyBestBottlesImageUrl } from "@/lib/productVariantIntegrity";
import bodyMedia from "@/lib/bottle-builder/bodies.generated.json";

type FallbackVariant = {
    websiteSku?: string | null;
    imageUrl?: string | null;
    family?: string | null;
    capacityMl?: number | null;
    color?: string | null;
    neckThreadSize?: string | null;
};

/** A transparent, reviewed uncapped bottle; never substitute a different mould or glass. */
export function reviewedFallbackBody(groupSlug: string, variant: FallbackVariant | null): string | null {
    if (!variant?.family || variant.capacityMl == null || !variant.color || !variant.neckThreadSize) return null;
    const media = bodyMedia as Record<string, { url: string }>;
    const marker = `-${variant.capacityMl}ml-`;
    const profile = groupSlug.includes(marker) ? groupSlug.split(marker)[0] : null;
    return (profile ? media[`${profile}|${variant.capacityMl}|${variant.color}|${variant.neckThreadSize}`]?.url : null)
        ?? media[`${variant.family}|${variant.capacityMl}|${variant.color}|${variant.neckThreadSize}`]?.url
        ?? null;
}

/** Exact SKU images only. Failed CDN URLs can fall through to another exact source. */
export function pdpFallbackMedia(input: {
    groupSlug: string;
    variant: FallbackVariant | null;
    plateImageUrl: string | null;
}): { images: string[]; bodyImageUrl: string | null } {
    const { variant } = input;
    if (!variant) return { images: [], bodyImageUrl: null };
    const images = [
        getReleasedCatalogHero(input.groupSlug, variant.websiteSku)?.url,
        input.plateImageUrl,
        variant.imageUrl,
        getProductHero(variant.websiteSku)?.url,
    ].filter((url): url is string => Boolean(url && !/cdn\.sanity\.io/.test(url) && !isLegacyBestBottlesImageUrl(url)));
    return { images: [...new Set(images)], bodyImageUrl: reviewedFallbackBody(input.groupSlug, variant) };
}
