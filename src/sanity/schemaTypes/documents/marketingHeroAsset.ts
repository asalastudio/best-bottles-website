import { defineType, defineField } from "sanity";
import { ImagesIcon } from "@sanity/icons";

/**
 * Marketing hero / lifestyle asset library (2026-07-20).
 *
 * Group-level lifestyle renders (bottles with stones, props, editorial sets)
 * generated in Madison's scene/marketing lane — deliberately OUTSIDE the PDP
 * pipeline. These never touch products.imageUrl, Shopify variant media, or
 * the pipeline sku-jobs chain. Editors pick them from here for blog posts,
 * category thumbnails, campaigns, and any non-PDP surface.
 *
 * Upserted by scripts/push-sanity-marketing-heroes.mjs with deterministic ids
 * (marketingHeroAsset-{groupSlug}-{kind}) so re-pushes update in place.
 */
export const marketingHeroAsset = defineType({
    name: "marketingHeroAsset",
    title: "Marketing Hero Asset",
    type: "document",
    icon: ImagesIcon,
    fields: [
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            description: "Internal label, e.g. \"Cylinder 9ml — river stones hero\".",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "groupSlug",
            title: "Product Group Slug",
            type: "string",
            description: "Catalog group this hero represents (e.g. cylinder-9ml-clear-17-415-rollon). Group-level on purpose — one lifestyle hero covers the whole line, not one cap color.",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "kind",
            title: "Asset Kind",
            type: "string",
            options: {
                list: [
                    { title: "Category / grid thumbnail", value: "thumbnail" },
                    { title: "Blog / journal hero", value: "blog" },
                    { title: "Social", value: "social" },
                    { title: "Campaign / promo", value: "campaign" },
                    { title: "Other marketing", value: "other" },
                ],
                layout: "radio",
            },
            initialValue: "thumbnail",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "image",
            title: "Image",
            type: "image",
            options: { hotspot: true },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "generator",
            title: "Generator",
            type: "string",
            description: "Image model that produced this render (e.g. nano-banana-pro, openai-image-2). Set by the push script.",
            readOnly: true,
        }),
        defineField({
            name: "sourceUrl",
            title: "Madison Source URL",
            type: "url",
            description: "Provenance: the Madison Studio render this asset was uploaded from.",
            readOnly: true,
        }),
        defineField({
            name: "notes",
            title: "Notes",
            type: "text",
            rows: 2,
            description: "Prop set, campaign, usage guidance — anything editors should know.",
        }),
    ],
    preview: {
        select: { title: "title", subtitle: "kind", media: "image" },
    },
});
