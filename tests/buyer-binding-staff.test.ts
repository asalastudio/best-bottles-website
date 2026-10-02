import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const auth = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth, currentUser: () => { throw new Error("cached_currentUser_must_not_be_used"); } }));
import { requireFreshBindingStaff } from "../src/lib/portal/buyer-binding-staff";
import { createBuyerBindingService, type BindingRecord } from "../src/lib/portal/buyer-binding";
import { buyerProof, buyerScope, buyerTarget } from "./fixtures/buyer-binding";

const staffId = "user_fixtureStaff";
const allowed = () => ({ id: staffId, banned: false, locked: false, public_metadata: { role: "support" },
    email_addresses: [{ email_address: "staff@example.test", verification: { status: "verified" } }] });
beforeEach(() => {
    vi.clearAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_CLERK_ENABLED", "true"); vi.stubEnv("CLERK_SECRET_KEY", "sk_live_fixture");
    auth.mockResolvedValue({ userId: staffId });
});

describe("fresh binding staff authority", () => {
    it("uses the authenticated ID and a new memoization-bypassing signal on every check", async () => {
        const request = vi.fn(async () => Response.json(allowed())); vi.stubGlobal("fetch", request);
        expect(await requireFreshBindingStaff()).toEqual({ clerkUserId: staffId });
        await requireFreshBindingStaff();
        expect(request).toHaveBeenCalledTimes(2);
        const calls = request.mock.calls as unknown as [string, RequestInit][];
        for (const [url, options] of calls) {
            expect(url).toBe(`https://api.clerk.com/v1/users/${staffId}`);
            expect(options).toMatchObject({ method: "GET", cache: "no-store", signal: expect.any(AbortSignal) });
        }
        expect(calls[0][1].signal).not.toBe(calls[1][1].signal);
    });
    it.each(["revoked", "orgAdmin", "banned", "locked", "wrongUser", "unverifiedAllowlist", "providerError", "malformed"])("denies %s without provider details", async kind => {
        const user = allowed();
        if (kind === "revoked") user.public_metadata.role = "customer";
        if (kind === "orgAdmin") user.public_metadata.role = "org:admin";
        if (kind === "banned") user.banned = true;
        if (kind === "locked") user.locked = true;
        if (kind === "wrongUser") user.id = "user_someoneElse";
        if (kind === "unverifiedAllowlist") {
            vi.stubEnv("TEAM_HUB_ALLOWED_EMAILS", "staff@example.test");
            user.public_metadata.role = "customer"; user.email_addresses[0].verification.status = "unverified";
        }
        vi.stubGlobal("fetch", vi.fn(async () => kind === "providerError"
            ? new Response("secret-provider-message", { status: 503 }) : Response.json(kind === "malformed" ? {} : user)));
        await expect(requireFreshBindingStaff()).rejects.toThrow(/^staff_access_required$/);
    });
    it("does not fetch without authenticated identity", async () => {
        auth.mockResolvedValue({ userId: null }); const request = vi.fn(); vi.stubGlobal("fetch", request);
        await expect(requireFreshBindingStaff()).rejects.toThrow("staff_access_required"); expect(request).not.toHaveBeenCalled();
    });
    it("blocks persistence when actual provider privileges disappear between initial and final checks", async () => {
        let revoked = false;
        const request = vi.fn(async () => Response.json({ ...allowed(), public_metadata: { role: revoked ? "customer" : "support" } }));
        vi.stubGlobal("fetch", request);
        const record: BindingRecord = { id: "fixture" as BindingRecord["id"], version: 1, state: "proposed", proof: buyerProof };
        const write = vi.fn(async () => record);
        const service = createBuyerBindingService({
            config: { enabled: true, writesEnabled: true, clerkInstanceHost: buyerScope.clerkInstanceHost, shopDomain: buyerScope.shopDomain },
            requireStaff: requireFreshBindingStaff, readViewer: async () => buyerScope,
            readClerkEvidence: async () => ({ clerkUserId: buyerScope.clerkUserId, clerkOrgId: buyerScope.clerkOrgId,
                clerkMembershipId: buyerProof.clerkMembershipId, clerkEmailId: buyerProof.clerkEmailId, verifiedEmail: "buyer@example.test" }),
            readShopifyEvidence: async () => {
                revoked = true;
                return { ...buyerTarget, shopDomain: buyerScope.shopDomain, verifiedEmail: "buyer@example.test",
                    roleAssignmentId: buyerProof.roleAssignmentId, roleId: buyerProof.roleId, roleName: "Ordering only" };
            },
            readBuyerSession: async () => null,
            store: { read: async () => record, propose: write, review: write, revoke: write },
        });
        await expect(service.propose({ clerkUserId: buyerScope.clerkUserId, clerkOrgId: buyerScope.clerkOrgId }, buyerTarget)).rejects.toThrow("staff_access_required");
        expect(request).toHaveBeenCalledTimes(2); expect(write).not.toHaveBeenCalled();
    });
});
