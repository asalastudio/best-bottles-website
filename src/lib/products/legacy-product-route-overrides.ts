const LEGACY_PRODUCT_ROUTE_OVERRIDES: Record<string, string> = {
    "diva-46ml-clear-18-415": "diva-46ml-clear-18-415-perfumespray",
};

export function getLegacyProductRouteOverride(slug: string): string | null {
    return LEGACY_PRODUCT_ROUTE_OVERRIDES[slug] ?? null;
}

export function getCanonicalProductSlug(slug: string): string {
    return getLegacyProductRouteOverride(slug) ?? slug;
}
