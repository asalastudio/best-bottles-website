import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
    TEAM_HUB_SECTIONS,
    buildTeamHubTools,
    filterTeamHubTools,
    groupTeamHubTools,
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
        expect(byName["B2B Portal Admin"]?.href).toBe("/portal");
    });

    it("opens internal hubs in-place and marks third-party tools as external", () => {
        const internal = tools.filter((tool) => !tool.external).map((tool) => tool.href);
        const external = tools.filter((tool) => tool.external).map((tool) => tool.name);

        expect(internal).toEqual([
            "/team/resale-certificates",
            "/team/portal-accounts",
            "/portal",
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

    it("server-renders the tool cards instead of a client-only directory", () => {
        const dashboard = readFileSync(resolve(process.cwd(), "src/components/team/TeamHubDashboard.tsx"), "utf8");
        expect(dashboard).toContain('data-testid="team-hub-cards"');
        expect(dashboard).toContain("{tool.name}");
        expect(dashboard).not.toContain("TeamHubDirectory");
    });
});
