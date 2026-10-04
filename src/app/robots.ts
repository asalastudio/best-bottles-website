import type { MetadataRoute } from "next";
import { buildRobots } from "@/lib/crawl/robots";
import { SITE_URL } from "@/lib/seo";

// Built from SITE_URL, the origin every canonical link uses (metadataBase in
// src/app/layout.tsx), so robots.txt, the sitemaps and the canonicals always
// name the same host: the Vercel URL before the domain cutover, and
// https://www.bestbottles.com once NEXT_PUBLIC_SITE_URL is switched.
export default function robots(): MetadataRoute.Robots {
    return buildRobots(SITE_URL);
}
