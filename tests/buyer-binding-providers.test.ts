import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const clerk = vi.hoisted(() => ({ users: { getUser: vi.fn(), getOrganizationMembershipList: vi.fn() } }));
vi.mock("@clerk/nextjs/server", () => ({ clerkClient: async () => clerk, auth: vi.fn(), currentUser: vi.fn() }));
vi.mock("../src/lib/portal/convexClient", () => ({ getPortalConvex: vi.fn(), getPortalConvexWriteToken: vi.fn() }));
import { normalizeBuyerOwnership, readClerkBuyerEvidence, readShopifyBuyerEvidence, createServerBuyerBindings } from "../src/lib/portal/buyer-binding-providers";
import { buyerProof, buyerScope, buyerTarget } from "./fixtures/buyer-binding";
function payload() {
    return { shop: { myshopifyDomain: buyerProof.shopDomain }, customer: {
        id: buyerTarget.customerId, verifiedEmail: true, defaultEmailAddress: { emailAddress: "buyer@example.test" },
        companyContactProfiles: [{ id: buyerTarget.companyContactId, customer: { id: buyerTarget.customerId }, company: { id: buyerTarget.companyId },
            roleAssignments: { nodes: [{ id: buyerProof.roleAssignmentId, role: { id: buyerProof.roleId, name: "Ordering only" },
                companyLocation: { id: buyerTarget.companyLocationId, company: { id: buyerTarget.companyId } } }], pageInfo: { hasNextPage: false } } }],
    } };
}
beforeEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Shopify ownership proof", () => {
    it("normalizes the verified pilot tuple without retrieving address/order data", () => {
        expect(normalizeBuyerOwnership(payload(), buyerTarget, buyerScope.shopDomain)).toEqual({ ...buyerTarget,
            shopDomain: buyerScope.shopDomain, verifiedEmail: "buyer@example.test", roleAssignmentId: buyerProof.roleAssignmentId,
            roleId: buyerProof.roleId, roleName: "Ordering only" });
    });
    it.each(["wrongShop", "wrongCustomer", "wrongContactCustomer", "wrongCompany", "wrongLocationCompany", "unknownRole", "removedRole", "ambiguousRole", "truncatedRoles", "unverifiedEmail", "duplicateContact"])("rejects %s", kind => {
        const raw = payload(), contact = raw.customer.companyContactProfiles[0], assignment = contact.roleAssignments.nodes[0];
        if (kind === "wrongShop") raw.shop.myshopifyDomain = "other.myshopify.com";
        if (kind === "wrongCustomer") raw.customer.id = "gid://shopify/Customer/99";
        if (kind === "wrongContactCustomer") contact.customer.id = "gid://shopify/Customer/99";
        if (kind === "wrongCompany") contact.company.id = "gid://shopify/Company/99";
        if (kind === "wrongLocationCompany") assignment.companyLocation.company.id = "gid://shopify/Company/99";
        if (kind === "unknownRole") assignment.role.name = "Location admin";
        if (kind === "removedRole") contact.roleAssignments.nodes = [];
        if (kind === "ambiguousRole") contact.roleAssignments.nodes.push(assignment);
        if (kind === "truncatedRoles") contact.roleAssignments.pageInfo.hasNextPage = true;
        if (kind === "unverifiedEmail") raw.customer.verifiedEmail = false;
        if (kind === "duplicateContact") raw.customer.companyContactProfiles.push(contact);
        expect(() => normalizeBuyerOwnership(raw, buyerTarget, buyerScope.shopDomain)).toThrow();
    });
    it("pins the read API and disables caching; never issues a mutation", async () => {
        vi.stubEnv("SHOPIFY_ADMIN_TOKEN", "fixture-admin-token");
        const request = vi.fn(async () => Response.json({ data: payload() })); vi.stubGlobal("fetch", request);
        await readShopifyBuyerEvidence(buyerTarget, buyerScope.shopDomain);
        expect(request).toHaveBeenCalledWith(`https://${buyerScope.shopDomain}/admin/api/2026-04/graphql.json`, expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }));
        const options = (request.mock.calls as unknown as [string, RequestInit][])[0][1];
        expect(JSON.parse(options.body as string)).toMatchObject({ variables: { customerId: buyerTarget.customerId } });
        expect(options.body).not.toMatch(/mutation|orders|address|taxExempt/);
    });
    it("does not surface token-bearing upstream errors", async () => {
        vi.stubEnv("SHOPIFY_ADMIN_TOKEN", "fixture-admin-token");
        vi.stubGlobal("fetch", vi.fn(async () => Response.json({ errors: [{ message: "private-token" }] })));
        await expect(readShopifyBuyerEvidence(buyerTarget, buyerScope.shopDomain)).rejects.toThrow("buyer_provider_unavailable");
    });
});
describe("Clerk ownership proof", () => {
    function user() { return { id: buyerScope.clerkUserId, banned: false, locked: false, primaryEmailAddressId: buyerProof.clerkEmailId,
        emailAddresses: [{ id: buyerProof.clerkEmailId, emailAddress: "buyer@example.test", verification: { status: "verified" } }] }; }
    it("paginates current memberships and never treats org:admin as staff permission", async () => {
        clerk.users.getUser.mockResolvedValue(user());
        clerk.users.getOrganizationMembershipList.mockResolvedValueOnce({ data: Array.from({ length: 100 }, (_, i) => ({ organization: { id: `org_other${i}` } })), totalCount: 101 })
            .mockResolvedValueOnce({ data: [{ id: buyerProof.clerkMembershipId, role: "org:admin", organization: { id: buyerScope.clerkOrgId } }], totalCount: 101 });
        expect(await readClerkBuyerEvidence(buyerScope)).toMatchObject({ clerkMembershipId: buyerProof.clerkMembershipId, verifiedEmail: "buyer@example.test" });
        expect(clerk.users.getOrganizationMembershipList).toHaveBeenLastCalledWith({ userId: buyerScope.clerkUserId, limit: 100, offset: 100 });
    });
    it.each(["banned", "locked", "unverified", "removedMembership"])("denies %s", async kind => {
        const raw = user(); if (kind === "banned") raw.banned = true; if (kind === "locked") raw.locked = true;
        if (kind === "unverified") raw.emailAddresses[0].verification.status = "unverified";
        clerk.users.getUser.mockResolvedValue(raw); clerk.users.getOrganizationMembershipList.mockResolvedValue({ data: [], totalCount: 0 });
        await expect(readClerkBuyerEvidence(buyerScope)).rejects.toThrow();
    });
    it("blocks a dev/live key mismatch before any binding access", async () => {
        vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fixture"); vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
        const service = createServerBuyerBindings({ enabled: true, writesEnabled: true, clerkInstanceHost: buyerScope.clerkInstanceHost, shopDomain: buyerScope.shopDomain }, async () => null);
        expect(await service.loadAccess(buyerTarget.companyLocationId)).toEqual({ status: "unavailable" });
        expect(clerk.users.getUser).not.toHaveBeenCalled();
    });
});
