import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { CLERK_ENABLED } from "@/lib/clerk";
import { LOCALE_HEADER, PATHNAME_HEADER } from "@/i18n/config";
import { resolveLocale } from "@/i18n/resolveLocale";

const isPortalRoute = createRouteMatcher(["/portal(.*)", "/api/portal(.*)"]);

function withLocale(req: NextRequest) {
    const pathname = req.nextUrl.pathname;
    const resolved = resolveLocale(pathname);

    if (resolved.kind === "redirect") {
        const url = req.nextUrl.clone();
        url.pathname = resolved.redirectPath;
        return NextResponse.redirect(url);
    }

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set(LOCALE_HEADER, resolved.locale);
    requestHeaders.set(PATHNAME_HEADER, pathname);

    if (resolved.kind === "rewrite") {
        const url = req.nextUrl.clone();
        url.pathname = resolved.rewritePath;
        return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }

    return NextResponse.next({ request: { headers: requestHeaders } });
}

export default clerkMiddleware(async (auth, req) => {
    const localized = withLocale(req);
    if (localized.status >= 300 && localized.status < 400) {
        return localized;
    }

    if (!CLERK_ENABLED) {
        return localized;
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

    return localized;
});

export const config = {
    matcher: [
        // Skip Next.js internals and static files
        // monitoring-tunnel is the Sentry browser tunnel (next.config.ts) — no auth, no Clerk.
        "/((?!_next|monitoring-tunnel|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
