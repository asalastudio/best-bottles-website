import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CLERK_ENABLED } from "@/lib/clerk";
import { resolveLegacyRedirect } from "@/lib/seo/legacyRedirects";

const isPortalRoute = createRouteMatcher(["/portal(.*)", "/api/portal(.*)"]);

/** Attribution parameters worth carrying across a redirect. */
const CAMPAIGN_PARAMS = new Set([
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "gclid", "gbraid", "wbraid", "fbclid", "msclkid", "ttclid",
    "mc_cid", "mc_eid", "ref",
]);

export default clerkMiddleware(async (auth, req) => {
    // Legacy URLs first, before any auth work. These carry the old site's
    // ranking history and inbound links; a 301 must answer them whether or not
    // Clerk is configured, and there is no reason to resolve a session for a
    // request that is leaving immediately.
    const legacy = resolveLegacyRedirect(req.nextUrl.pathname, req.nextUrl.searchParams);
    if (legacy) {
        const destination = new URL(legacy, req.nextUrl.origin);
        // Carry CAMPAIGN parameters through, and only those. A legacy link in
        // a live ad or an old email still has its utm_* attached, and dropping
        // them makes that traffic look like it arrived from nowhere.
        //
        // Legacy navigation parameters must NOT survive: `?subcat=65` meant
        // something on the PHP site, has already been used to choose this
        // destination, and would otherwise arrive as /catalog?subcat=65 — a
        // parameter this app does not understand, on a URL search engines
        // would index as distinct from /catalog.
        for (const [key, value] of req.nextUrl.searchParams) {
            if (!CAMPAIGN_PARAMS.has(key.toLowerCase())) continue;
            if (!destination.searchParams.has(key)) destination.searchParams.set(key, value);
        }
        // 301, not 308: these are permanent moves that search engines should
        // fold into the new URL, and every legacy request is a GET.
        return NextResponse.redirect(destination, 301);
    }

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
