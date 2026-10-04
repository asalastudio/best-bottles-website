import type { Metadata } from "next";

/**
 * A product group with no SKU the page may show renders "Product currently
 * unavailable" (src/app/products/[slug]/ProductDetailClient.tsx). The record
 * is real, so the page stays a 200 with its way back to the catalogue, but it
 * is kept out of search results (and out of /server-sitemap.xml) until it has
 * something to sell. Every other product page inherits the site default.
 */
export function productPageRobots(data: { variants: readonly unknown[] } | null | undefined): Pick<Metadata, "robots"> {
    return data && data.variants.length === 0 ? { robots: { index: false, follow: true } } : {};
}
