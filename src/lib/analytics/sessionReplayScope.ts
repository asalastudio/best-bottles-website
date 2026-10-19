/** Reviewed public routes only. New routes remain private until reviewed here. */
const PUBLIC_ROUTES = [
    /^\/$/,
    /^\/(?:catalog|collections|bottle-families|matrix|about|blog|resources|privacy|terms|shipping-returns)\/?$/,
    /^\/catalog\/[a-z0-9-]+\/?$/,
    /^\/catalog\/application\/[a-z0-9-]+\/?$/,
    /^\/(?:products|blog)\/[a-z0-9-]+\/?$/,
    /^\/collections\/boston-round-30ml\/?$/,
];

// PostHog checks full URLs at the DOM event, before collecting element properties.
export const PUBLIC_CAPTURE_URL_PATTERNS = PUBLIC_ROUTES.map((route) => new RegExp(
    `^https?://[^/?#]+(?:/es)?${route.source.slice(1, -1)}(?:[?#].*)?$`,
));
PUBLIC_CAPTURE_URL_PATTERNS.push(/^https?:\/\/[^/?#]+\/es(?:[?#].*)?$/);

// Retained as documentation for callers; this is NOT the capture policy.
export const NEVER_RECORD_PREFIXES = [
    "/portal", "/team", "/executive", "/studio", "/sign-in", "/sign-up", "/grace-workspace",
    "/account", "/auth", "/cart", "/contact", "/request-quote", "/request-sample",
] as const;

function normalizeCapturePath(value: string | null | undefined): string | null {
    if (typeof value !== "string" || !value) return null;
    // Reject ambiguous/encoded paths before URL normalisation resolves dot segments.
    if (/[\\%\s]/.test(value.split(/[?#]/, 1)[0]) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(value)) return null;
    let path: string;
    try {
        if (/^https?:\/\//.test(value)) path = new URL(value).pathname;
        else if (value.startsWith("/") && !value.startsWith("//")) path = value.split(/[?#]/, 1)[0];
        else return null;
    } catch { return null; }
    // The app serves Spanish through an /es rewrite. Other locale prefixes fail closed.
    return path.replace(/^\/es(?=\/|$)/, "") || "/";
}

export function publicCapturePath(value: string | null | undefined): string | null {
    const path = normalizeCapturePath(value);
    return path !== null && PUBLIC_ROUTES.some((route) => route.test(path)) ? path : null;
}

/**
 * The cart page is private for replay and autocapture, but the named cart and
 * checkout events (counts, totals and SKUs only) are the purchase funnel and
 * may be sent from it. See CART_EVENTS in capturePrivacy.ts.
 */
const CART_ROUTES = [/^\/cart\/?$/];

export function cartCapturePath(value: string | null | undefined): string | null {
    const path = normalizeCapturePath(value);
    return path !== null && CART_ROUTES.some((route) => route.test(path)) ? path : null;
}

export function mayRecordSession(
    pathname: string | null | undefined,
    options?: { mobile?: boolean },
): boolean {
    if (options?.mobile) return false;
    if (
        typeof window !== "undefined"
        && typeof window.matchMedia === "function"
        && window.matchMedia("(max-width: 899px)").matches
    ) {
        return false;
    }
    return publicCapturePath(pathname) !== null;
}
