type ProductGroupLike = {
    color?: string | null;
};

type ProductVariantLike = {
    websiteSku?: string | null;
    itemName?: string | null;
    itemDescription?: string | null;
    productUrl?: string | null;
};

function normalized(value: string | null | undefined): string {
    return (value ?? "").toLowerCase();
}

function hasAmberSignal(variant: ProductVariantLike): boolean {
    const sku = normalized(variant.websiteSku);
    const url = normalized(variant.productUrl);
    const name = normalized(`${variant.itemName ?? ""} ${variant.itemDescription ?? ""}`);
    return /\bamb\b|amb\d|amb[0-9a-z]*|amber/.test(sku) ||
        url.includes("amber-glass") ||
        /\bamber\s+glass\b/.test(name);
}

function hasClearBottleSignal(variant: ProductVariantLike): boolean {
    const sku = normalized(variant.websiteSku);
    const url = normalized(variant.productUrl);
    const name = normalized(`${variant.itemName ?? ""} ${variant.itemDescription ?? ""}`);
    return /\bclr\b|clr\d|clr[0-9a-z]*|clear/.test(sku) ||
        url.includes("clear-glass") ||
        /\bclear\s+glass\b/.test(name);
}

export function variantContradictsProductGroupColor(
    group: ProductGroupLike | null | undefined,
    variant: ProductVariantLike,
): boolean {
    const groupColor = normalized(group?.color);
    if (!groupColor) return false;

    if (groupColor === "clear") return hasAmberSignal(variant);
    if (groupColor === "amber") return hasClearBottleSignal(variant);

    return false;
}

export function filterVariantsForProductGroup<T extends ProductVariantLike>(
    group: ProductGroupLike | null | undefined,
    variants: T[],
): T[] {
    return variants.filter((variant) => !variantContradictsProductGroupColor(group, variant));
}

export function isLegacyBestBottlesImageUrl(value: string | null | undefined): boolean {
    if (!value) return false;
    try {
        const url = new URL(value);
        return url.hostname === "www.bestbottles.com" && url.pathname.startsWith("/images/store/");
    } catch {
        return value.includes("www.bestbottles.com/images/store/");
    }
}
