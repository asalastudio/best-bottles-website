import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isPortalNavActive, orgInitials, portalSectionLabel } from "@/components/portal/nav";

const read = (path: string) => readFileSync(path, "utf8");

describe("portal mobile shell", () => {
    it("labels sections and initials without depending on the desktop rail", () => {
        expect(portalSectionLabel("/portal")).toBe("Overview");
        expect(portalSectionLabel("/portal/settings/security")).toBe("Profile & Security");
        expect(portalSectionLabel("/portal/tax-exemption")).toBe("Tax Exemption");
        expect(isPortalNavActive("/portal", "/portal")).toBe(true);
        expect(isPortalNavActive("/portal/orders/BB-1", "/portal/orders")).toBe(true);
        expect(isPortalNavActive("/portal/orders", "/portal")).toBe(false);
        expect(orgInitials("ASALA Studio")).toBe("AS");
    });

    it("uses a phone chrome instead of a squeezed 220px sidebar", () => {
        const layout = read("src/app/(portal)/layout.tsx");
        const chrome = read("src/components/portal/PortalChrome.tsx");
        const css = read("src/components/portal/PortalChrome.module.css");
        const tabs = read("src/components/mobile/MobileTabBar.tsx");
        const globals = read("src/app/globals.css");
        expect(layout).toContain("PortalChrome");
        expect(layout).not.toContain("PortalSidebar");
        expect(chrome).toContain("data-portal-shell");
        expect(chrome).toContain("Open portal menu");
        expect(css).toContain(".mobileBar");
        expect(css).toContain(".drawer");
        expect(css).toContain("@media (min-width: 1024px)");
        expect(css).toContain("width: 220px");
        expect(tabs).toContain('pathname.startsWith("/portal")');
        expect(globals).toContain("body:has([data-portal-shell]) [data-mobile-tab-bar]");
        expect(globals).toContain("[data-portal-table-row]");
    });

    it("stacks the overview and list pages on phones", () => {
        const overview = read("src/app/(portal)/portal/page.tsx");
        const orders = read("src/app/(portal)/portal/orders/page.tsx");
        const drafts = read("src/app/(portal)/portal/drafts/page.tsx");
        expect(overview).toContain("grid-cols-2");
        expect(overview).toContain("lg:grid-cols-4");
        expect(overview).toContain("lg:grid-cols-[1.5fr_1fr]");
        expect(overview).toContain("Welcome back, {companyName}");
        expect(orders).toContain("data-portal-table-row");
        expect(drafts).toContain("data-portal-table-row");
        expect(drafts).toContain('data-label="Name"');
    });
});
