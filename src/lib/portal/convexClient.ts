import "server-only";

import { ConvexHttpClient } from "convex/browser";

/**
 * Shared Convex access for the portal's server-side data layer.
 *
 * Portal writes are authorized by a shared secret rather than a user identity,
 * so the token accessor lives behind `server-only` — importing this from a
 * client component is a build error, not a runtime leak.
 */

let convexClient: ConvexHttpClient | null = null;

export function getPortalConvex() {
    if (!convexClient) {
        const url = process.env.NEXT_PUBLIC_CONVEX_URL;
        if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
        convexClient = new ConvexHttpClient(url);
    }
    return convexClient;
}

export function getPortalConvexWriteToken() {
    const token = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!token) throw new Error("BEST_BOTTLES_CONVEX_WRITE_TOKEN is not set");
    return token;
}
