import { stripLocalePrefix } from "@/i18n/paths";

export const CART_SHOPPING_RETURN_KEY = "bb-cart-shopping-return";

// Keep this list aligned with paramsToFilters, PDP variant picks and MatrixPage.
// Free-text search and nested `from` URLs are deliberately not persisted: they
// can contain personal data. Fragments and unknown parameters are never saved.
const CATALOG_PARAMS = new Set([
    "shop", "category", "collection", "applicators", "roller", "families", "family",
    "colors", "capacities", "threads", "componentType", "priceMin", "priceMax", "sort", "view", "scope",
]);
const PRODUCT_PARAMS = new Set(["sku", "cap", "roller", "applicator", "qty"]);
const BUILDER_PARAMS = new Set(["family", "shop"]);
const MULTI_VALUE_PARAMS = new Set(["applicators", "roller", "families", "family", "colors", "capacities", "threads"]);

function shoppingParams(path: string, params: URLSearchParams): string {
    const allowed = path.startsWith("/products/") ? PRODUCT_PARAMS
        : path === "/matrix" ? BUILDER_PARAMS
            : path === "/catalog" || path.startsWith("/catalog/") ? CATALOG_PARAMS : new Set<string>();
    const safe = new URLSearchParams();
    for (const [key, value] of params) {
        // Structured catalog labels/SKUs only: no emails, URLs, encoded payloads
        // or controls, including under an otherwise recognized parameter name.
        if (!allowed.has(key) || !value || value.length > 160 || !/^[a-zA-Z0-9 _.,()\-]+$/.test(value)) continue;
        if (key === "sku" && !/^[a-zA-Z0-9_.-]{1,80}$/.test(value)) continue;
        if (key === "qty" && !/^[1-9]\d{0,3}$/.test(value)) continue;
        if ((key === "priceMin" || key === "priceMax") && !/^\d{1,6}(?:\.\d{1,2})?$/.test(value)) continue;
        if (key === "view" && value !== "line" && value !== "visual") continue;
        if (key === "scope" && value !== "all") continue;
        if (safe.has(key) && !MULTI_VALUE_PARAMS.has(key)) continue;
        safe.append(key, value);
    }
    const query = safe.toString();
    return query ? `?${query}` : "";
}

/** Only storefront browsing routes can become a cart return destination. */
export function validateShoppingReturn(value: string | null | undefined): string | null {
    if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return null;
    try {
        // Reject encoded separators/control characters too, before URL normalization.
        const decoded = decodeURIComponent(value.split(/[?#]/)[0]);
        if (/[\\\u0000-\u0020\u007f]/.test(decoded) || decoded.includes("//") || decoded.split("/").some(segment => segment === "." || segment === "..")) return null;
        const url = new URL(value, "https://cart-return.invalid");
        if (url.origin !== "https://cart-return.invalid") return null;
        const path = stripLocalePrefix(url.pathname).replace(/\/$/, "");
        if (!/^(?:\/catalog(?:\/(?:application\/)?[a-zA-Z0-9_-]+)?|\/matrix|\/bottle-families|\/collections(?:\/[a-zA-Z0-9_-]+)?|\/products\/[a-zA-Z0-9_-]+)$/.test(path)) return null;
        return `${url.pathname}${shoppingParams(path, url.searchParams)}`;
    } catch {
        return null;
    }
}

export function isBuilderShoppingPath(value: string): boolean {
    const safePath = validateShoppingReturn(value);
    return safePath !== null && stripLocalePrefix(safePath.split(/[?#]/)[0]).replace(/\/$/, "") === "/matrix";
}
