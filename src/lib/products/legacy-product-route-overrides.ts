const LEGACY_PRODUCT_ROUTE_OVERRIDES: Record<string, string> = {
    "diva-46ml-clear-18-415": "diva-46ml-clear-18-415-perfumespray",
    "cylinder-5ml-clear-13-415-capclosure": "cylinder-5ml-clear-13-415",
    "cylinder-5ml-white-13-415": "cylinder-5ml-clear-13-415",
    "cylinder-9ml-clear": "cylinder-9ml-clear-17-415-rollon",
    "cylinder-9ml-clear-18-400": "vial-9ml-clear-18-400",
    "cylinder-9ml-clear-18-400-glasswand": "vial-9ml-clear-18-400-glasswand",
    "cylinder-9ml-17-415": "cylinder-9ml-clear-17-415-rollon",
    "cylinder-9ml-white-13-415": "cylinder-9ml-clear-13-415",
    "cylinder-9ml-white-17-415-rollon": "cylinder-9ml-clear-17-415-rollon",
};

export function isLegacyProductRouteAlias(slug: string): boolean {
    return Object.prototype.hasOwnProperty.call(LEGACY_PRODUCT_ROUTE_OVERRIDES, slug);
}

export function getLegacyProductRouteOverride(slug: string): string | null {
    return LEGACY_PRODUCT_ROUTE_OVERRIDES[slug] ?? null;
}

export function getCanonicalProductSlug(slug: string): string {
    return getLegacyProductRouteOverride(slug) ?? slug;
}
