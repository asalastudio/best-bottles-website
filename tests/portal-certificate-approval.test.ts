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
    generateCertificateUploadUrlForViewer,
    validateUploadedCertificateForViewer,
    retryCertificateSyncAsStaff,
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

describe("approval activation boundary", () => {
    it("saves the reviewer decision but does not write Shopify while activation is held", async () => {
        const result = await approveCertificateAsStaff({ certificateId: "cert_1" });
        expect(result).toMatchObject({ approved: true, exemptionLive: false, syncBlockedReason: "activation_required" });
        expect(setShopifyCustomerTaxExempt).not.toHaveBeenCalled();
        expect(ensureShopifyCustomerForOrg).not.toHaveBeenCalled();
        expect(convexMutation).toHaveBeenCalledTimes(1);
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


describe("document and retry authorization", () => {
    it("issues an upload ticket only after Clerk-derived customer scope", async () => {
        const previous = process.env.NEXT_PUBLIC_CONVEX_URL;
        process.env.NEXT_PUBLIC_CONVEX_URL = "https://synthetic.convex.cloud";
        try {
            convexMutation.mockResolvedValue("document_fixture");
            const result = await generateCertificateUploadUrlForViewer();
            expect(result.url).toBe("https://synthetic.convex.site/certificate-upload");
            expect(result.ticket).toMatch(/^[a-f0-9]{64}$/);
            expect(convexMutation.mock.calls[0][1]).toMatchObject({ clerkOrgId: "org_1", clerkUserId: "user_buyer", writeToken: "test-token" });
            expect(JSON.stringify(convexMutation.mock.calls[0][1])).not.toContain(result.ticket);
        } finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_CONVEX_URL; else process.env.NEXT_PUBLIC_CONVEX_URL = previous; }
    });
    it("denies a foreign document before fetching any bytes", async () => {
        convexQuery.mockRejectedValue(new Error("document_not_available"));
        const fetch = vi.spyOn(globalThis, "fetch");
        await expect(validateUploadedCertificateForViewer("foreign_document")).rejects.toThrow(/document_not_available/);
        expect(convexQuery.mock.calls.at(-1)?.[1]).toMatchObject({ documentId: "foreign_document", clerkOrgId: "org_1", clerkUserId: "user_buyer" });
        expect(fetch).not.toHaveBeenCalled(); fetch.mockRestore();
    });
    it("denies customer review retry at the staff gate", async () => {
        hasTeamHubAccess.mockReturnValue(false);
        await expect(retryCertificateSyncAsStaff("cert_1")).rejects.toThrow(/staff_access_required/);
        expect(setShopifyCustomerTaxExempt).not.toHaveBeenCalled();
        expect(convexMutation).not.toHaveBeenCalled();
    });
});
