import type { MetadataRoute } from "next";
import { buildPageSitemap } from "@/lib/crawl/sitemap";
import { SITE_URL } from "@/lib/seo";

// The fixed-URL pages, rebuilt on every deploy. Products and journal posts
// are in /server-sitemap.xml, which robots.txt lists alongside this one.
export default function sitemap(): MetadataRoute.Sitemap {
    return buildPageSitemap(SITE_URL, new Date());
}
