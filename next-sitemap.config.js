// Canonical site URL. Mirrors the resolution logic in src/lib/seo.ts so the
// sitemap, robots.txt, and on-page canonical/OG tags always agree on ONE domain.
// Set NEXT_PUBLIC_SITE_URL in the environment (Vercel project settings + .env.local).
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ||
  "https://www.bestbottles.com";

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: SITE_URL,
  generateRobotsTxt: true,
  generateIndexSitemap: true,
  changefreq: "weekly",
  priority: 0.7,
  sitemapSize: 5000,

  robotsTxtOptions: {
    // One consolidated "*" record (allow + disallow together) avoids the
    // duplicate "User-agent: *" blocks the previous config produced.
    policies: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/portal/",
          "/studio/",
          "/sign-in/",
          "/sign-up/",
          "/cart",
          "/grace-workspace",
          "/example",
          "/fitment-demo",
          "/tech-stack",
          "/_next/",
        ],
      },
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "Google-Extended", allow: "/" },
      { userAgent: "anthropic-ai", allow: "/" },
    ],
    additionalSitemaps: [
      `${SITE_URL}/server-sitemap.xml`,
    ],
  },

  exclude: [
    "/api/*",
    "/portal/*",
    "/studio/*",
    "/sign-in/*",
    "/sign-up/*",
    "/example",
    "/fitment-demo",
    "/tech-stack",
    "/cart",
    "/grace-workspace",
  ],
};
