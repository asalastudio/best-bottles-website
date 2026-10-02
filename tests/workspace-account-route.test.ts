import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), query: vi.fn(), token: vi.fn(), enabled: true }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/clerk", () => ({ get CLERK_ENABLED() { return mocks.enabled; } }));
vi.mock("@/lib/portal/convexClient", () => ({
    getPortalConvex: () => ({ query: mocks.query }), getPortalConvexWriteToken: mocks.token,
}));
import { GET } from "../src/app/api/grace/workspace-account/route";

beforeEach(() => {
    vi.resetAllMocks();
    mocks.enabled = true;
    mocks.auth.mockResolvedValue({ userId: "user_verified", orgId: "org_verified" });
    mocks.token.mockReturnValue("synthetic-secret");
    mocks.query.mockResolvedValueOnce({ companyName: "Fixture", tier: "Wholesale", billingEmail: "private@example.test" })
        .mockResolvedValueOnce([{ name: "Fixture project", updatedAt: 42, savedBottleCount: 2, savedBottles: ["private notes"] }]);
});

describe("workspace account server boundary", () => {
    it("ignores forged request identity/org IDs and returns only the rail projection", async () => {
        const handler: (request: Request) => ReturnType<typeof GET> = GET;
        const response = await handler(new Request("https://example.test/api/grace/workspace-account?clerkOrgId=org_victim&clerkUserId=user_victim"));
        const scope = { clerkOrgId: "org_verified", writeToken: "synthetic-secret" };
        expect(mocks.query).toHaveBeenNthCalledWith(1, api.portal.getAccountByOrg, scope);
        expect(mocks.query).toHaveBeenNthCalledWith(2, api.portal.listGraceProjectsByOrg, scope);
        expect(await response.json()).toEqual({
            userId: "user_verified", orgId: "org_verified", account: { companyName: "Fixture", tier: "Wholesale" },
            projects: [{ name: "Fixture project", updatedAt: 42, savedBottleCount: 2 }],
        });
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it.each([{ userId: null, orgId: "org_forged" }, { userId: "user_verified", orgId: null }])
    ("does not access Convex without both authenticated user and active org: %j", async identity => {
        mocks.auth.mockResolvedValue(identity);
        expect(await (await GET()).json()).toBeNull();
        expect(mocks.query).not.toHaveBeenCalled();
        expect(mocks.token).not.toHaveBeenCalled();
    });

    it("does not access private data when Clerk is disabled", async () => {
        mocks.enabled = false;
        expect(await (await GET()).json()).toBeNull();
        expect(mocks.auth).not.toHaveBeenCalled();
        expect(mocks.query).not.toHaveBeenCalled();
    });

    it("does not expose credentials/backend errors on failure", async () => {
        mocks.query.mockReset().mockRejectedValue(new Error("backend args: synthetic-secret"));
        const response = await GET();
        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({ error: "Account details are unavailable." });
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    });
});
