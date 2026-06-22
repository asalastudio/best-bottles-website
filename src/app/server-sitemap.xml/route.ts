import { getServerSideSitemap, ISitemapField } from "next-sitemap";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { client as sanityClient, isSanityConfigured } from "@/sanity/lib/client";
import { SITE_URL } from "@/lib/seo";

// Lazy so the module loads cleanly during `next build`'s page-data
// collection even when NEXT_PUBLIC_CONVEX_URL is unset on the build env.
function getConvexClient(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url);
}

export async function GET() {
  const fields: ISitemapField[] = [];

  const convex = getConvexClient();
  try {
    if (!convex) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    const groups = await convex.query(api.products.getAllCatalogGroups, {});
    for (const g of groups as Array<{ slug: string }>) {
      fields.push({
        loc: `${SITE_URL}/products/${g.slug}`,
        lastmod: new Date().toISOString(),
        changefreq: "weekly",
        priority: 0.8,
      });
    }
  } catch (e) {
    console.error("[Sitemap] Failed to fetch product groups:", e);
  }

  if (isSanityConfigured) {
    try {
      const posts = await sanityClient.fetch<Array<{ slug: string; publishedAt?: string }>>(
        `*[_type == "journalPost" && defined(slug.current)] | order(publishedAt desc) { "slug": slug.current, publishedAt }`
      );
      for (const p of posts) {
        fields.push({
          loc: `${SITE_URL}/blog/${p.slug}`,
          lastmod: p.publishedAt ? new Date(p.publishedAt).toISOString() : new Date().toISOString(),
          changefreq: "monthly",
          priority: 0.6,
        });
      }
    } catch (e) {
      console.error("[Sitemap] Failed to fetch blog posts:", e);
    }
  }

  return getServerSideSitemap(fields);
}
