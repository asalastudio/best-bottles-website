import type { MetadataRoute } from "next";

/**
 * Paths no crawler should fetch: APIs, accounts, staff tools, demos, and the
 * analytics/error tunnels. robots.txt matches by prefix, so a section that
 * has a page at its own root (`/team`, `/portal`, `/sign-in`) is written
 * without a trailing slash: `Disallow: /sign-in/` left `/sign-in` itself
 * open. Sections with no root page keep the slash so they cannot catch a
 * future `/labels` or `/developers`.
 *
 * `/_next/` is deliberately absent: Google needs `/_next/static` to render the
 * pages and `/_next/image` for every product photo.
 */
export const PRIVATE_PATH_PREFIXES = [
    "/api/",
    "/cart",
    "/dev/",
    "/example",
    "/executive",
    "/fitment-demo",
    "/grace-workspace",
    "/ingest/",
    "/lab/",
    "/monitoring-tunnel",
    "/portal",
    "/sign-in",
    "/sign-up",
    "/studio",
    "/team",
    "/tech-stack",
] as const;

/**
 * AI crawlers we name explicitly so it is clear they are welcome on the public
 * pages. They share the `*` group, so the private paths stay closed to them
 * too: a group of its own containing only `Allow: /` would override every
 * Disallow for that bot.
 */
export const NAMED_CRAWLERS = ["GPTBot", "Google-Extended", "anthropic-ai"] as const;

/** Sitemaps advertised in robots.txt, relative to the site origin. */
export const SITEMAP_PATHS = ["/sitemap.xml", "/server-sitemap.xml"] as const;

/**
 * Whether `pathname` is in one of the private sections: the section root or
 * anything below it. (robots.txt itself matches the bare prefix;
 * tests/crawl-robots-sitemap.test.ts checks no sitemap page falls under one.)
 */
export function isPrivatePath(pathname: string): boolean {
    return PRIVATE_PATH_PREFIXES.some((prefix) => (prefix.endsWith("/")
        ? pathname.startsWith(prefix)
        : pathname === prefix || pathname.startsWith(`${prefix}/`)));
}

/**
 * robots.txt for `siteUrl`, the same origin the pages' canonical links use
 * (`SITE_URL` in src/lib/seo.ts), so robots, sitemaps and canonicals can never
 * disagree about the host.
 */
export function buildRobots(siteUrl: string): MetadataRoute.Robots {
    const origin = siteUrl.replace(/\/+$/, "");
    return {
        rules: [
            {
                userAgent: ["*", ...NAMED_CRAWLERS],
                allow: "/",
                disallow: [...PRIVATE_PATH_PREFIXES],
            },
        ],
        host: origin,
        sitemap: SITEMAP_PATHS.map((path) => `${origin}${path}`),
    };
}
