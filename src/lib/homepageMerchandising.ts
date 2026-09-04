import { applicationFinderHref, familyFinderHref } from "@/lib/products/focused-shopping";

export type HomepageFamilyCard = {
    family: string;
    title: string;
    image: string;
    layout: "feature" | "standard" | "wide";
    description?: string;
    applications?: string[];
};

export const HOME_FAMILY_MOSAIC: readonly HomepageFamilyCard[] = [
    {
        family: "Cylinder",
        title: "Cylinder",
        image: "/assets/Cylinder-BB.png",
        layout: "feature",
        description: "Clean, versatile, made for roll-on, spray, pump, or cap.",
        applications: ["Roll-on", "Spray", "Pump", "Cap"],
    },
    {
        family: "Elegant",
        title: "Elegant",
        image: "/assets/Slim-BB.png",
        layout: "standard",
    },
    {
        family: "Circle",
        title: "Circle",
        image: "/assets/CreamJars-BB.png",
        layout: "standard",
    },
    {
        family: "Boston Round",
        title: "Boston Round",
        image: "/assets/collection_amber.png",
        layout: "wide",
    },
] as const;

export function homepageFamilyHref(family: string): string {
    return familyFinderHref(family);
}

export const HOME_APPLICATION_LINKS = [
    {
        key: "rollon",
        label: "Roll-On",
        href: applicationFinderHref("rollon"),
        image: "/assets/applicator-sketches/roll-on-pencil.webp",
        description: "Controlled, direct application",
    },
    {
        key: "spray",
        label: "Fine Mist Sprayer",
        href: applicationFinderHref("spray"),
        image: "/assets/applicator-sketches/fine-mist-pencil.webp",
        description: "Even, atomized coverage",
    },
    {
        key: "lotionpump",
        label: "Lotion Pump",
        href: applicationFinderHref("lotionpump"),
        image: "/assets/applicator-sketches/lotion-pump-treatment-pencil.webp",
        description: "Measured dispensing for creams",
    },
    {
        key: "dropper",
        label: "Dropper",
        href: applicationFinderHref("dropper"),
        image: "/assets/applicator-sketches/dropper-pencil.webp",
        description: "Precise, measured application",
    },
    {
        key: "reducer",
        label: "Reducer",
        href: applicationFinderHref("reducer"),
        image: "/assets/applicator-sketches/reducer-pencil.webp",
        description: "Controlled oil dispensing",
    },
] as const;

export const HOME_SAMPLE_FEATURE = {
    eyebrow: "Popular Small Formats",
    title: "1–4 mL Samples & Testers",
    description: "1, 1.5, 2, and 4 mL vials and drams for discovery sets, promotions, decanting, and product trials.",
    href: "/catalog?families=Vial&capacities=1+ml%2C1.5+ml%2C2+ml%2C4+ml&sort=best-match",
    image: "/assets/editorial-sketches/samples-testers-pencil-v3.webp",
    imageAlt: "Amber 1, 1.5, and 2 milliliter sample vials beside a cobalt 4 milliliter dram",
    matte: "#f1e3c8",
} as const;

export const HOME_EDITORIAL_STORIES = [
    {
        key: "antique-bulb-sprayers",
        eyebrow: "The Art of Fragrance",
        title: "Antique Bulb Sprayers",
        description: "A signature finishing touch for the vanity: sculptural glass paired with vintage bulbs, braided hoses, and tassels.",
        href: "/catalog?families=Diva&applicators=antiquespray%2Cantiquespray-tassel&sort=best-match",
        image: "/assets/editorial-sketches/antique-bulb-sprayers-pencil.webp",
        imageAlt: "Two antique perfume bottles with black and red bulb sprayers arranged on a sketched vanity",
        imagePosition: "72% center",
        matte: "#f1e7d2",
    },
    {
        key: "cream-jars",
        eyebrow: "Skincare Essentials",
        title: "Cream Jars",
        description: "Compact glass vessels for balms, creams, and concentrated formulas, with distinctive silhouettes made for presentation.",
        href: "/catalog?category=Cream+Jar&sort=best-match",
        image: "/assets/editorial-sketches/cream-jars-pencil.webp",
        imageAlt: "Amber and clear cream jars with silver and pink caps on a sketched stone vanity",
        imagePosition: "35% center",
        matte: "#f1e7d4",
    },
    {
        key: "gift-bottles",
        eyebrow: "Small Objects, Lasting Impressions",
        title: "Gift Bottles",
        description: "Decorative glass for favors, discovery rituals, keepsakes, and promotional moments that deserve more than a standard vial.",
        href: "/catalog?families=Decorative&sort=best-match",
        image: "/assets/editorial-sketches/gift-bottles-pencil-v2.webp",
        imageAlt: "Decorative cobalt, clear, and heart-shaped gift bottles with a traditional octagonal bottle on a sketched tray",
        imagePosition: "36% center",
        matte: "#f1e6d8",
    },
] as const;

export const HOME_ACCESSORY_STORY = {
    eyebrow: "Packaging & Accessories",
    title: "Finish the presentation",
    description: "From organza and velvet pouches to filling tools and window cartons, the final details protect the bottle, simplify filling, and turn a product into a ready-to-gift experience.",
    href: "/catalog?category=Accessory&sort=best-match",
    image: "/assets/editorial-sketches/packaging-accessories-pencil.webp",
    imageAlt: "An organza bottle bag, velvet pouch, gold filling funnel, and patterned window carton",
    matte: "#f3ebd9",
    links: [
        { label: "Gift Boxes", href: "/catalog?families=Gift+Box&sort=best-match" },
        { label: "Bags & Pouches", href: "/catalog?families=Gift+Bag&sort=best-match" },
        { label: "Filling Tools", href: "/catalog?families=Tool&sort=best-match" },
    ],
} as const;
