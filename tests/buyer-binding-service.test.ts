import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createBuyerBindingService, type BindingRecord, type BuyerSessionProof } from "../src/lib/portal/buyer-binding";
import { buyerProof, buyerScope, buyerTarget } from "./fixtures/buyer-binding";
const subject = { clerkUserId: buyerScope.clerkUserId, clerkOrgId: buyerScope.clerkOrgId };
function setup() {
    let row: BindingRecord | null = { id: "fixtureBinding" as BindingRecord["id"], version: 2, state: "approved", proof: structuredClone(buyerProof) };
    const config = { enabled: true, writesEnabled: true, clerkInstanceHost: buyerScope.clerkInstanceHost, shopDomain: buyerScope.shopDomain };
    const session: BuyerSessionProof = { ...buyerScope, ...buyerTarget, customerAccessToken: "synthetic-private-token", tokenExpiresAt: Date.now() + 60_000, checkedAt: Date.now() };
    const deps = {
        config,
        readViewer: vi.fn(async () => ({ ...buyerScope } as typeof buyerScope | null)),
        requireStaff: vi.fn(async () => ({ clerkUserId: "user_fixtureStaff" })),
        readClerkEvidence: vi.fn(async () => ({ clerkUserId: buyerProof.clerkUserId, clerkOrgId: buyerProof.clerkOrgId,
            clerkMembershipId: buyerProof.clerkMembershipId, clerkEmailId: buyerProof.clerkEmailId, verifiedEmail: "buyer@example.test" })),
        readShopifyEvidence: vi.fn(async () => ({ ...buyerTarget, shopDomain: buyerProof.shopDomain, verifiedEmail: "buyer@example.test",
            roleAssignmentId: buyerProof.roleAssignmentId, roleId: buyerProof.roleId, roleName: buyerProof.roleName })),
        readBuyerSession: vi.fn(async () => session as BuyerSessionProof | null),
        store: {
            read: vi.fn(async () => row && structuredClone(row)),
            propose: vi.fn(async () => ({ ...row!, state: "proposed" as const, version: 1 })),
            review: vi.fn(async () => ({ ...row!, state: "approved" as const, version: 2 })),
            revoke: vi.fn(async () => ({ ...row!, state: "revoked" as const, version: 3 })),
        },
    };
    return { deps, session, service: createBuyerBindingService(deps), setRow: (value: BindingRecord | null) => { row = value; }, getRow: () => row! };
}
beforeEach(() => vi.useRealTimers());
describe("buyer ownership and review composition", () => {
    it("derives proposal actor and provider evidence, without persisting email/token", async () => {
        const s = setup(); await s.service.propose(subject, buyerTarget);
        const args = s.deps.store.propose.mock.calls[0];
        expect(args).toBeDefined();
        expect(s.deps.store.propose).toHaveBeenCalledWith({ proof: buyerProof, checkedAt: expect.any(Number), staffUserId: "user_fixtureStaff" });
        expect(JSON.stringify(args)).not.toMatch(/buyer@example|synthetic-private-token/);
        expect(s.deps.readBuyerSession).not.toHaveBeenCalled();
    });
    it.each(["enabled", "writesEnabled"] as const)("does not read providers or write while %s=false", async key => {
        const s = setup(); s.deps.config[key] = false;
        const service = createBuyerBindingService(s.deps);
        await expect(service.propose(subject, buyerTarget)).rejects.toThrow();
        expect(s.deps.requireStaff).not.toHaveBeenCalled(); expect(s.deps.store.propose).not.toHaveBeenCalled();
    });
    it("requires production Clerk before any reads/writes", async () => {
        const s = setup(); s.deps.config.clerkInstanceHost = "together-lemur-38.clerk.accounts.dev";
        await expect(createBuyerBindingService(s.deps).propose(subject, buyerTarget)).rejects.toThrow();
        expect(s.deps.requireStaff).not.toHaveBeenCalled();
    });
    it("does not accept actor, provider proof or price injected into requests", async () => {
        const s = setup();
        await expect(s.service.propose({ ...subject, staffUserId: "user_fake" }, buyerTarget)).rejects.toThrow();
        await expect(s.service.propose(subject, { ...buyerTarget, roleName: "Ordering only" })).rejects.toThrow();
        expect(s.deps.store.propose).not.toHaveBeenCalled();
    });
    it("rejects a buyer org-admin through the separate staff gate", async () => {
        const s = setup(); s.deps.requireStaff.mockRejectedValue(new Error("staff_access_required"));
        await expect(s.service.propose(subject, buyerTarget)).rejects.toThrow("staff_access_required");
        expect(s.deps.readClerkEvidence).not.toHaveBeenCalled(); expect(s.deps.store.propose).not.toHaveBeenCalled();
    });
    it("rechecks staff after provider reads", async () => {
        const s = setup(); s.deps.requireStaff.mockResolvedValueOnce({ clerkUserId: "user_fixtureStaff" }).mockRejectedValue(new Error("staff_access_required"));
        await expect(s.service.propose(subject, buyerTarget)).rejects.toThrow("staff_access_required");
        expect(s.deps.store.propose).not.toHaveBeenCalled();
    });
    it("requires a new review when the Shopify assignment changes", async () => {
        const s = setup(), row = { ...s.getRow(), state: "proposed" as const, version: 1 }; s.setRow(row);
        s.deps.readShopifyEvidence.mockResolvedValue({ ...await s.deps.readShopifyEvidence(), roleAssignmentId: "gid://shopify/CompanyContactRoleAssignment/99" });
        await expect(s.service.review(subject, row)).rejects.toThrow(); expect(s.deps.store.review).not.toHaveBeenCalled();
    });
    it("reviews an exact fresh proposal and revokes during a Shopify outage", async () => {
        const s = setup(), row = { ...s.getRow(), state: "proposed" as const, version: 1 }; s.setRow(row);
        await s.service.review(subject, row); expect(s.deps.store.review).toHaveBeenCalled();
        s.deps.readShopifyEvidence.mockRejectedValue(new Error("unavailable"));
        await s.service.revoke(subject, row); expect(s.deps.store.revoke).toHaveBeenCalled();
    });
    it("does not approve a stale staff review screen", async () => {
        const s = setup(), expected = { ...s.getRow(), state: "proposed" as const, version: 1 };
        await expect(s.service.review(subject, expected)).rejects.toThrow(); expect(s.deps.store.review).not.toHaveBeenCalled();
    });
});
describe("fresh native pricing/checkout access", () => {
    it("passes only the exact per-user/company/location purchase scope", async () => {
        const s = setup();
        expect(await s.service.loadAccess(buyerTarget.companyLocationId)).toEqual({ status: "approved",
            clerkUserId: buyerScope.clerkUserId, clerkOrgId: buyerScope.clerkOrgId, companyId: buyerTarget.companyId,
            companyContactId: buyerTarget.companyContactId, companyLocationId: buyerTarget.companyLocationId,
            customerAccessToken: s.session.customerAccessToken, tokenExpiresAt: s.session.tokenExpiresAt });
        expect(s.deps.store.read).toHaveBeenCalledTimes(2); expect(s.deps.readViewer).toHaveBeenCalledTimes(2);
    });
    it.each(["proposed", "revoked", "absent"] as const)("blocks %s binding before reading buyer token", async state => {
        const s = setup(); s.setRow(state === "absent" ? null : { ...s.getRow(), state });
        expect((await s.service.loadAccess(buyerTarget.companyLocationId)).status).not.toBe("approved");
        expect(s.deps.readBuyerSession).not.toHaveBeenCalled();
    });
    it("does not grant a different selected location", async () => {
        const s = setup(); expect(await s.service.loadAccess("gid://shopify/CompanyLocation/99")).toEqual({ status: "revoked" });
        expect(s.deps.readBuyerSession).not.toHaveBeenCalled();
    });
    it.each(["clerkUserId", "clerkOrgId", "clerkInstanceHost", "shopDomain", "customerId", "companyId", "companyContactId", "companyLocationId"] as const)("rejects wrong session %s", async field => {
        const s = setup(); s.session[field] = "other";
        expect((await s.service.loadAccess(buyerTarget.companyLocationId)).status).not.toBe("approved");
    });
    it.each(["clerkUserId", "clerkOrgId", "clerkMembershipId", "clerkEmailId", "verifiedEmail"] as const)("blocks a changed Clerk %s", async field => {
        const s = setup(); s.deps.readClerkEvidence.mockResolvedValue({ ...await s.deps.readClerkEvidence(), [field]: "other" });
        expect((await s.service.loadAccess(buyerTarget.companyLocationId)).status).not.toBe("approved");
    });
    it.each(["readClerkEvidence", "readShopifyEvidence", "readBuyerSession"] as const)("fails closed on %s outage without error/token leakage", async dependency => {
        const s = setup(); s.deps[dependency].mockRejectedValue(new Error("provider-error-secret"));
        expect(await s.service.loadAccess(buyerTarget.companyLocationId)).toEqual({ status: "unavailable" });
    });
    it("requires the buyer's own Shopify session even with staff approval and matching emails", async () => {
        const s = setup(); s.deps.readBuyerSession.mockResolvedValue(null);
        expect(await s.service.loadAccess(buyerTarget.companyLocationId)).toEqual({ status: "unavailable" });
    });
    it.each(["expired", "stale", "future", "empty"])("rejects %s session evidence", async kind => {
        const s = setup();
        if (kind === "expired") s.session.tokenExpiresAt = Date.now();
        if (kind === "stale") s.session.checkedAt = Date.now() - 30_001;
        if (kind === "future") s.session.checkedAt = Date.now() + 60_000;
        if (kind === "empty") s.session.customerAccessToken = "";
        expect(await s.service.loadAccess(buyerTarget.companyLocationId)).toEqual({ status: "unavailable" });
    });
    it("detects org switch and revocation during provider requests", async () => {
        const s = setup(); s.deps.readBuyerSession.mockImplementation(async () => {
            s.setRow({ ...s.getRow(), state: "revoked", version: 3 }); return s.session;
        });
        expect(await s.service.loadAccess(buyerTarget.companyLocationId)).toEqual({ status: "revoked" });
        const t = setup(); t.deps.readViewer.mockResolvedValueOnce(buyerScope).mockResolvedValue({ ...buyerScope, clerkOrgId: "org_other" });
        expect(await t.service.loadAccess(buyerTarget.companyLocationId)).toEqual({ status: "revoked" });
    });
    it("does not refresh slow provider evidence by stamping its finish time", async () => {
        vi.useFakeTimers(); const s = setup();
        s.deps.readShopifyEvidence.mockImplementation(async () => { vi.advanceTimersByTime(31_000); return { ...buyerTarget,
            shopDomain: buyerScope.shopDomain, verifiedEmail: "buyer@example.test", roleAssignmentId: buyerProof.roleAssignmentId, roleId: buyerProof.roleId, roleName: "Ordering only" }; });
        expect(await s.service.loadAccess(buyerTarget.companyLocationId)).toEqual({ status: "unavailable" }); vi.useRealTimers();
    });
});
