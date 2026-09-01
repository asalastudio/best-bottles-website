/**
 * Staff approval of a resale certificate.
 *
 * The failure this guards against is quiet and expensive: a reviewer clicks
 * Approve, the UI says approved, and Shopify never learns about it — so the
 * account keeps paying tax and nobody finds out until a customer complains. Every
 * path below asserts on `exemptionLive`, which is the only field that reflects
 * what checkout will actually do.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// CLERK_ENABLED is a module-level const read at import time, so setting the env
// var in beforeEach would land after the module under test has already resolved.
vi.mock("@/lib/clerk", () => ({ CLERK_ENABLED: true }));

const currentUser = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
    currentUser: () => currentUser(),
    auth: vi.fn(),
}));

const hasTeamHubAccess = vi.fn();
vi.mock("@/lib/teamAccess", () => ({
    hasTeamHubAccess: (...args: unknown[]) => hasTeamHubAccess(...args),
    getUserEmailAddresses: (u: { emails?: string[] } | null) => u?.emails ?? [],
}));

const setShopifyCustomerTaxExempt = vi.fn();
class ShopifyCustomerScopeError extends Error {}
vi.mock("@/lib/shopify-customers", () => ({
    setShopifyCustomerTaxExempt: (...a: unknown[]) => setShopifyCustomerTaxExempt(...a),
    ShopifyCustomerScopeError,
    usResellerExemptionFor: (s: string) =>
        s?.toUpperCase() === "CA" ? "US_CA_RESELLER_EXEMPTION" : null,
}));

const convexQuery = vi.fn();
const convexMutation = vi.fn();
vi.mock("@/lib/portal/convexClient", () => ({
    getPortalConvex: () => ({ query: convexQuery, mutation: convexMutation }),
    getPortalConvexWriteToken: () => "test-token",
}));
vi.mock("../src/lib/portal/convexClient", () => ({
    getPortalConvex: () => ({ query: convexQuery, mutation: convexMutation }),
    getPortalConvexWriteToken: () => "test-token",
}));

const ensureShopifyCustomerForOrg = vi.fn();
const requirePortalViewer = vi.fn();
vi.mock("../src/lib/portal/server", () => ({
    ensureShopifyCustomerForOrg: (...a: unknown[]) => ensureShopifyCustomerForOrg(...a),
    requirePortalViewer: () => requirePortalViewer(),
}));

const {
    approveCertificateAsStaff,
    listPendingCertificatesForStaff,
    submitResaleCertificateForViewer,
} = await import("../src/lib/portal/certificates");

const STAFF = { id: "user_staff", publicMetadata: {}, emails: ["staff@nematinternational.com"] };

beforeEach(() => {
    vi.clearAllMocks();
    currentUser.mockResolvedValue(STAFF);
    hasTeamHubAccess.mockReturnValue(true);
    requirePortalViewer.mockResolvedValue({ clerkOrgId: "org_1", clerkUserId: "user_buyer" });
    convexMutation.mockResolvedValue({
        certificateId: "cert_1",
        clerkOrgId: "org_1",
        issuingState: "CA",
    });
    ensureShopifyCustomerForOrg.mockResolvedValue({
        status: "linked",
        shopifyCustomerId: "99",
        billingEmail: "buyer@x.com",
        created: false,
    });
    setShopifyCustomerTaxExempt.mockResolvedValue({});
});

// ─── Staff gate ─────────────────────────────────────────────────────────────

describe("staff gate", () => {
    it("refuses a signed-in user without team access", async () => {
        hasTeamHubAccess.mockReturnValue(false);
        await expect(listPendingCertificatesForStaff()).rejects.toThrow(/staff_access_required/);
    });

    it("refuses when nobody is signed in", async () => {
        currentUser.mockResolvedValue(null);
        await expect(
            approveCertificateAsStaff({ certificateId: "cert_1" }),
        ).rejects.toThrow(/staff_access_required/);
        expect(convexMutation).not.toHaveBeenCalled();
    });
});

// ─── Happy path ─────────────────────────────────────────────────────────────

describe("approveCertificateAsStaff", () => {
    it("writes the state's exemption code and records the sync", async () => {
        const result = await approveCertificateAsStaff({ certificateId: "cert_1" });

        expect(result.exemptionLive).toBe(true);
        expect(result.shopifyExemptionCode).toBe("US_CA_RESELLER_EXEMPTION");

        expect(setShopifyCustomerTaxExempt).toHaveBeenCalledWith(
            "gid://shopify/Customer/99",
            true,
            ["US_CA_RESELLER_EXEMPTION"],
        );

        // markCertificateSyncedToShopify runs only after the Shopify write.
        const synced = convexMutation.mock.calls.find(
            ([, args]) => (args as { shopifyExemptionCode?: string }).shopifyExemptionCode,
        );
        expect(synced).toBeDefined();
    });

    it("never seeds the customer with the reviewing employee's email", async () => {
        await approveCertificateAsStaff({ certificateId: "cert_1" });
        // Called with the org alone — no fallbackEmail from the staff session.
        expect(ensureShopifyCustomerForOrg).toHaveBeenCalledWith("org_1");
    });
});

// ─── Approved, but not exempt ───────────────────────────────────────────────

describe("approval without a live exemption", () => {
    it("reports scope failure instead of claiming tax is handled", async () => {
        ensureShopifyCustomerForOrg.mockResolvedValue({
            status: "unavailable",
            reason: "shopify_scope_missing",
            detail: "needs write_customers",
        });

        const result = await approveCertificateAsStaff({ certificateId: "cert_1" });

        expect(result.approved).toBe(true);
        expect(result.exemptionLive).toBe(false);
        expect(result.syncBlockedReason).toBe("shopify_scope_missing");
        expect(setShopifyCustomerTaxExempt).not.toHaveBeenCalled();
    });

    it("reports a missing billing email", async () => {
        ensureShopifyCustomerForOrg.mockResolvedValue({
            status: "unavailable",
            reason: "no_billing_email",
        });

        const result = await approveCertificateAsStaff({ certificateId: "cert_1" });
        expect(result.exemptionLive).toBe(false);
        expect(result.syncBlockedReason).toBe("no_billing_email");
    });

    it("does not record a sync when the Shopify write throws", async () => {
        setShopifyCustomerTaxExempt.mockRejectedValue(new Error("Shopify GQL: boom"));

        const result = await approveCertificateAsStaff({ certificateId: "cert_1" });

        expect(result.exemptionLive).toBe(false);
        expect(result.syncBlockedReason).toBe("shopify_write_failed");

        const synced = convexMutation.mock.calls.find(
            ([, args]) => (args as { shopifyExemptionCode?: string }).shopifyExemptionCode,
        );
        expect(synced).toBeUndefined();
    });

    it("keeps the Convex approval even when the sync fails", async () => {
        setShopifyCustomerTaxExempt.mockRejectedValue(new Error("boom"));
        const result = await approveCertificateAsStaff({ certificateId: "cert_1" });
        // The employee's decision is a real fact; the account is simply still
        // taxed until the sync is retried.
        expect(result.approved).toBe(true);
    });
});

// ─── Submission validation ──────────────────────────────────────────────────

describe("submitResaleCertificateForViewer", () => {
    it("refuses a state with no Shopify exemption code", async () => {
        // Catching it here stops a reviewer approving something that could never
        // be written to Shopify.
        await expect(
            submitResaleCertificateForViewer({
                legalBusinessName: "Acme",
                issuingState: "XX",
                permitNumber: "1234",
            }),
        ).rejects.toThrow(/unsupported_issuing_state/);
        expect(convexMutation).not.toHaveBeenCalled();
    });

    it("accepts a supported state", async () => {
        convexMutation.mockResolvedValue({ certificateId: "cert_2" });
        const result = await submitResaleCertificateForViewer({
            legalBusinessName: "Acme",
            issuingState: "CA",
            permitNumber: "1234",
        });
        expect(result.certificateId).toBe("cert_2");
    });
});
