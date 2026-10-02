import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    query: vi.fn(),
    token: vi.fn(() => "test-server-token"),
}));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth, currentUser: vi.fn() }));
vi.mock("@/lib/clerk", () => ({ CLERK_ENABLED: true }));
vi.mock("@/lib/portal/convexClient", () => ({
    getPortalConvex: () => ({ query: mocks.query }),
    getPortalConvexWriteToken: mocks.token,
}));
vi.mock("@/sanity/lib/client", () => ({ isSanityConfigured: false }));
vi.mock("@/sanity/lib/image", () => ({ editorialImageUrl: vi.fn() }));
vi.mock("@/sanity/lib/live", () => ({ sanityFetch: vi.fn() }));
vi.mock("@/lib/catalogServer", () => ({ getCatalogVisibilitySnapshot: vi.fn().mockRejectedValue(new Error("unused")) }));

import { getPortalGraceSession, getPortalGraceSessions } from "../src/lib/portal/server";
import { getWorkspaceRailData } from "../src/lib/grace/workspaceRail";

beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user_verified", orgId: "org_verified" });
    mocks.query.mockResolvedValue([]);
    mocks.token.mockReturnValue("test-server-token");
});

describe("Grace transcript server callers", () => {
    it("passes the server credential and Clerk-resolved scope for portal lists and details", async () => {
        const { viewer, sessions } = await getPortalGraceSessions();
        await getPortalGraceSession("session_fixture");
        const scope = {
            writeToken: "test-server-token", clerkUserId: "user_verified", clerkOrgId: "org_verified",
        };
        expect(mocks.query).toHaveBeenNthCalledWith(1, api.graceSessions.listForViewer, scope);
        expect(mocks.query).toHaveBeenNthCalledWith(2, api.graceSessions.getForViewer, {
            ...scope, sessionId: "session_fixture",
        });
        expect(viewer).toEqual({ clerkUserId: "user_verified", clerkOrgId: "org_verified" });
        expect(sessions).toEqual([]);
    });

    it.each([
        { userId: null, orgId: "org_untrusted" },
        { userId: "user_verified", orgId: null },
    ])("refuses portal reads without an authenticated active organization: %j", async (identity) => {
        mocks.auth.mockResolvedValue(identity);
        await expect(getPortalGraceSessions()).rejects.toThrow();
        await expect(getPortalGraceSession("session_fixture")).rejects.toThrow();
        expect(mocks.query).not.toHaveBeenCalled();
        expect(mocks.token).not.toHaveBeenCalled();
    });

    it.each(["org_verified", null])("authorizes the workspace rail with Clerk scope %s", async (orgId) => {
        mocks.auth.mockResolvedValue({ userId: "user_verified", orgId });
        mocks.query.mockResolvedValue([{ _id: "fixture", title: "Synthetic session", lastMessageAt: 42 }]);
        const rail = await getWorkspaceRailData();
        expect(mocks.query).toHaveBeenCalledWith(api.graceSessions.listForViewer, {
            writeToken: "test-server-token", clerkUserId: "user_verified", clerkOrgId: orgId ?? undefined,
        });
        expect(rail.sessions).toEqual([{ id: "fixture", title: "Synthetic session", lastMessageAt: 42 }]);
        expect(JSON.stringify(rail)).not.toContain("test-server-token");
    });

    it("does not request transcripts for an anonymous workspace visitor", async () => {
        mocks.auth.mockResolvedValue({ userId: null, orgId: null });
        expect((await getWorkspaceRailData()).sessions).toEqual([]);
        expect(mocks.query).not.toHaveBeenCalled();
        expect(mocks.token).not.toHaveBeenCalled();
    });

    it("fails closed when the existing server credential is unavailable", async () => {
        mocks.token.mockImplementation(() => { throw new Error("not configured"); });
        await expect(getPortalGraceSessions()).rejects.toThrow("not configured");
        await expect(getPortalGraceSession("session_fixture")).rejects.toThrow("not configured");
        expect((await getWorkspaceRailData()).sessions).toEqual([]);
        expect(mocks.query).not.toHaveBeenCalled();
    });
});
