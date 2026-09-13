import { defineType, defineField, defineArrayMember } from "sanity";
import { HomeIcon } from "@sanity/icons";

export const homepagePage = defineType({
    name: "homepagePage",
    title: "Homepage",
    type: "document",
    icon: HomeIcon,
    fields: [
        defineField({name:"useEditorialArtwork",title:"Use custom hero and family artwork",type:"boolean",initialValue:false,
            description:"Enable after replacing the older hero and family images below with the approved stone photography. Until enabled, the redesigned homepage uses its curated stone artwork. Collection cards and Build your bottle fields are always active."}),
        defineField({ name: "collectionCards", title: "Shop by Collection", type: "array",
            of: [defineArrayMember({type:"shopCollectionCard"})],
            description: "Shared desktop and mobile merchandising. Leave unset for the six default collections. The full directory always exposes all eleven. Destinations follow the selected collection, never a manually typed URL.",
            validation: rule => rule.max(11).custom(cards => {
                if (!cards) return true;
                const keys = cards.map(card => (card as {collectionKey?:string}).collectionKey).filter(Boolean);
                return new Set(keys).size === keys.length || "Each collection may appear only once.";
            }),
        }),
        defineField({name:"buildYourBottle", title:"Build your bottle section",type:"buildYourBottleBlock"}),
        defineField({
            name: "heroSlides",
            title: "Hero Slider",
            type: "array",
            of: [defineArrayMember({ type: "heroBlock" })],
            validation: (Rule) => Rule.min(1).max(6),
            description: "Add 1 slide for a static hero, or 2+ for a rotating carousel (e.g. Black Friday, seasonal promos). Each slide has its own image, text, and button link.",
        }),
        defineField({
            name: "mobileHeroMode",
            title: "Mobile Hero Mode",
            type: "string",
            options: {
                list: [
                    { title: "Category Grid (default)", value: "categories" },
                    { title: "Full Hero (sales, promos)", value: "hero" },
                ],
                layout: "radio",
            },
            initialValue: "categories",
            description: "Choose what mobile users see at the top. 'Category Grid' shows the Shop by Application cards. 'Full Hero' shows the hero slider (great for sales, seasonal promos, product launches).",
        }),
        defineField({
            name: "mobileTagline",
            title: "Mobile Tagline",
            type: "string",
            description: "One-line value prop shown on mobile below the logo (replaces hero). Example: Premium glass packaging for beauty & wellness brands.",
            initialValue: "Premium glass packaging for beauty & wellness brands.",
        }),
        defineField({
            name: "mobileSectionLabel",
            title: "Mobile Section Label",
            type: "string",
            description: "Label above the mobile category grid. Example: Shop by Application",
            initialValue: "Shop by Application",
        }),
        defineField({
            name: "mobileCategoryCards",
            title: "Mobile Category Cards",
            type: "array",
            of: [defineArrayMember({ type: "mobileCategoryCard" })],
            validation: (Rule) => Rule.max(8),
            description: "2-column card grid shown on mobile in place of the hero. Up to 8 cards. Drag to reorder.",
        }),
        defineField({
            name: "startHereEyebrow",
            title: "Start Here — Eyebrow",
            type: "string",
            description: "Small uppercase label above the section title. Example: Guided Browsing",
            initialValue: "Guided Browsing",
        }),
        defineField({
            name: "startHereTitle",
            title: "Start Here — Section Title",
            type: "string",
            description: "Main heading for the section. Example: Start Here",
            initialValue: "Start Here",
        }),
        defineField({
            name: "startHereSubheading",
            title: "Start Here — Subheading",
            type: "text",
            description: "Supporting sentence below the title. Explains what the cards do.",
            initialValue: "Choose your use case to narrow the catalog faster.",
        }),
        defineField({
            name: "startHereCards",
            title: "Start Here Cards",
            type: "array",
            of: [defineArrayMember({ type: "startHereCard" })],
            validation: (Rule) => Rule.max(6),
            description: "Up to 6 cards. Each links to a filtered catalog view. Drag to reorder.",
        }),
        defineField({
            name: "designFamilyCards",
            title: "Design Family Cards",
            type: "array",
            of: [defineArrayMember({ type: "designFamilyCard" })],
            validation: (Rule) => Rule.max(12),
            description: "Bottle families shown in the carousel. Family Slug must match catalog exactly (e.g. Boston Round, Cylinder). Use Order to sort.",
        }),
        defineField({
            name: "educationPreview",
            title: "Education Preview",
            type: "educationPreview",
            description: "Featured blog articles and section heading. Links to Journal posts.",
        }),
        defineField({
            name: "megaMenuPanels",
            title: "Mega Menu Panels",
            type: "megaMenuPanels",
            description: "Optional featured images for mega menu. Link structure stays in code.",
        }),
    ],
    preview: {
        prepare() {
            return { title: "Homepage" };
        },
    },
});
