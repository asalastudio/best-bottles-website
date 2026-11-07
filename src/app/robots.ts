import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { buildRobots } from "@/lib/crawl/robots";
import { SITE_URL } from "@/lib/seo";

// Built from SITE_URL, the origin every canonical link uses (metadataBase in
// src/app/layout.tsx), so robots.txt, the sitemaps and the canonicals always
// name https://www.bestbottles.com. On *.vercel.app hosts, crawling stays open
// (without advertising sitemaps) so Google can recrawl already-indexed URLs and
// read the noindex header/meta; Disallow: / can be re-added once vercel.app
// URLs have dropped out of the index.
export default async function robots(): Promise<MetadataRoute.Robots> {
    const headerStore = await headers();
    const requestHost = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
    return buildRobots(SITE_URL, requestHost);
}
