import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ dashboard: vi.fn(), account: vi.fn(), shell: vi.fn(), certificates: vi.fn(), accounts: vi.fn(), queue: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/portal/onboarding", () => ({ ensurePortalProfileForViewer: vi.fn(), ensurePortalProfileForViewerSafely: vi.fn(async () => "ok") }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/components/portal/CertificateStatusRefresh", () => ({ default: () => null }));
vi.mock("@/components/portal/PortalAddressForm", () => ({ default: () => null }));
vi.mock("@/components/portal/PortalAccountForm", () => ({ default: () => null }));
vi.mock("@/components/portal/ResaleCertificateForm", () => ({ default: () => null }));
vi.mock("@/lib/portal/server", () => ({ getPortalDashboardData: mocks.dashboard, getPortalAccountData: mocks.account, getPortalAddresses: async () => ({}), getPortalShellData: mocks.shell }));
vi.mock("@/lib/portal/certificates", () => ({ getCertificatesForViewer: mocks.certificates, listAllCertificatesForStaff: mocks.queue }));
vi.mock("@/lib/portal/accounts", () => ({ listPortalAccountsForStaff: mocks.accounts, listClerkOrganizationsForStaff: async () => [] }));
vi.mock("../src/app/(portal)/portal/actions", () => ({ saveAddressAction: vi.fn(), createDraftAction: vi.fn(), createCertificateUploadUrlAction: vi.fn(), submitCertificateAction: vi.fn(), validateCertificateUploadAction: vi.fn() }));
vi.mock("../src/app/team/portal-accounts/actions", () => ({ upsertPortalAccountAction: vi.fn() }));
import Dashboard from "../src/app/(portal)/portal/page";
import Account from "../src/app/(portal)/portal/account/page";
import Certificates from "../src/app/(portal)/portal/tax-exemption/page";
vi.mock("@/components/portal/CertificateReviewActions", () => ({ default: () => null }));
import ReviewQueue from "../src/app/team/resale-certificates/page";
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
    it("labels active approvals as review decisions and makes no unsupported checkout-tax claim", async () => {
        mocks.queue.mockResolvedValue({ counts: { pending: 0, approved: 1, awaitingSync: 1, lapsed: 0, expired: 0, rejected: 0 }, certificates: [{ _id: "cert", status: "approved", lapsed: false, awaitingShopifySync: true, companyName: "Fixture", legalBusinessName: "Fixture", issuingState: "CA", permitNumber: "TEST", submittedAt: 1, notifications: [] }] });
        const html = renderToStaticMarkup(await ReviewQueue({}));
        expect(html).toContain("Review approved");
        expect(html).not.toContain("Tax exempt");
        expect(html).not.toContain("still being charged tax");
        expect(html).not.toContain("never written to Shopify");
        expect(html).toContain("checkout sync is unconfirmed");
    });
    it("keeps lapsed exemption uncertainty visible while a replacement is under review", async () => {
        mocks.shell.mockResolvedValue({ account: { ...account, certificateTaxStatus: "review_required" } });
        mocks.certificates.mockResolvedValue({ active: null, asOf: 100, certificates: [
            { _id: "replacement", status: "pending", permitNumber: "TEST", issuingState: "CA", submittedAt: 50, legalBusinessName: "Fixture" },
            { _id: "old", status: "approved", expiresAt: 40, shopifySyncedAt: 20, permitNumber: "OLD-TEST", issuingState: "CA", submittedAt: 1, legalBusinessName: "Fixture" },
        ] });
        const html = renderToStaticMarkup(await Certificates());
        expect(html).toContain("Under review");
        expect(html).toContain("Checkout status needs review");
        expect(html).toContain("A previous exemption may still apply");
        expect(html).not.toContain("are charged sales tax");
    });

    it.each([
        [{ kind: "date", date: "2000-01-01" }, "2000-01-01", true],
        [{ kind: "none" }, "No expiration on document", false],
        [undefined, "Not provided", false],
    ])("shows the customer's declaration as unverified in the staff queue", async (customerDeclaredExpiration, label, past) => {
        mocks.queue.mockResolvedValue({ counts: { pending: 1, approved: 0, awaitingSync: 0, lapsed: 0, expired: 0, rejected: 0 }, certificates: [{ _id: "cert", status: "pending", companyName: "Fixture", legalBusinessName: "Fixture", issuingState: "CA", permitNumber: "TEST", submittedAt: 1, notifications: [], customerDeclaredExpiration, customerDeclaredExpirationIsPast: past }] });
        const html = renderToStaticMarkup(await ReviewQueue({}));
        expect(html).toContain(`Customer-declared expiration (unverified): ${label}`);
        expect(html.includes("Past date — check the supporting document")).toBe(past);
    });

});
