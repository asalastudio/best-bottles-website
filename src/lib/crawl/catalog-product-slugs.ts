import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { createProductSlugIndex } from "./product-slug-index";
import type { ProductSlugLookup } from "./route-status";

let index: { exists: ProductSlugLookup } | null = null;

/**
 * The proxy's product-page existence check, backed by the Convex catalogue.
 * Without NEXT_PUBLIC_CONVEX_URL it cannot tell and answers null.
 */
export const productSlugExists: ProductSlugLookup = async (slug) => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) return null;
    if (!index) {
        const client = new ConvexHttpClient(url);
        index = createProductSlugIndex({
            loadAllSlugs: async () => {
                const groups = await client.query(api.products.getAllCatalogGroups, {});
                return groups.map((group) => group.slug);
            },
            // The same read the product page makes; null means no group has the slug.
            lookupSlug: async (candidate) => (await client.query(api.products.getProductGroup, { slug: candidate })) !== null,
        });
    }
    return index.exists(slug);
};
