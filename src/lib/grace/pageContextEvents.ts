import { parseBrowseContext, type BrowseContext } from "@/lib/products/focused-shopping";

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
    exactProduct: { slug?: string | null } | null;
}): string {
    return exactProduct?.slug ? `/products/${exactProduct.slug}` : finderHref;
}
