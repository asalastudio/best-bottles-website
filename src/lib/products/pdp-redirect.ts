import { getLegacyProductRouteOverride } from "./legacy-product-route-overrides";

export type ProductPageSearchParams = Record<string, string | string[] | undefined>;

function searchParamsToString(input: ProductPageSearchParams): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
        if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
        else if (value != null) params.set(key, value);
    }
    return params.toString();
}

/** Returns only a legacy alias target; canonical slugs deliberately return null. */
export function resolveProductPageRedirectTarget(slug: string, searchParams: ProductPageSearchParams): string | null {
    const canonicalSlug = getLegacyProductRouteOverride(slug);
    if (!canonicalSlug) return null;
    const query = searchParamsToString(searchParams);
    return `/products/${canonicalSlug}${query ? `?${query}` : ""}`;
}
