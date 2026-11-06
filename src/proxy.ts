import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { CLERK_ENABLED } from "@/lib/clerk";
import { LOCALE_HEADER, PATHNAME_HEADER } from "@/i18n/config";
import { hasLocalePrefix, localizeHref } from "@/i18n/paths";
import { localeAfterProxyPass, resolveLocale } from "@/i18n/resolveLocale";
import { productSlugExists } from "@/lib/crawl/catalog-product-slugs";
import { NOT_FOUND_REWRITE_PATH, crawlRouteStatus } from "@/lib/crawl/route-status";
import { LEGACY_REDIRECTS, resolveLegacyRedirect } from "@/lib/seo/legacyRedirects";

const isPortalRoute = createRouteMatcher(["/portal(.*)", "/api/portal(.*)"]);

/** Attribution parameters worth carrying across a legacy redirect. */
const CAMPAIGN_PARAMS = new Set([
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "gclid", "gbraid", "wbraid", "fbclid", "msclkid", "ttclid",
    "mc_cid", "mc_eid", "ref",
]);

/**
 * Where a legacy bestbottles.com URL goes, or null when it is not one.
 *
 * An unmapped `/product/<slug>` falls back to the catalogue, unless the slug is
 * a product on this site: next.config used to send `/product/:slug` to
 * `/products/:slug`, and links written that way to a real product keep working.
 */
async function legacyDestination(req: NextRequest): Promise<string | null> {
    const { pathname, searchParams } = req.nextUrl;
    const destination = resolveLegacyRedirect(pathname, searchParams);
    if (destination !== "/catalog") return destination;

    const singular = /^\/+product\/([^/]+)\/?$/i.exec(pathname);
    if (!singular || LEGACY_REDIRECTS.has(pathname.toLowerCase())) return destination;
    let slug: string;
    try {
        slug = decodeURIComponent(singular[1]);
    } catch {
        return destination;
    }
    return (await productSlugExists(slug)) ? `/products/${encodeURIComponent(slug)}` : destination;
}

const clerk = clerkMiddleware(async (auth, req) => {
    if (!CLERK_ENABLED) {
        return NextResponse.next();
    }

    if (isPortalRoute(req)) {
        // `auth.protect()` answers a signed-out request with a bare 404 when it
        // cannot resolve a sign-in URL for itself — which is what the deployed
        // site did for every /portal route, so customers hit "not found"
        // instead of a login screen. Redirect explicitly, carrying the
        // originally requested path so they land where they were going.
        const { userId, redirectToSignIn } = await auth();
        if (!userId) {
            return redirectToSignIn({ returnBackUrl: req.url });
        }
    }

    return NextResponse.next();
});

function copyDownstreamHeaders(from: Response, to: NextResponse) {
    from.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (lower.startsWith("x-middleware-") || lower === "location") {
            return;
        }
        to.headers.append(key, value);
    });
}

function setRequestHeader(res: NextResponse, key: string, value: string) {
    const current = res.headers.get("x-middleware-override-headers");
    const names = new Set(
        (current ? current.split(",") : []).map((name) => name.trim()).filter(Boolean),
    );
    names.add(key);
    res.headers.set("x-middleware-override-headers", [...names].join(","));
    res.headers.set(`x-middleware-request-${key}`, value);
}

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
    // Legacy URLs first, before locale and auth work. They carry the old site's
    // ranking history and inbound links, and the request is leaving at once.
    const legacy = await legacyDestination(req);
    if (legacy) {
        const destination = new URL(legacy, req.nextUrl.origin);
        // Carry campaign parameters, and only those: a legacy link in a live ad
        // still has its utm_* attached. Legacy navigation parameters such as
        // `?subcat=65` already chose this destination and mean nothing here.
        for (const [key, value] of req.nextUrl.searchParams) {
            if (!CAMPAIGN_PARAMS.has(key.toLowerCase())) continue;
            if (!destination.searchParams.has(key)) destination.searchParams.set(key, value);
        }
        // 301: a permanent move search engines fold into the new URL.
        return NextResponse.redirect(destination, 301);
    }

    const pathname = req.nextUrl.pathname;
    const incomingLocale = req.headers.get(LOCALE_HEADER);
    const incomingPath = req.headers.get(PATHNAME_HEADER);
    const resolved = resolveLocale(pathname);

    if (resolved.kind === "redirect") {
        const url = req.nextUrl.clone();
        url.pathname = resolved.redirectPath;
        url.search = req.nextUrl.search;
        return NextResponse.redirect(url);
    }

    // Real status codes for crawlers: legacy product aliases 308 to their
    // canonical slug, and unknown products/families 404 instead of a page that
    // says "not found" under a 200 (see src/lib/crawl/route-status.ts).
    const crawlStatus = await crawlRouteStatus({
        pathname: resolved.kind === "rewrite" ? resolved.rewritePath : pathname,
        method: req.method,
        headers: req.headers,
        searchParams: req.nextUrl.searchParams,
    }, productSlugExists);
    if (crawlStatus.kind === "redirect") {
        const url = req.nextUrl.clone();
        url.pathname = resolved.kind === "rewrite" ? localizeHref("es", crawlStatus.pathname) : crawlStatus.pathname;
        return NextResponse.redirect(url, 308);
    }

    // Next re-invokes proxy on the rewrite destination. Keep Spanish from the
    // first pass instead of treating `/catalog` as a fresh English request.
    const locale = localeAfterProxyPass(pathname, incomingLocale);
    const originalPath = hasLocalePrefix(pathname)
        ? pathname
        : (incomingPath && hasLocalePrefix(incomingPath) ? incomingPath : pathname);

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set(LOCALE_HEADER, locale);
    requestHeaders.set(PATHNAME_HEADER, originalPath);

    const clerkRes = await clerk(req, event);
    if (clerkRes && clerkRes.status >= 300 && clerkRes.status < 400) {
        return clerkRes;
    }

    const rewritePath = crawlStatus.kind === "not-found"
        ? NOT_FOUND_REWRITE_PATH
        : resolved.kind === "rewrite" ? resolved.rewritePath : null;
    const localized = rewritePath
        ? NextResponse.rewrite(new URL(`${rewritePath}${req.nextUrl.search}`, req.url), {
            request: { headers: requestHeaders },
        })
        : (clerkRes instanceof NextResponse ? clerkRes : NextResponse.next({ request: { headers: requestHeaders } }));

    if (rewritePath && clerkRes) {
        copyDownstreamHeaders(clerkRes, localized);
    }
    setRequestHeader(localized, LOCALE_HEADER, locale);
    setRequestHeader(localized, PATHNAME_HEADER, originalPath);
    return localized;
}

export const config = {
    matcher: [
        // Skip Next.js internals and static files
        // monitoring-tunnel is the Sentry browser tunnel (next.config.ts) — no auth, no Clerk.
        // .html is not excluded: the legacy site served pages at .html, and they
        // must reach the legacy redirect map. Nothing this app serves ends in .html.
        "/((?!_next|monitoring-tunnel|[^?]*\\.(?:css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
