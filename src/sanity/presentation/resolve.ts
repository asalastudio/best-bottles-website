import { defineLocations, type PresentationPluginOptions } from "sanity/presentation";

/**
 * Maps Sanity documents to the front-end URLs where they appear, so the
 * Presentation (visual editing) tool knows which page to open when you select
 * a document — and shows "used on" hints inside the Studio.
 *
 * Only document types with a corresponding public route are listed. Add more
 * as additional content types get their own pages.
 */
export const resolve: PresentationPluginOptions["resolve"] = {
    locations: {
        homepagePage: defineLocations({
            message: "This is the site home page",
            tone: "positive",
            locations: [{ title: "Home", href: "/" }],
        }),
        journal: defineLocations({
            select: { title: "title", slug: "slug.current" },
            resolve: (doc) => ({
                locations: [
                    {
                        title: doc?.title || "Untitled article",
                        href: `/blog/${doc?.slug}`,
                    },
                    { title: "Journal index", href: "/blog" },
                ],
            }),
        }),
        productGroupContent: defineLocations({
            select: { title: "title", slug: "slug.current" },
            resolve: (doc) => ({
                locations: doc?.slug
                    ? [
                          {
                              title: doc?.title || "Product page",
                              href: `/products/${doc?.slug}`,
                          },
                      ]
                    : [],
            }),
        }),
    },
};
