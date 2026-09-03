import {
    APPLICATOR_NAV,
    CAPACITY_RANGES,
    FAMILY_ORDER,
    catalogHref,
} from "@/lib/catalogFilters";
import { applicationFinderHref, familyFinderHref } from "@/lib/products/focused-shopping";

export type MegaMenuId = "bottles" | "closures" | "specialty";

export type MegaMenuLink = {
    label: string;
    href: string;
    badge?: string;
};

export type MegaMenuColumn = {
    heading: string;
    links: MegaMenuLink[];
};

export type MegaMenuPanelContent = {
    columns: MegaMenuColumn[];
    featured: {
        title: string;
        subtitle: string;
        href: string;
    };
    footerLinks: MegaMenuLink[];
};

/** Core design families in catalog order — enough for a scan, not the full facet. */
export const MEGA_MENU_BOTTLE_FAMILIES: readonly string[] = FAMILY_ORDER.slice(0, 8);

const glassBottleCatalog = (partial: Parameters<typeof catalogHref>[0] = {}) =>
    catalogHref({ category: "Glass Bottle", ...partial });

const componentCatalog = (partial: Parameters<typeof catalogHref>[0] = {}) =>
    catalogHref({ category: "Component", ...partial });

export const MEGA_MENU_PANELS: Record<MegaMenuId, MegaMenuPanelContent> = {
    bottles: {
        columns: [
            {
                heading: "How it dispenses",
                links: APPLICATOR_NAV.map((nav) => ({
                    label: nav.label,
                    href: applicationFinderHref(nav.value),
                })),
            },
            {
                heading: "Design families",
                links: [
                    ...MEGA_MENU_BOTTLE_FAMILIES.map((family) => ({
                        label: family,
                        href: familyFinderHref(family),
                    })),
                    { label: "View all families", href: glassBottleCatalog() },
                ],
            },
            {
                heading: "Capacity",
                links: CAPACITY_RANGES.map((range) => ({
                    label: `${range.label} — ${range.detail}`,
                    href: glassBottleCatalog({ capacities: [range.value] }),
                })),
            },
        ],
        featured: {
            title: "New: Grace Collection",
            subtitle: "Refined 55 ml silhouette with spray, reducer, and lotion pump options.",
            href: familyFinderHref("Grace"),
        },
        footerLinks: [
            { label: "Browse all bottles", href: glassBottleCatalog() },
            { label: "Build a Bottle", href: "/matrix" },
        ],
    },
    closures: {
        columns: [
            {
                heading: "Closure type",
                links: [
                    { label: "Fine mist sprayers", href: componentCatalog({ componentType: "Sprayer" }) },
                    { label: "Lotion pumps", href: componentCatalog({ componentType: "Lotion Pump" }) },
                    { label: "Droppers", href: componentCatalog({ componentType: "Dropper" }) },
                    { label: "Roll-on fitments", href: componentCatalog({ componentType: "Roll-On" }) },
                    { label: "Reducers", href: componentCatalog({ componentType: "Reducer" }) },
                    { label: "Caps & closures", href: componentCatalog({ componentType: "Cap" }) },
                    { label: "Glass stoppers & rods", href: catalogHref({ applicators: ["glassstopper"] }) },
                ],
            },
            {
                heading: "Pair with a bottle",
                links: [
                    { label: "Build a Bottle", href: "/matrix" },
                    { label: "Roll-On bottles", href: applicationFinderHref("rollon") },
                    { label: "Spray bottles", href: applicationFinderHref("spray") },
                    { label: "Dropper bottles", href: applicationFinderHref("dropper") },
                    { label: "Pump bottles", href: applicationFinderHref("lotionpump") },
                ],
            },
            {
                heading: "Fitment help",
                links: [
                    { label: "Fitment guide", href: "/resources" },
                    { label: "Browse bottles by neck", href: glassBottleCatalog() },
                    { label: "Talk with Grace", href: "/" },
                ],
            },
        ],
        featured: {
            title: "Build a Bottle",
            subtitle: "Choose a bottle, then only the closures that fit its neck.",
            href: "/matrix",
        },
        footerLinks: [
            { label: "All closures & components", href: componentCatalog() },
            { label: "Build a Bottle", href: "/matrix" },
        ],
    },
    specialty: {
        columns: [
            {
                heading: "Unique & artisan",
                links: [
                    { label: "Metal atomizers", href: catalogHref({ families: ["Atomizer"] }) },
                    { label: "Aluminum bottles", href: catalogHref({ category: "Aluminum Bottle" }) },
                    { label: "Plastic spray bottles", href: catalogHref({ families: ["Plastic Bottle"] }) },
                    { label: "Apothecary", href: catalogHref({ families: ["Apothecary"] }) },
                    { label: "Decorative & shaped glass", href: catalogHref({ families: ["Decorative"] }) },
                    { label: "Vintage bulb sprayers", href: catalogHref({ applicators: ["antiquespray", "antiquespray-tassel"] }) },
                ],
            },
            {
                heading: "Skincare & body care",
                links: [
                    { label: "Cream & cosmetic jars", href: catalogHref({ category: "Cream Jar" }) },
                    { label: "Sample vials & testers", href: catalogHref({ families: ["Vial"] }) },
                    { label: "Lotion & serum bottles", href: catalogHref({ families: ["Lotion Bottle"] }) },
                ],
            },
            {
                heading: "Packaging & presentation",
                links: [
                    { label: "Gift bags", href: catalogHref({ families: ["Gift Bag"] }) },
                    { label: "Gift boxes", href: catalogHref({ families: ["Gift Box"] }) },
                    { label: "Packaging supplies", href: catalogHref({ category: "Packaging" }) },
                    { label: "Tools & filling accessories", href: catalogHref({ families: ["Tool"] }) },
                ],
            },
        ],
        featured: {
            title: "Decorative Collection",
            subtitle: "Heart, Tola, Marble, Genie, Eternal Flame, and Pear — artisan shapes.",
            href: catalogHref({ families: ["Decorative"] }),
        },
        footerLinks: [
            { label: "Browse full catalog", href: "/catalog" },
            { label: "Request a custom quote", href: "/contact" },
        ],
    },
};
