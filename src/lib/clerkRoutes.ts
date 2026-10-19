import { stripLocalePrefix } from "@/i18n/paths";

/**
 * Clerk's frontend SDK and the middleware handshake run only on account,
 * checkout, and staff surfaces. Home, catalog, and product pages skip both
 * so the development instance (together-lemur-38.clerk.accounts.dev) is not
 * on the critical path.
 *
 * API prefixes stay listed because `auth()` throws when clerk middleware did
 * not run on that request.
 */
const PAGE_PREFIXES = [
    "/sign-in",
    "/sign-up",
    "/portal",
    "/cart",
    "/checkout",
    "/account",
    "/team",
    "/executive",
    "/grace-workspace",
] as const;

const API_PREFIXES = [
    "/api/portal",
    "/api/grace",
    "/api/executive",
    "/api/knowledge",
] as const;

function matchesPrefix(path: string, prefix: string): boolean {
    return path === prefix || path.startsWith(`${prefix}/`);
}

export function isClerkRoute(pathname: string | null | undefined): boolean {
    if (!pathname) return false;
    const path = stripLocalePrefix(pathname.split(/[?#]/, 1)[0] ?? pathname) || "/";
    return PAGE_PREFIXES.some((prefix) => matchesPrefix(path, prefix))
        || API_PREFIXES.some((prefix) => matchesPrefix(path, prefix));
}
