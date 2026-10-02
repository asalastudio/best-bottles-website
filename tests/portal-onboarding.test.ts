import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), memberships: vi.fn(), mutation: vi.fn(), query: vi.fn(), token: vi.fn(), push: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/clerk", () => ({ CLERK_ENABLED: true }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth, currentUser: vi.fn(), clerkClient: async () => ({ users: { getOrganizationMembershipList: mocks.memberships } }) }));
vi.mock("@/lib/portal/convexClient", () => ({ getPortalConvex: () => ({ mutation: mocks.mutation, query: mocks.query }), getPortalConvexWriteToken: mocks.token }));
vi.mock("@/lib/portal/addressSync", () => ({ pushAddressToShopifyCustomer: mocks.push }));
import { ensurePortalProfileForViewer } from "../src/lib/portal/onboarding";
import { savePortalAddressesForViewer, ensureShopifyCustomerForOrg } from "../src/lib/portal/server";
import { api } from "../convex/_generated/api";
const address = { contactName: "Test Buyer", company: "Fixture", phone: "+15555550123", address1: "1 Test St", address2: "", city: "Test", provinceCode: "CA", zip: "90001", countryCode: "US" };
beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user_verified", orgId: "org_verified" });
    mocks.memberships.mockResolvedValue({ data: [{ organization: { id: "org_verified", name: "Authoritative Name" } }], totalCount: 1 });
    mocks.token.mockReturnValue("fixture-token");
});
describe("portal onboarding server boundary", () => {
    it("uses only session identity and fresh authoritative organization membership", async () => {
        await ensurePortalProfileForViewer();
        expect(mocks.memberships).toHaveBeenCalledWith({ userId: "user_verified", offset: 0, limit: 100 });
        expect(mocks.mutation).toHaveBeenCalledWith(api.portalAccountFoundation.ensurePendingAccount, { writeToken: "fixture-token", clerkOrgId: "org_verified", clerkUserId: "user_verified", companyName: "Authoritative Name" });
    });
    it.each([{ userId: null, orgId: "org_forged" }, { userId: "user_verified", orgId: null }])("does nothing without a complete authenticated identity: %j", async session => {
        mocks.auth.mockResolvedValue(session); expect(await ensurePortalProfileForViewer()).toBeNull();
        expect(mocks.memberships).not.toHaveBeenCalled(); expect(mocks.mutation).not.toHaveBeenCalled();
    });
    it("fails closed for a revoked membership or an unavailable Clerk API", async () => {
        mocks.memberships.mockResolvedValueOnce({ data: [], totalCount: 0 });
        await expect(ensurePortalProfileForViewer()).rejects.toThrow("active_organization_membership_required");
        mocks.memberships.mockRejectedValueOnce(new Error("Clerk unavailable"));
        await expect(ensurePortalProfileForViewer()).rejects.toThrow("Clerk unavailable");
        expect(mocks.mutation).not.toHaveBeenCalled(); expect(mocks.token).not.toHaveBeenCalled();
    });
    it("finds a membership beyond the first hundred", async () => {
        mocks.memberships.mockResolvedValueOnce({ data: Array.from({ length: 100 }, (_, i) => ({ organization: { id: `org_${i}`, name: "Other" } })), totalCount: 101 });
        await ensurePortalProfileForViewer();
        expect(mocks.memberships).toHaveBeenLastCalledWith({ userId: "user_verified", offset: 100, limit: 100 });
        expect(mocks.mutation).toHaveBeenCalledTimes(1);
    });
    it.each([undefined, "123"])("does not activate a Shopify customer for a pending profile with legacy customer %s", async shopifyCustomerId => {
        mocks.query.mockResolvedValue({ profileStatus: "pending", shopifyCustomerId });
        expect(await ensureShopifyCustomerForOrg("org_verified", { fallbackEmail: "buyer@example.test" })).toEqual({ status: "unavailable", reason: "account_review_required" });
        expect(mocks.mutation).not.toHaveBeenCalled();
    });
    it("rejects stale organization forms before attempting any write", async () => {
        const result = await savePortalAddressesForViewer({ shippingAddress: address, expectedOrgId: "org_previous", expectedVersion: 0, requestId: "request_a_0001" });
        expect(result.ok).toBe(false); expect(result.message).toContain("organization changed");
        expect(mocks.mutation).not.toHaveBeenCalled();
    });
    it("rechecks current membership for every address save and fails closed on revocation", async () => {
        mocks.memberships.mockResolvedValueOnce({ data: [], totalCount: 0 });
        await expect(savePortalAddressesForViewer({ shippingAddress: address, expectedOrgId: "org_verified", expectedVersion: 0, requestId: "request_a_0001" })).rejects.toThrow("active_organization_membership_required");
        expect(mocks.mutation).not.toHaveBeenCalled();
    });
    it("rejects missing preconditions and returns an actionable conflict without retrying", async () => {
        const input = { shippingAddress: address, expectedOrgId: "org_verified", expectedVersion: 0, requestId: "request_a_0001" };
        expect((await savePortalAddressesForViewer({ ...input, expectedVersion: Number.NaN })).ok).toBe(false);
        expect(mocks.mutation).not.toHaveBeenCalled();
        mocks.mutation.mockRejectedValueOnce(new Error("address_version_conflict"));
        const result = await savePortalAddressesForViewer(input);
        expect(result.ok).toBe(false); expect(result.message).toContain("Reload and review");
        expect(mocks.mutation).toHaveBeenCalledTimes(1); expect(mocks.query).not.toHaveBeenCalled();
    });
    it.each([undefined, "123"])("reports a local save honestly with customer %s and never overwrites Shopify", async shopifyCustomerId => {
        mocks.query.mockResolvedValue({ shopifyCustomerId });
        const result = await savePortalAddressesForViewer({ shippingAddress: address, expectedOrgId: "org_verified", expectedVersion: 0, requestId: "request_a_0001" });
        expect(result).toMatchObject({ ok: true });
        expect(result.shopifyWarning).toContain(shopifyCustomerId ? "review is pending" : "linking is pending");
        expect(mocks.mutation).toHaveBeenCalledWith(api.portal.saveAccountAddress, expect.objectContaining({ clerkOrgId: "org_verified", clerkUserId: "user_verified", shippingAddress: address }));
        expect(mocks.push).not.toHaveBeenCalled();
    });
});
