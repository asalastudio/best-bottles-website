import { stripLocalePrefix } from "@/i18n/paths";

export const CART_SHOPPING_RETURN_KEY = "bb-cart-shopping-return";

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
        if (!/^(?:\/catalog|\/matrix|\/bottle-families|\/collections(?:\/[a-zA-Z0-9_-]+)?|\/products\/[a-zA-Z0-9_-]+)$/.test(path)) return null;
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return null;
    }
}

export function isBuilderShoppingPath(value: string): boolean {
    const safePath = validateShoppingReturn(value);
    return safePath !== null && stripLocalePrefix(safePath.split(/[?#]/)[0]).replace(/\/$/, "") === "/matrix";
}
