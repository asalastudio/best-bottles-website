import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { buildRobots } from "@/lib/crawl/robots";
import { SITE_URL } from "@/lib/seo";

// Built from SITE_URL, the origin every canonical link uses (metadataBase in
// src/app/layout.tsx), so robots.txt, the sitemaps and the canonicals always
// name https://www.bestbottles.com. Requests arriving on *.vercel.app hosts
// receive `User-agent: * / Disallow: /` so preview and staging aliases stay
// out of search results.
export default async function robots(): Promise<MetadataRoute.Robots> {
    const headerStore = await headers();
    const requestHost = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
    return buildRobots(SITE_URL, requestHost);
}
