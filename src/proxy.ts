import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { CLERK_ENABLED } from "@/lib/clerk";
import { LOCALE_HEADER, PATHNAME_HEADER } from "@/i18n/config";
import { hasLocalePrefix } from "@/i18n/paths";
import { localeAfterProxyPass, resolveLocale } from "@/i18n/resolveLocale";

const isPortalRoute = createRouteMatcher(["/portal(.*)", "/api/portal(.*)"]);

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

    const localized = resolved.kind === "rewrite"
        ? NextResponse.rewrite(new URL(`${resolved.rewritePath}${req.nextUrl.search}`, req.url), {
            request: { headers: requestHeaders },
        })
        : (clerkRes instanceof NextResponse ? clerkRes : NextResponse.next({ request: { headers: requestHeaders } }));

    if (resolved.kind === "rewrite" && clerkRes) {
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
        "/((?!_next|monitoring-tunnel|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
