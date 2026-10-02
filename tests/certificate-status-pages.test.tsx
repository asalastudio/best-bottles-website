import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ dashboard: vi.fn(), account: vi.fn(), shell: vi.fn(), certificates: vi.fn(), accounts: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/components/portal/CertificateStatusRefresh", () => ({ default: () => null }));
vi.mock("@/components/portal/PortalAddressForm", () => ({ default: () => null }));
vi.mock("@/components/portal/PortalAccountForm", () => ({ default: () => null }));
vi.mock("@/components/portal/ResaleCertificateForm", () => ({ default: () => null }));
vi.mock("@/lib/portal/server", () => ({ getPortalDashboardData: mocks.dashboard, getPortalAccountData: mocks.account, getPortalAddresses: async () => ({}), getPortalShellData: mocks.shell }));
vi.mock("@/lib/portal/certificates", () => ({ getCertificatesForViewer: mocks.certificates }));
vi.mock("@/lib/portal/accounts", () => ({ listPortalAccountsForStaff: mocks.accounts, listClerkOrganizationsForStaff: async () => [] }));
vi.mock("../src/app/(portal)/portal/actions", () => ({ saveAddressAction: vi.fn(), createDraftAction: vi.fn(), createCertificateUploadUrlAction: vi.fn(), submitCertificateAction: vi.fn(), validateCertificateUploadAction: vi.fn() }));
vi.mock("../src/app/team/portal-accounts/actions", () => ({ upsertPortalAccountAction: vi.fn() }));
import Dashboard from "../src/app/(portal)/portal/page";
import Account from "../src/app/(portal)/portal/account/page";
import Certificates from "../src/app/(portal)/portal/tax-exemption/page";
import TeamAccounts from "../src/app/team/portal-accounts/page";
const account = { _id: "fixture", clerkOrgId: "org_fixture", companyName: "Fixture", accountNumber: "TEST-1", tier: "test", accountManager: "Test", memberSince: "2026", taxExempt: false, certificateTaxStatus: "sync_pending" };
beforeEach(() => {
    mocks.dashboard.mockResolvedValue({ account, stats: { ytdSpend: 0, activeOrderCount: 0, inTransitCount: 0, unitsInFlight: 0, openDraftCount: 0 }, activeOrders: [], recentOrders: [], drafts: [], quickReorder: [] });
    mocks.account.mockResolvedValue({ account, orders: [] }); mocks.shell.mockResolvedValue({ account }); mocks.accounts.mockResolvedValue([account]);
    const cert = { _id: "cert", status: "approved", permitNumber: "TEST", issuingState: "CA", submittedAt: 1, legalBusinessName: "Fixture" };
    mocks.certificates.mockResolvedValue({ active: cert, certificates: [cert], asOf: 100 });
});
describe("consistent customer/staff status rendering", () => {
    it("all four views distinguish approval from checkout exemption", async () => {
        for (const view of [await Dashboard(), await Account(), await Certificates(), await TeamAccounts()]) {
            const html = renderToStaticMarkup(view);
            expect(html.toLowerCase()).toContain("sync pending");
            expect(html).not.toContain(">Tax Exempt<");
            expect(html).not.toContain(">Taxable<");
        }
        expect(renderToStaticMarkup(await Certificates())).not.toContain("has been notified");
        expect(renderToStaticMarkup(await TeamAccounts())).toContain("/team/resale-certificates?org=org_fixture");
    });
});
