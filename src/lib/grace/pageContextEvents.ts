import { parseBrowseContext, type BrowseContext } from "@/lib/products/focused-shopping";
import { getCanonicalProductSlug } from "@/lib/products/legacy-product-route-overrides";

export const PDP_CONTEXT_CHANGE_EVENT = "bestbottles:pdp-context-change" as const;

/** The resolved, customer-visible PDP configuration. Deliberately excludes chat and customer data. */
export type PdpContextChange = {
    websiteSku: string;
    application?: string;
    glass?: string;
    rollerMaterial?: "metal" | "plastic";
    finish?: string;
    pageUrl: string;
};

export type GraceFinderContext = BrowseContext & {
    resultUrl: string;
};

export function buildGraceFinderContext(pathname: string, params: URLSearchParams): GraceFinderContext {
    const query = params.toString();
    return {
        ...parseBrowseContext(pathname, params),
        resultUrl: `${pathname}${query ? `?${query}` : ""}`,
    };
}

export function mergePdpContextChange<T extends { pathname: string }>(
    context: T,
    change: PdpContextChange,
): T | (T & { pdpSelection: PdpContextChange }) {
    if (!("pageUrl" in context) || typeof context.pageUrl !== "string" || context.pageUrl !== change.pageUrl) {
        return context;
    }
    const eventPathname = new URL(change.pageUrl, "https://bestbottles.local").pathname;
    if (eventPathname !== context.pathname) return context;
    return {
        ...context,
        pdpSelection: change,
    };
}

export function dispatchPdpContextChange(change: PdpContextChange): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent<PdpContextChange>(PDP_CONTEXT_CHANGE_EVENT, { detail: change }));
}

export function resolveGraceRecommendationHref({
    finderHref,
    exactProduct,
}: {
    finderHref: string;
    exactProduct: { slug?: string | null; websiteSku?: string | null; graceSku?: string | null } | null;
}): string {
    if (!exactProduct?.slug) return finderHref;
    const sku = exactProduct.websiteSku?.trim() || exactProduct.graceSku?.trim();
    if (!sku) return finderHref;
    const slug = getCanonicalProductSlug(exactProduct.slug);
    return `/products/${slug}?${new URLSearchParams({ sku }).toString()}`;
}

type GraceVerifiedPdpGroup = {
    group?: { slug?: string | null } | null;
    variants?: Array<{ websiteSku?: string | null; graceSku?: string | null }> | null;
} | null;

/**
 * A raw PDP navigation is valid only when the requested SKU is a stored
 * variant of the verified group. Group existence alone is not transaction
 * identity; absent, mismatched, and broad routes must return to the finder.
 */
export function resolveVerifiedGracePdpHref({
    requestedPath,
    finderHref,
    verifiedGroup,
}: {
    requestedPath: string;
    finderHref: string;
    verifiedGroup: GraceVerifiedPdpGroup;
}): string | null {
    const requested = new URL(requestedPath, "https://bestbottles.local");
    const rawSlug = requested.pathname.replace(/^\/products\//, "");
    if (!rawSlug || requested.pathname !== `/products/${rawSlug}`) return null;
    const canonicalSlug = getCanonicalProductSlug(rawSlug);
    const groupSlug = verifiedGroup?.group?.slug ? getCanonicalProductSlug(verifiedGroup.group.slug) : null;
    const sku = requested.searchParams.get("sku")?.trim();
    if (!sku || !groupSlug || canonicalSlug !== groupSlug) return null;
    const exactVariant = verifiedGroup?.variants?.find((variant) => (
        variant.websiteSku?.trim() === sku || variant.graceSku?.trim() === sku
    ));
    if (!exactVariant) return null;
    return resolveGraceRecommendationHref({
        finderHref,
        exactProduct: { slug: groupSlug, websiteSku: exactVariant.websiteSku, graceSku: exactVariant.graceSku },
    });
}
