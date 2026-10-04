import { hasCatalogSourceHold } from "@/lib/products/catalog-listing-visibility";
import { APPLICATION_ROUTE_SLUGS, familyFromSlug } from "@/lib/products/focused-shopping";
import { getLegacyProductRouteOverride } from "@/lib/products/legacy-product-route-overrides";

/**
 * Why these decisions live in the proxy rather than only in the pages:
 * src/app/loading.tsx and the Suspense boundary in AppProviders wrap every
 * page, so Next has already sent `200` by the time a page calls notFound() or
 * redirect(). The page then streams the not-found UI with an injected
 * `<meta name="robots" content="noindex">`, or a meta-refresh redirect, under
 * a 200 — a soft 404. Deciding before rendering gives crawlers real status
 * codes without changing how any page streams. The pages keep their own
 * notFound()/redirect() calls as the fallback.
 */

/**
 * A path with no route. The proxy rewrites here so Next renders
 * src/app/not-found.tsx with a real 404 while the address bar keeps the URL
 * that was asked for.
 */
export const NOT_FOUND_REWRITE_PATH = "/__not-found";

export type CrawlRouteStatus =
    | { kind: "pass" }
    | { kind: "not-found" }
    /** Permanent (308). `pathname` is unprefixed; the proxy re-adds the locale. */
    | { kind: "redirect"; pathname: string };

type PathDecision = CrawlRouteStatus | { kind: "check-product"; slug: string };

function decodeSegment(segment: string): string | null {
    try {
        return decodeURIComponent(segment);
    } catch {
        return null;
    }
}

/**
 * Everything decidable from the (locale-stripped) path alone. Product slugs
 * that are neither aliases nor held need the catalogue: "check-product".
 */
export function routeStatusForPath(pathname: string): PathDecision {
    const path = pathname.replace(/\/+$/, "") || "/";

    const product = path.match(/^\/products\/([^/]+)$/);
    if (product) {
        const slug = decodeSegment(product[1]);
        if (slug === null) return { kind: "pass" };
        // Same alias table the product page redirects with; a crawler gets the
        // canonical page in one permanent hop instead of a meta refresh.
        const canonical = getLegacyProductRouteOverride(slug);
        if (canonical) return { kind: "redirect", pathname: `/products/${canonical}` };
        if (hasCatalogSourceHold(slug)) return { kind: "not-found" };
        return { kind: "check-product", slug };
    }

    const application = path.match(/^\/catalog\/application\/([^/]+)$/);
    if (application) {
        const slug = decodeSegment(application[1]);
        return slug !== null && Object.prototype.hasOwnProperty.call(APPLICATION_ROUTE_SLUGS, slug)
            ? { kind: "pass" }
            : { kind: "not-found" };
    }

    const family = path.match(/^\/catalog\/([^/]+)$/);
    if (family) {
        const slug = decodeSegment(family[1]);
        return slug !== null && familyFromSlug(slug) ? { kind: "pass" } : { kind: "not-found" };
    }

    return { kind: "pass" };
}

/**
 * A full page load, as a crawler makes it. Client-side navigations and
 * prefetches (RSC requests) skip the catalogue lookup: their HTTP status is
 * never seen by a search engine, and the catalogue grid prefetches hundreds of
 * product links.
 */
export function isDocumentRequest(method: string, headers: Headers, searchParams: URLSearchParams): boolean {
    if (method !== "GET" && method !== "HEAD") return false;
    return !headers.has("rsc") && !headers.has("next-router-prefetch") && !searchParams.has("_rsc");
}

/** true: a product group has this slug; false: none does; null: could not tell. */
export type ProductSlugLookup = (slug: string) => Promise<boolean | null>;

export async function crawlRouteStatus(
    request: { pathname: string; method: string; headers: Headers; searchParams: URLSearchParams },
    productSlugExists: ProductSlugLookup,
): Promise<CrawlRouteStatus> {
    const decision = routeStatusForPath(request.pathname);
    if (decision.kind !== "check-product") return decision;
    if (!isDocumentRequest(request.method, request.headers, request.searchParams)) return { kind: "pass" };
    // Unknown (catalogue unreachable) fails open: the page renders and still
    // calls notFound() itself.
    return (await productSlugExists(decision.slug)) === false ? { kind: "not-found" } : { kind: "pass" };
}
