export type CheckoutCandidate = {
    graceSku: string;
    checkoutEligible?: boolean;
    shopifyVariantId?: string | null;
};

export function isCheckoutReady(item: CheckoutCandidate): boolean {
    if (item.shopifyVariantId) return true;
    return item.checkoutEligible === true;
}

export function splitCheckoutItems<T extends CheckoutCandidate>(items: T[]) {
    const checkoutReadyItems = items.filter(isCheckoutReady);
    const quoteOnlyItems = items.filter((item) => !isCheckoutReady(item));
    return { checkoutReadyItems, quoteOnlyItems };
}

export function removeBlockedCheckoutItems<T extends CheckoutCandidate>(
    items: T[],
    blockedSkus: string[],
): T[] {
    const blocked = new Set(blockedSkus.filter(Boolean));
    if (blocked.size === 0) return items;
    return items.filter((item) => !blocked.has(item.graceSku));
}

export function formatSkuList(skus: string[]): string {
    if (skus.length === 0) return "";
    if (skus.length <= 4) return skus.join(", ");
    return `${skus.slice(0, 4).join(", ")} and ${skus.length - 4} more`;
}

export function quoteOnlyCartMessage(skus: string[]): string {
    return `These SKU${skus.length === 1 ? "" : "s"} need a quote before checkout: ${formatSkuList(skus)}. Use Request Quote and the Best Bottles team can confirm availability, pricing, and case quantities.`;
}

export function checkoutUnavailableMessage(): string {
    return "Online checkout is temporarily unavailable. Use Request Quote and the Best Bottles team can confirm the order manually.";
}

export function unmatchedCheckoutMessage(skus: string[]): string {
    return `Shopify could not match ${skus.length === 1 ? "this SKU" : "these SKUs"} for online checkout: ${formatSkuList(skus)}. Request a quote for those items so the team can confirm the correct Shopify variant.`;
}

export function unavailableCheckoutMessage(skus: string[]): string {
    return `Shopify marked ${skus.length === 1 ? "this SKU" : "these SKUs"} unavailable for online checkout: ${formatSkuList(skus)}. Request a quote and the team can confirm availability or suggest a substitute.`;
}
