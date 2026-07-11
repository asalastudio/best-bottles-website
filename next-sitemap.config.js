// Derive the canonical origin from the environment so staging deployments
// never emit robots/sitemap URLs that point at the production domain
// (mirrors SITE_URL resolution in src/lib/seo.ts). Set NEXT_PUBLIC_SITE_URL
// per Vercel environment; the fallback is the production custom domain
// used after DNS cutover.
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.bestbottles.com").replace(/\/+$/, "");

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl,
  generateRobotsTxt: true,
  generateIndexSitemap: true,
  changefreq: "weekly",
  priority: 0.7,
  sitemapSize: 5000,

  robotsTxtOptions: {
    policies: [
      { userAgent: "*", allow: "/" },
      {
        userAgent: "*",
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
      `${siteUrl}/server-sitemap.xml`,
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
