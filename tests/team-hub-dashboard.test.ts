import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
    TEAM_HUB_SECTIONS,
    buildTeamHubTools,
    filterTeamHubTools,
    groupTeamHubTools,
    teamHubSectionLabel,
    teamPreviewHref,
} from "@/lib/teamHub";

describe("Team Hub dashboard catalog", () => {
    const tools = buildTeamHubTools({
        shopifyAdminHref: "https://admin.shopify.com/store/best-bottles",
        madisonStudioHref: "https://app.madisonstudio.io",
    });

    it("keeps every staff surface in a named operations group", () => {
        expect(TEAM_HUB_SECTIONS.map((section) => section.id)).toEqual([
            "operations",
            "customers",
            "catalog",
            "knowledge",
            "systems",
        ]);

        const grouped = groupTeamHubTools(tools);
        expect(grouped.map((group) => group.section.id)).toEqual([
            "operations",
            "customers",
            "catalog",
            "knowledge",
            "systems",
        ]);
        expect(grouped.every((group) => group.tools.length > 0)).toBe(true);
    });

    it("puts daily queue work first and systems last", () => {
        expect(tools[0]?.name).toBe("Certificate Review Queue");
        expect(tools[0]?.href).toBe("/team/resale-certificates");
        expect(tools.some((tool) => tool.name === "Wholesale Accounts" && tool.href === "/team/portal-accounts")).toBe(true);
        expect(tools.at(-1)?.name).toBe("Vercel");
    });

    it("keeps the required staff destinations", () => {
        const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));

        expect(byName["Best Bottles Packaging Studio"]?.href).toBe("https://best-bottles-packaging-studio.vercel.app/");
        expect(byName["Backend Shopify Admin"]?.href).toContain("https://admin.shopify.com");
        expect(byName["Executive Hub"]?.href).toBe("/executive");
        expect(byName["Grace Workspace"]?.href).toBe("/grace-workspace");
    });

    it("never offers the customer portal to staff", () => {
        // /portal is the CUSTOMER's surface. Staff hold no account on it, so
        // listing it in the rail invited people to try a door that is not
        // theirs — and implied the team administers customers from inside
        // their own portal, which is not how any of it works. Staff manage
        // wholesale customers from /team/portal-accounts and Shopify.
        expect(tools.map((tool) => tool.href)).not.toContain("/portal");
        expect(tools.map((tool) => tool.name)).not.toContain("B2B Portal Admin");
        expect(tools.some((tool) => tool.href === "/team/portal-accounts")).toBe(true);
    });

    it("opens internal hubs in-place and marks third-party tools as external", () => {
        const internal = tools.filter((tool) => !tool.external).map((tool) => tool.href);
        const external = tools.filter((tool) => tool.external).map((tool) => tool.name);

        expect(internal).toEqual([
            "/team/resale-certificates",
            "/team/portal-accounts",
            "/team/products/new",
            "/team/asset-ledger",
            "/studio",
            "/executive",
            "/grace-workspace",
        ]);
        expect(external).toEqual([
            "Backend Shopify Admin",
            "Madison Studio",
            "Best Bottles Packaging Studio",
            "Vercel",
        ]);
    });

    it("does not expose the Convex Dashboard", () => {
        expect(tools.some((tool) => tool.name.includes("Convex") || tool.href.includes("dashboard.convex.dev"))).toBe(false);
    });

    it("filters the directory without dropping a matching group", () => {
        const matches = filterTeamHubTools(tools, "certificate");
        expect(matches.map((tool) => tool.name)).toEqual(["Certificate Review Queue"]);
        expect(groupTeamHubTools(matches).map((group) => group.section.id)).toEqual(["operations"]);
    });

    it("keeps preview links on the full Team Hub path", () => {
        expect(teamPreviewHref("/team/products/new", true)).toBe("/team/products/new?preview=1");
        expect(teamPreviewHref("/team/products/new", false)).toBe("/team/products/new");
        expect(teamPreviewHref("/portal", true)).toBe("/portal");
    });

    it("renders every tool from the server, not from a client-only directory", () => {
        // Tools live in TeamHubChrome's rail (desktop) and drawer (phone).
        // The rail is a client component for its search box, but Next still
        // server-renders its markup, so the links are in the HTML without JS.
        const rail = readFileSync(resolve(process.cwd(), "src/components/team/TeamHubRail.tsx"), "utf8");
        expect(rail).toContain("{tool.name}");
        expect(rail).toContain("groupTeamHubTools");
        expect(rail).toContain("Today");

        const chrome = readFileSync(resolve(process.cwd(), "src/components/team/TeamHubChrome.tsx"), "utf8");
        expect(chrome).toContain("TeamHubRail");
        expect(chrome).toContain("Open Team Hub menu");

        const dashboard = readFileSync(resolve(process.cwd(), "src/components/team/TeamHubDashboard.tsx"), "utf8");
        expect(dashboard).not.toContain("TeamHubRail");
        expect(dashboard).not.toContain("TeamHubDirectory");
        // The dashboard itself must stay a server component so the queue
        // counts are read on the server and never shipped as a client fetch.
        expect(dashboard).not.toContain('"use client"');
    });

    it("labels phone-header desks from the path", () => {
        expect(teamHubSectionLabel("/team")).toBe("Today");
        expect(teamHubSectionLabel("/team/products/new")).toBe("Create Products");
        expect(teamHubSectionLabel("/team/resale-certificates")).toBe("Certificates");
        expect(teamHubSectionLabel("/team/portal-accounts")).toBe("Wholesale Accounts");
        expect(teamHubSectionLabel("/team/asset-ledger")).toBe("Asset Ledger");
    });

    it("wraps staff desks in Team Hub chrome so operators never drop out", () => {
        const pages = [
            "src/app/team/page.tsx",
            "src/app/team/products/new/page.tsx",
            "src/app/team/resale-certificates/page.tsx",
            "src/app/team/portal-accounts/page.tsx",
            "src/app/team/asset-ledger/page.tsx",
        ];
        for (const page of pages) {
            expect(readFileSync(resolve(process.cwd(), page), "utf8")).toContain("TeamHubShell");
        }
    });
});
