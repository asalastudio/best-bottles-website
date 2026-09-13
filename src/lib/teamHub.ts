export const TEAM_HUB_SECTIONS = [
    {
        id: "operations",
        label: "Operations",
        description: "Queues that need a person today — tax, accounts, and incoming work.",
    },
    {
        id: "customers",
        label: "Customers",
        description: "Wholesale relationships and the storefront they buy from.",
    },
    {
        id: "catalog",
        label: "Catalog & imagery",
        description: "Product truth, photography, and the surfaces that publish it.",
    },
    {
        id: "knowledge",
        label: "Knowledge",
        description: "Grace and the executive view of the business.",
    },
    {
        id: "systems",
        label: "Systems",
        description: "Infrastructure the rest of the hub depends on.",
    },
] as const;

export type TeamHubSectionId = (typeof TEAM_HUB_SECTIONS)[number]["id"];

export type TeamHubSection = (typeof TEAM_HUB_SECTIONS)[number];

export type TeamHubTool = {
    name: string;
    href: string;
    description: string;
    badge: string;
    section: TeamHubSectionId;
    external?: boolean;
    quick?: boolean;
};

type TeamHubHrefDeps = {
    shopifyAdminHref: string;
    madisonStudioHref: string;
};

export function buildTeamHubTools({ shopifyAdminHref, madisonStudioHref }: TeamHubHrefDeps): TeamHubTool[] {
    return [
        {
            name: "Certificate Review Queue",
            href: "/team/resale-certificates",
            description: "Approve or reject wholesale resale certificates. Approving removes sales tax for that account.",
            badge: "Tax",
            section: "operations",
            quick: true,
        },
        {
            name: "Wholesale Accounts",
            href: "/team/portal-accounts",
            description: "Create and edit the accounts behind each wholesale customer — pricing tier, terms, billing email.",
            badge: "B2B",
            section: "operations",
            quick: true,
        },
        {
            name: "B2B Portal Admin",
            href: "/portal",
            description: "Customer accounts, draft quotes, and order tracking.",
            badge: "B2B",
            section: "customers",
            quick: true,
        },
        {
            name: "Create Products",
            href: "/team/products/new",
            description: "Add a catalog product using the live PDP fields, then sync to Shopify and the paper-doll ledger when the family supports it.",
            badge: "Catalog",
            section: "catalog",
            quick: true,
        },
        {
            name: "Visual Asset Ledger",
            href: "/team/asset-ledger",
            description: "Every SKU with the state of its hero, plate and kit imagery, read from every store at once.",
            badge: "Imagery",
            section: "catalog",
        },
        {
            name: "Sanity Studio",
            href: "/studio",
            description: "Edit homepage, journal articles, and product copy. Click any text in Presentation to edit it live.",
            badge: "CMS",
            section: "catalog",
        },
        {
            name: "Executive Hub",
            href: "/executive",
            description: "Business overview and Grace operations. Separate access list from the Team Hub.",
            badge: "Exec",
            section: "knowledge",
        },
        {
            name: "Grace Workspace",
            href: "/grace-workspace",
            description: "Staff see the employee knowledge workspace — ask Grace across live product truth, fitments, policies and operations, and feed her new sources.",
            badge: "Grace",
            section: "knowledge",
        },
        {
            name: "Backend Shopify Admin",
            href: shopifyAdminHref,
            description: "Open the Shopify backend for orders, inventory, refunds, and product publishing.",
            badge: "Storefront",
            section: "customers",
            external: true,
        },
        {
            name: "Madison Studio",
            href: madisonStudioHref,
            description: "Generate and refine Best Bottles product photography.",
            badge: "Image Studio",
            section: "catalog",
            external: true,
        },
        {
            name: "Best Bottles Packaging Studio",
            href: "https://best-bottles-packaging-studio.vercel.app/",
            description: "Create and review Best Bottles packaging layouts and studio assets.",
            badge: "Packaging",
            section: "catalog",
            external: true,
        },
        {
            name: "Vercel",
            href: "https://vercel.com/asala/best-bottles-website",
            description: "Deploys, environment variables, and analytics.",
            badge: "Infrastructure",
            section: "systems",
            external: true,
        },
    ];
}

export function filterTeamHubTools(tools: readonly TeamHubTool[], query: string): TeamHubTool[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [...tools];

    return tools.filter((tool) => {
        const haystack = [tool.name, tool.description, tool.badge, tool.section].join(" ").toLowerCase();
        return haystack.includes(normalized);
    });
}

export function groupTeamHubTools(tools: readonly TeamHubTool[]): Array<{ section: TeamHubSection; tools: TeamHubTool[] }> {
    return TEAM_HUB_SECTIONS
        .map((section) => ({
            section,
            tools: tools.filter((tool) => tool.section === section.id),
        }))
        .filter((group) => group.tools.length > 0);
}

export function getShopifyAdminHref() {
    const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN
        ?.trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");

    if (!domain) return "https://admin.shopify.com";

    const storeHandle = domain.replace(/\.myshopify\.com$/i, "").split(".")[0];
    return storeHandle ? `https://admin.shopify.com/store/${storeHandle}` : "https://admin.shopify.com";
}

export function getMadisonStudioHref() {
    return process.env.NEXT_PUBLIC_MADISON_STUDIO_URL?.trim() || "https://app.madisonstudio.io";
}
