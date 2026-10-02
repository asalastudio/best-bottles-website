import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { filterTeamHubTools, groupTeamHubTools, type TeamHubTool } from "@/lib/teamHub";

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    currentUser: vi.fn(),
    redirectToSignIn: vi.fn(),
    health: vi.fn(),
    queues: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth, currentUser: mocks.currentUser }));
vi.mock("@/lib/executive/platformHealth", () => ({ getPlatformHealthSnapshot: mocks.health }));
vi.mock("@/lib/team/queues", () => ({ getTeamHubQueues: mocks.queues, buildQueueItems: () => [] }));
vi.mock("@/components/auth/SwitchAccountButton", () => ({
    SwitchAccountButton: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));
vi.mock("@/components/team/PlatformStatusCard", () => ({ PlatformStatusCard: () => null }));
vi.mock("@/components/BrandWordmark", () => ({ default: () => <span>Best Bottles</span> }));

import TeamPage from "@/app/team/page";
import TeamHubRail from "@/components/team/TeamHubRail";

const checklistUrl = "https://docs.google.com/spreadsheets/d/1bSbiMrRbjoik5muw_JDbpr8F53nWmLjQruMgX8zte-0/edit";

beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TEAM_HUB_ALLOWED_EMAILS", "");
    mocks.auth.mockResolvedValue({ userId: "user_staff", redirectToSignIn: mocks.redirectToSignIn });
    mocks.currentUser.mockResolvedValue({ publicMetadata: { role: "team" } });
    mocks.redirectToSignIn.mockImplementation(() => { throw new Error("sign-in redirect"); });
    mocks.health.mockResolvedValue({});
    mocks.queues.mockResolvedValue({});
});
afterEach(() => vi.unstubAllEnvs());

describe("Launch Readiness in the authorized Team Hub", () => {
    it.each(["team", "admin"])("renders the exact external checklist link for %s", async (role) => {
        mocks.currentUser.mockResolvedValue({ publicMetadata: { role } });
        const html = renderToStaticMarkup(await TeamPage({}));
        expect(html).toContain(`href="${checklistUrl}" target="_blank" rel="noopener noreferrer"`);
        expect(html).toContain('Launch Readiness<span class="sr-only"> (opens in a new tab)</span>');
        expect(html.match(/Launch Readiness/g)).toHaveLength(1);
        expect(html).not.toContain("<iframe");
    });

    it("keeps the entry searchable in Operations and the URL unchanged in local preview", async () => {
        const page = await TeamPage({});
        const tools: TeamHubTool[] = page.props.tools;
        for (const query of ["launch", "checklist", "Google Sheets"]) {
            const matches = filterTeamHubTools(tools, query);
            expect(matches.map((tool) => tool.name)).toEqual(["Launch Readiness"]);
            expect(groupTeamHubTools(matches).map((group) => group.section.id)).toEqual(["operations"]);
            const html = renderToStaticMarkup(<TeamHubRail tools={matches} previewMode counts={{}} />);
            expect(html).toContain(`href="${checklistUrl}"`);
            expect(html).not.toContain("preview=1");
        }
    });

    it("redirects anonymous visitors before any tools or operational data render, including preview requests", async () => {
        mocks.auth.mockResolvedValue({ userId: null, redirectToSignIn: mocks.redirectToSignIn });
        await expect(TeamPage({ searchParams: Promise.resolve({ preview: "1" }) })).rejects.toThrow("sign-in redirect");
        expect(mocks.redirectToSignIn).toHaveBeenCalledWith({ returnBackUrl: "/team" });
        expect(mocks.currentUser).not.toHaveBeenCalled();
        expect(mocks.health).not.toHaveBeenCalled();
        expect(mocks.queues).not.toHaveBeenCalled();
    });

    it.each([
        { publicMetadata: { role: "customer" } },
        { publicMetadata: {} },
        {
            publicMetadata: { role: "customer" },
            emailAddresses: [{ emailAddress: "jordan@asala.ai", verification: { status: "unverified" } }],
        },
    ])("withholds the entry and URL from accounts without existing team access (%j)", async (user) => {
        mocks.currentUser.mockResolvedValue(user);
        const html = renderToStaticMarkup(await TeamPage({ searchParams: Promise.resolve({ preview: "true" }) }));
        expect(html).toContain("Team Hub access pending");
        expect(html).not.toContain("Launch Readiness");
        expect(html).not.toContain(checklistUrl);
        expect(html).not.toContain("docs.google.com");
        expect(mocks.health).not.toHaveBeenCalled();
        expect(mocks.queues).not.toHaveBeenCalled();
    });
});
