import type { MetadataRoute } from "next";
import { isMissingHeroSource, isVisibleCatalogGroup } from "@/lib/products/catalog-listing-visibility";
import { isLegacyProductRouteAlias } from "@/lib/products/legacy-product-route-overrides";
import { isPrivatePath } from "./robots";

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

/**
 * Every public page with a fixed URL, in /sitemap.xml. Product and journal
 * pages come from the data in /server-sitemap.xml.
 *
 * tests/crawl-sitemap.test.ts walks src/app and fails when a page exists that
 * is neither listed here, private (robots.ts), nor in NOT_IN_SITEMAP, so a new
 * page cannot silently miss the sitemap.
 */
export const SITEMAP_PAGES: ReadonlyArray<{ path: string; changeFrequency: ChangeFrequency; priority: number }> = [
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/catalog", changeFrequency: "daily", priority: 0.9 },
    // Build Your Bottle.
    { path: "/matrix", changeFrequency: "weekly", priority: 0.8 },
    { path: "/collections", changeFrequency: "weekly", priority: 0.8 },
    { path: "/bottle-families", changeFrequency: "weekly", priority: 0.8 },
    { path: "/blog", changeFrequency: "weekly", priority: 0.6 },
    { path: "/resources", changeFrequency: "monthly", priority: 0.5 },
    { path: "/about", changeFrequency: "monthly", priority: 0.5 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
    { path: "/request-quote", changeFrequency: "monthly", priority: 0.5 },
    { path: "/request-sample", changeFrequency: "monthly", priority: 0.5 },
    { path: "/shipping-returns", changeFrequency: "yearly", priority: 0.3 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
];

/**
 * Public routes that must stay out of the sitemap, with the reason. A sitemap
 * lists canonical pages only; a URL that redirects is reported as an error.
 */
export const NOT_IN_SITEMAP: Readonly<Record<string, string>> = {
    "/collections/boston-round-30ml": "redirects to the filtered catalog",
    // Since #221 a family or application URL without ?guide=1 redirects to the
    // filtered master catalog, so the bare URLs are redirects, not pages.
    "/catalog/[family]": "redirects to /catalog?families=… unless ?guide=1",
    "/catalog/application/[application]": "redirects to /catalog?applicators=… unless ?guide=1",
    "/products/[slug]": "listed per product in /server-sitemap.xml",
    // Classic families render here so the redesigned PDP stays free of Three.js.
    // The canonical URL remains /products/[slug] (a temporary redirect), which
    // the server sitemap already lists per product.
    "/legacy-product/[slug]": "classic product HTML; canonical URL stays /products/[slug]",
    "/blog/[slug]": "listed per post in /server-sitemap.xml",
};

export function buildPageSitemap(siteUrl: string, lastModified: Date): MetadataRoute.Sitemap {
    const origin = siteUrl.replace(/\/+$/, "");
    return SITEMAP_PAGES
        .filter((page) => !isPrivatePath(page.path))
        .map((page) => ({
            url: page.path === "/" ? origin : `${origin}${page.path}`,
            lastModified,
            changeFrequency: page.changeFrequency,
            priority: page.priority,
        }));
}

export type SitemapProductGroup = { _id: string; slug: string; variantCount: number; category?: string | null };
export type SitemapVariantRow = { groupId: string; variants: ReadonlyArray<{ websiteSku?: string | null; graceSku?: string | null }> };

/**
 * Product slugs worth a sitemap entry: the groups the catalogue lists, minus
 * legacy aliases (they 308 to their canonical slug) and groups whose every SKU
 * is held back from the product page, which would only show "Product currently
 * unavailable".
 *
 * `variantRows` comes from the catalogue visibility snapshot
 * (src/lib/catalogServer.ts), which loads the full SKU list for exactly the
 * groups whose primary SKU is held back; every other group has a showable
 * primary SKU.
 */
export function sitemapProductSlugs(
    groups: readonly SitemapProductGroup[],
    variantRows: readonly SitemapVariantRow[],
): string[] {
    const variantsByGroup = new Map(variantRows.map((row) => [row.groupId, row.variants]));
    const slugs = new Set<string>();
    for (const group of groups) {
        if (!group.slug || isLegacyProductRouteAlias(group.slug)) continue;
        const variants = variantsByGroup.get(group._id);
        if (!isVisibleCatalogGroup(group, variants)) continue;
        if (variants && !variants.some((variant) => !isMissingHeroSource(variant))) continue;
        slugs.add(group.slug);
    }
    return [...slugs];
}
