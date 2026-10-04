import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ staff: vi.fn(), org: vi.fn(), list: vi.fn(), query: vi.fn(), mutation: vi.fn(), token: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ clerkClient: async () => ({ organizations: { getOrganization: mocks.org, getOrganizationList: mocks.list } }) }));
vi.mock("@/lib/portal/staff", () => ({ requireStaffViewer: mocks.staff }));
vi.mock("@/lib/portal/convexClient", () => ({ getPortalConvex: () => ({ query: mocks.query, mutation: mocks.mutation }), getPortalConvexWriteToken: mocks.token }));
import { listClerkOrganizationsForStaff, upsertPortalAccountAsStaff } from "../src/lib/portal/accounts";
const input = { clerkOrgId: "org_real", companyName: "Reviewed name", accountNumber: "FIXTURE-1", tier: "Reviewed tier", accountManager: "Reviewed manager", memberSince: "Reviewed date" };
beforeEach(() => {
    vi.resetAllMocks(); mocks.staff.mockResolvedValue({ clerkUserId: "user_staff" });
    mocks.org.mockResolvedValue({ id: "org_real" }); mocks.query.mockResolvedValue([]); mocks.token.mockReturnValue("fixture-token");
});
describe("staff profile reconciliation", () => {
    it("rejects a buyer before reading Clerk organizations or writing Convex", async () => {
        mocks.staff.mockRejectedValue(new Error("staff_access_required"));
        await expect(upsertPortalAccountAsStaff(input)).rejects.toThrow("staff_access_required");
        await expect(listClerkOrganizationsForStaff()).rejects.toThrow("staff_access_required");
        expect(mocks.org).not.toHaveBeenCalled(); expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.mutation).not.toHaveBeenCalled();
    });
    it("verifies the selected organization and sends only reviewed business fields", async () => {
        await upsertPortalAccountAsStaff(input);
        expect(mocks.org).toHaveBeenCalledWith({ organizationId: "org_real" });
        expect(mocks.mutation.mock.calls[0][1]).toEqual({ ...input, billingEmail: undefined, writeToken: "fixture-token" });
    });
    it("refuses deleted and mismatched organizations without creating orphan records", async () => {
        mocks.org.mockRejectedValueOnce(new Error("not found"));
        await expect(upsertPortalAccountAsStaff(input)).rejects.toThrow("not found");
        mocks.org.mockResolvedValueOnce({ id: "org_other" });
        await expect(upsertPortalAccountAsStaff(input)).rejects.toThrow("organization_mismatch");
        expect(mocks.mutation).not.toHaveBeenCalled();
    });
    it("includes existing and unprovisioned organizations beyond the first page", async () => {
        mocks.query.mockResolvedValue([{ clerkOrgId: "org_real" }]);
        mocks.list.mockResolvedValueOnce({ data: Array.from({ length: 100 }, (_, i) => ({ id: `org_${i}`, name: `Other ${i}` })), totalCount: 101 })
            .mockResolvedValueOnce({ data: [{ id: "org_real", name: "Real" }], totalCount: 101 });
        const options = await listClerkOrganizationsForStaff();
        expect(options).toHaveLength(101); expect(options).toContainEqual({ id: "org_real", name: "Real", linked: true });
        expect(mocks.list).toHaveBeenLastCalledWith({ limit: 100, offset: 100 });
    });
});
