export type PortalNavItem = {
    href: string;
    label: string;
    id: string;
    external?: boolean;
};

export type PortalNavSection = {
    label?: string;
    items: PortalNavItem[];
};

/** Primary purchasing paths first; Grace and account are secondary. */
export const PORTAL_NAV: PortalNavSection[] = [
    {
        items: [
            { href: "/portal", label: "Overview", id: "dashboard" },
            { href: "/portal/catalog", label: "Catalog", id: "catalog" },
            { href: "/portal/drafts", label: "Orders", id: "drafts" },
            { href: "/portal/orders", label: "Order history", id: "orders" },
        ],
    },
    {
        label: "Grace",
        items: [
            { href: "/portal/grace", label: "Projects", id: "grace-projects" },
            { href: "/portal/sessions", label: "Sessions", id: "grace" },
            { href: "/grace-workspace", label: "Open Workspace ↗", id: "grace-open", external: true },
        ],
    },
    {
        label: "Account",
        items: [
            { href: "/portal/account", label: "Account", id: "account" },
            { href: "/portal/tax-exemption", label: "Tax Exemption", id: "tax-exemption" },
            { href: "/portal/settings", label: "Profile & Security", id: "settings" },
        ],
    },
];

export const PORTAL_SECTION_LABELS: Record<string, string> = {
    "/portal": "Overview",
    "/portal/catalog": "Catalog",
    "/portal/orders": "Order history",
    "/portal/drafts": "Orders",
    "/portal/tools": "Tools",
    "/portal/grace": "Grace Projects",
    "/portal/sessions": "Grace Sessions",
    "/portal/account": "Account",
    "/portal/tax-exemption": "Tax Exemption",
    "/portal/settings": "Profile & Security",
};

export function portalSectionLabel(pathname: string): string {
    if (PORTAL_SECTION_LABELS[pathname]) return PORTAL_SECTION_LABELS[pathname];
    const match = Object.entries(PORTAL_SECTION_LABELS)
        .filter(([href]) => href !== "/portal" && pathname.startsWith(`${href}/`))
        .sort((a, b) => b[0].length - a[0].length)[0];
    return match?.[1] ?? "Portal";
}

export function isPortalNavActive(pathname: string, href: string): boolean {
    if (href === "/portal") return pathname === "/portal";
    return pathname.startsWith(href);
}

export function orgInitials(name: string): string {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0] ?? "")
        .join("")
        .toUpperCase();
}
