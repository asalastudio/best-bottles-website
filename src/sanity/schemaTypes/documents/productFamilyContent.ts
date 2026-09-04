import { defineType, defineField, defineArrayMember } from "sanity";
import { ComponentIcon } from "@sanity/icons";

// The list of product families — matches the values used in the Convex catalog.
const FAMILY_OPTIONS = [
    "Aluminum Bottle", "Apothecary", "Atomizer", "Bell", "Boston Round",
    "Circle", "Cream Jar", "Cylinder", "Decorative", "Diamond", "Diva",
    "Elegant", "Empire", "Flair", "Grace", "Lotion Bottle", "Pillar",
    "Plastic Bottle", "Rectangle", "Roll-On Cap", "Round", "Royal",
    "Sleek", "Slim", "Square", "Teardrop", "Tulip", "Vial",
].map((f) => ({ title: f, value: f }));

const TEMPLATE_OPTIONS = [
    { title: "Standard — Description · Features · Badges", value: "standard" },
    { title: "Premium — Gallery · Description · Feature Strip · FAQ", value: "premium" },
    { title: "Collection — Promo Banner · Features · Gallery · Description", value: "collection" },
];

export const productFamilyContent = defineType({
    name: "productFamilyContent",
    title: "Product Family Content",
    type: "document",
    icon: ComponentIcon,
    description: "Editorial content that applies to ALL products in a design family. Individual product overrides take priority over this.",
    fields: [
        defineField({
            name: "family",
            title: "Design Family",
            type: "string",
            options: { list: FAMILY_OPTIONS },
            validation: (Rule) => Rule.required(),
            description: "Must match the family name exactly as it appears in the catalog (e.g. Diva, Cylinder, Boston Round).",
        }),
        defineField({
            name: "familyPageSlug",
            title: "Family Page Slug",
            type: "slug",
            options: { source: "family", maxLength: 96 },
            validation: (Rule) => Rule.required(),
            description: "Dedicated catalog route, e.g. cylinder becomes /catalog/cylinder.",
        }),
        defineField({
            name: "familyPageEyebrow",
            title: "Family Page Eyebrow",
            type: "string",
            initialValue: "Buildable Bottle Family",
            description: "Short label above the family name. Keep this specific to how customers shop.",
        }),
        defineField({
            name: "templateType",
            title: "Default Template",
            type: "string",
            options: { list: TEMPLATE_OPTIONS, layout: "radio" },
            initialValue: "standard",
            description: "Sets the default block order for all products in this family. Individual product overrides can change the order.",
        }),
        defineField({
            name: "familyHeroImage",
            title: "Family Hero Image",
            type: "image",
            options: { hotspot: true },
            description: "Editorial beauty image for the dedicated family page. Compose at 2080×2288 so the desktop and mobile crops preserve the bottle, stone, and negative space.",
        }),
        defineField({
            name: "familyHeroAlt",
            title: "Family Hero Alt Text",
            type: "string",
            validation: (Rule) => Rule.custom((value, context) => {
                const parent = context.document as { familyHeroImage?: unknown } | undefined;
                return parent?.familyHeroImage && !value
                    ? "Alt text is required when a family hero image is present."
                    : true;
            }),
            description: "Describe the visible bottles and material setting; do not repeat marketing copy.",
        }),
        defineField({
            name: "familyStory",
            title: "Family Story",
            type: "text",
            rows: 3,
            description: "2–3 sentence brand narrative about this bottle family. Shown below the family name on catalog and product pages.",
        }),
        defineField({
            name: "featuredCohortSlug",
            title: "Featured Focused PDP Slug",
            type: "string",
            description: "Canonical focused PDP slug, e.g. cylinder-9ml-clear-17-415-rollon. This is editorial routing only; it does not define compatibility.",
        }),
        defineField({
            name: "pageBlocks",
            title: "Page Blocks",
            type: "array",
            of: [
                defineArrayMember({ type: "pdpFeatureStrip" }),
                defineArrayMember({ type: "pdpRichDescription" }),
                defineArrayMember({ type: "pdpGalleryRow" }),
                defineArrayMember({ type: "pdpPromoBanner" }),
                defineArrayMember({ type: "pdpFaqAccordion" }),
                defineArrayMember({ type: "pdpTrustBadges" }),
            ],
            description: "Drag blocks into the order you want them to appear on every product page in this family. Individual products can add their own blocks or override the order.",
        }),
    ],
    preview: {
        select: { family: "family", template: "templateType" },
        prepare({ family, template }) {
            return {
                title: family ? `${family} Family` : "Product Family Content",
                subtitle: template ?? "standard",
            };
        },
    },
});
