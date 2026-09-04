import { ImagesIcon } from "@sanity/icons";
import { defineArrayMember, defineField, defineType } from "sanity";

const GLASS_OPTIONS = [
    { title: "Clear", value: "CLR" },
    { title: "Amber", value: "AMB" },
    { title: "Cobalt Blue", value: "BLU" },
    { title: "Frosted", value: "FRS" },
    { title: "Swirl", value: "SWL" },
];

const REQUIRED_GLASS_KEYS = GLASS_OPTIONS.map((option) => option.value);

/**
 * Atomic editorial gallery for a buildable Paper Doll family.
 *
 * Shopify remains the source of exact sellable variant media. This document
 * owns the glass-level beauty view shown beside the exact focused PDP stage.
 */
export const paperDollBeautyGallery = defineType({
    name: "paperDollBeautyGallery",
    title: "Paper Doll Beauty Gallery",
    type: "document",
    icon: ImagesIcon,
    fields: [
        defineField({
            name: "familyKey",
            title: "Paper Doll family key",
            type: "string",
            description: "Stable internal media-family key. The first release is CYL-9ML.",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "displayName",
            title: "Display name",
            type: "string",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "canvasWidth",
            title: "Canvas width",
            type: "number",
            initialValue: 2080,
            validation: (Rule) => Rule.required().min(2080).max(2080),
        }),
        defineField({
            name: "canvasHeight",
            title: "Canvas height",
            type: "number",
            initialValue: 2288,
            validation: (Rule) => Rule.required().min(2288).max(2288),
        }),
        defineField({
            name: "referenceRoller",
            title: "Beauty-view roller",
            type: "string",
            initialValue: "metal-roller",
            options: { list: [{ title: "Metal roller", value: "metal-roller" }] },
            validation: (Rule) => Rule.required(),
            description: "Editorial reference only; the focused PDP continues to show the selected applicator.",
        }),
        defineField({
            name: "referenceCapFinish",
            title: "Beauty-view cap finish",
            type: "string",
            initialValue: "matte-silver",
            options: { list: [{ title: "Matte silver", value: "matte-silver" }] },
            validation: (Rule) => Rule.required(),
            description: "Editorial reference only; the focused PDP continues to show the selected cap finish.",
        }),
        defineField({
            name: "generator",
            title: "Generator",
            type: "string",
            description: "Native clean-export source, e.g. Google Gemini Nano Banana Pro.",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "assetRevision",
            title: "Asset revision",
            type: "string",
            description: "Immutable reviewed set identifier, e.g. sandstone-v1.",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "heroes",
            title: "Glass beauty heroes",
            type: "array",
            of: [
                defineArrayMember({
                    name: "glassBeautyHero",
                    title: "Glass beauty hero",
                    type: "object",
                    fields: [
                        defineField({
                            name: "glassKey",
                            title: "Glass",
                            type: "string",
                            options: { list: GLASS_OPTIONS },
                            validation: (Rule) => Rule.required(),
                        }),
                        defineField({
                            name: "glassLabel",
                            title: "Glass label",
                            type: "string",
                            validation: (Rule) => Rule.required(),
                        }),
                        defineField({
                            name: "image",
                            title: "Clean 2080 × 2288 image",
                            type: "image",
                            options: { hotspot: false },
                            validation: (Rule) => Rule.required(),
                            description: "Production-native clean export only. Do not upload watermarked review comps.",
                        }),
                        defineField({
                            name: "alt",
                            title: "Alt text",
                            type: "string",
                            validation: (Rule) => Rule.required(),
                        }),
                    ],
                    preview: {
                        select: { title: "glassLabel", subtitle: "glassKey", media: "image" },
                    },
                }),
            ],
            validation: (Rule) => Rule.required().length(5).custom((heroes) => {
                if (!Array.isArray(heroes)) return true;
                const keys = heroes
                    .map((hero) => hero && typeof hero === "object" && "glassKey" in hero
                        ? String(hero.glassKey)
                        : "")
                    .filter(Boolean);
                return REQUIRED_GLASS_KEYS.every((key) => keys.filter((candidate) => candidate === key).length === 1)
                    ? true
                    : "Include Clear, Amber, Cobalt Blue, Frosted, and Swirl exactly once.";
            }),
        }),
        defineField({
            name: "storefrontReady",
            title: "Storefront ready",
            type: "boolean",
            initialValue: false,
            description: "Enable only after all five clean exports pass 2080 × 2288, empty-bottle, watermark, baseline, and five-up consistency QA.",
        }),
        defineField({
            name: "reviewNotes",
            title: "Review notes",
            type: "text",
            rows: 3,
        }),
    ],
    preview: {
        select: { title: "displayName", familyKey: "familyKey", ready: "storefrontReady" },
        prepare({ title, familyKey, ready }) {
            return {
                title: title || "Paper Doll Beauty Gallery",
                subtitle: `${familyKey || "No family key"} · ${ready ? "Storefront ready" : "Draft asset set"}`,
            };
        },
    },
});
