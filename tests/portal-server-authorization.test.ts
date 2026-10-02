import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), query: vi.fn(), token: vi.fn(), staff: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth, currentUser: vi.fn(), clerkClient: vi.fn() }));
vi.mock("@/lib/clerk", () => ({ CLERK_ENABLED: true }));
vi.mock("@/lib/portal/staff", () => ({ requireStaffViewer: mocks.staff }));
vi.mock("@/lib/portal/convexClient", () => ({
    getPortalConvex: () => ({ query: mocks.query }), getPortalConvexWriteToken: mocks.token,
}));
import {
    getPortalAddresses, getPortalShellData, getPortalDashboardData, getPortalOrdersData,
    getPortalOrder, getPortalAccountData, getPortalDraftsData, getPortalGraceWorkspace,
} from "../src/lib/portal/server";
import { getDraftForViewer } from "../src/lib/portal/draftEditor";
import { listPortalAccountsForStaff } from "../src/lib/portal/accounts";
import { getTeamHubQueues } from "../src/lib/team/queues";

import { getCertificatesForViewer, listAllCertificatesForStaff, listPendingCertificatesForStaff } from "../src/lib/portal/certificates";

const customerReads = [
    getCertificatesForViewer, getPortalAddresses, getPortalShellData, getPortalDashboardData, getPortalOrdersData,
    () => getPortalOrder("order_fixture"), getPortalAccountData, getPortalDraftsData,
    () => getPortalGraceWorkspace(), () => getDraftForViewer("draft_fixture"),
];
beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user_verified", orgId: "org_verified" });
    mocks.query.mockResolvedValue([]);
    mocks.token.mockReturnValue("synthetic-token");
    mocks.staff.mockResolvedValue({ clerkUserId: "user_staff" });
});

describe("portal server authorization", () => {
    it("passes only the Clerk-derived organization and server credential to customer reads", async () => {
        for (const read of customerReads) await read();
        expect(mocks.query).toHaveBeenCalledTimes(12);
        for (const [, args] of mocks.query.mock.calls) {
            expect(args).toMatchObject({ clerkOrgId: "org_verified", writeToken: "synthetic-token" });
        }
    });

    it.each([{ userId: null, orgId: "org_forged" }, { userId: "user_verified", orgId: null }])
    ("never queries customer records without authenticated membership: %j", async identity => {
        mocks.auth.mockResolvedValue(identity);
        await Promise.allSettled(customerReads.map(read => read()));
        expect(mocks.query).not.toHaveBeenCalled();
        expect(mocks.token).not.toHaveBeenCalled();
    });

    it("preserves the staff gates before all-account and queue reads", async () => {
        await listPortalAccountsForStaff();
        await getTeamHubQueues();
        mocks.query.mockResolvedValue({ certificates: [], counts: {} });
        await listAllCertificatesForStaff();
        await listPendingCertificatesForStaff();
        expect(mocks.staff).toHaveBeenCalledTimes(4);
        expect(mocks.query).toHaveBeenNthCalledWith(1, api.portal.listPortalAccounts, { writeToken: "synthetic-token" });
        expect(mocks.query).toHaveBeenNthCalledWith(2, api.portal.getTeamHubQueues, { writeToken: "synthetic-token" });
        expect(mocks.query).toHaveBeenNthCalledWith(3, api.resaleCertificates.listAllCertificates, { writeToken: "synthetic-token" });
        expect(mocks.query).toHaveBeenNthCalledWith(4, api.resaleCertificates.listPendingCertificates, { writeToken: "synthetic-token" });
    });

    it("does not pass the server credential for nonstaff callers of staff-wide reads", async () => {
        mocks.staff.mockRejectedValue(new Error("staff_access_required"));
        await expect(listPortalAccountsForStaff()).rejects.toThrow("staff_access_required");
        await expect(getTeamHubQueues()).rejects.toThrow("staff_access_required");
        await expect(listAllCertificatesForStaff()).rejects.toThrow("staff_access_required");
        await expect(listPendingCertificatesForStaff()).rejects.toThrow("staff_access_required");
        expect(mocks.query).not.toHaveBeenCalled();
        expect(mocks.token).not.toHaveBeenCalled();
    });
});
