import { getServerSideSitemap, ISitemapField } from "next-sitemap";
import { getCatalogVisibilitySnapshot } from "@/lib/catalogServer";
import { sitemapProductSlugs } from "@/lib/crawl/sitemap";
import { SITE_URL } from "@/lib/seo";
import { client as sanityClient, isSanityConfigured } from "@/sanity/lib/client";
import { JOURNAL_SITEMAP_QUERY } from "@/sanity/lib/queries";

export async function GET() {
  const fields: ISitemapField[] = [];

  try {
    // The same catalogue snapshot the catalogue grid filters with, so the
    // sitemap lists the product pages the site itself links to and nothing
    // that redirects, is held back, or has nothing to sell.
    const snapshot = await getCatalogVisibilitySnapshot();
    for (const slug of sitemapProductSlugs(snapshot.groups, snapshot.variantPreviewRows)) {
      fields.push({
        loc: `${SITE_URL}/products/${encodeURIComponent(slug)}`,
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
      // Journal posts are the "journal" document type (src/app/blog/[slug]).
      const posts = await sanityClient.fetch<Array<{ slug: string; publishedAt?: string; _updatedAt?: string }>>(JOURNAL_SITEMAP_QUERY);
      for (const p of posts) {
        const modified = p._updatedAt ?? p.publishedAt;
        fields.push({
          loc: `${SITE_URL}/blog/${encodeURIComponent(p.slug)}`,
          lastmod: modified ? new Date(modified).toISOString() : new Date().toISOString(),
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
