// @vitest-environment edge-runtime
/// <reference types="vite/client" />
/**
 * Resale certificate lifecycle.
 *
 * The risk this guards is a wrong tax outcome, so the assertions concentrate on
 * the three ways an account could end up untaxed when it shouldn't be: two
 * approvals live at once, a lapsed certificate still reading as active, and
 * Convex approval being mistaken for an exemption Shopify actually knows about.
 */

import { convexTest } from "convex-test";
import { describe, expect, it, beforeEach } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");

const WRITE_TOKEN = "test-write-token";
const ORG = "org_lumiere";
const USER = "user_buyer";
const STAFF = "user_staff";

beforeEach(() => {
    process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = WRITE_TOKEN;
});

function submit(t: ReturnType<typeof convexTest>, overrides: Record<string, unknown> = {}) {
    return t.mutation(api.resaleCertificates.submitResaleCertificate, {
        writeToken: WRITE_TOKEN,
        clerkOrgId: ORG,
        clerkUserId: USER,
        legalBusinessName: "Lumière Atelier LLC",
        issuingState: "CA",
        permitNumber: "123-456789",
        ...overrides,
    });
}

const YEAR = 365 * 24 * 60 * 60 * 1000;

// ─── Write-token guard ──────────────────────────────────────────────────────

describe("write token", () => {
    it("refuses a mutation without the shared token", async () => {
        const t = convexTest(schema, modules);
        await expect(submit(t, { writeToken: "wrong" })).rejects.toThrow(
            /unauthorized_convex_write/,
        );
    });
});

// ─── Submission ─────────────────────────────────────────────────────────────

describe("submitResaleCertificate", () => {
    it("normalizes the issuing state", async () => {
        const t = convexTest(schema, modules);
        await submit(t, { issuingState: " ca " });

        const certs = await t.query(api.resaleCertificates.listCertificatesByOrg, {
            clerkOrgId: ORG,
        });
        expect(certs[0].issuingState).toBe("CA");
        expect(certs[0].status).toBe("pending");
    });

    it("rejects a malformed state or blank permit", async () => {
        const t = convexTest(schema, modules);
        await expect(submit(t, { issuingState: "California" })).rejects.toThrow(
            /invalid_issuing_state/,
        );
        await expect(submit(t, { permitNumber: "   " })).rejects.toThrow(
            /permit_number_required/,
        );
        await expect(submit(t, { legalBusinessName: "  " })).rejects.toThrow(
            /legal_business_name_required/,
        );
    });

    it("supersedes an earlier pending submission instead of queueing both", async () => {
        const t = convexTest(schema, modules);
        await submit(t, { permitNumber: "OLD-1" });
        await submit(t, { permitNumber: "NEW-2" });

        const pending = await t.query(api.resaleCertificates.listPendingCertificates, {});
        expect(pending).toHaveLength(1);
        expect(pending[0].permitNumber).toBe("NEW-2");

        // The superseded row is kept as history, not deleted.
        const all = await t.query(api.resaleCertificates.listCertificatesByOrg, {
            clerkOrgId: ORG,
        });
        expect(all).toHaveLength(2);
        expect(all.find((c) => c.permitNumber === "OLD-1")?.status).toBe("revoked");
    });
});

// ─── Approval ───────────────────────────────────────────────────────────────

describe("approveResaleCertificate", () => {
    it("makes the certificate active and records the reviewer", async () => {
        const t = convexTest(schema, modules);
        const { certificateId } = await submit(t);

        await t.mutation(api.resaleCertificates.approveResaleCertificate, {
            writeToken: WRITE_TOKEN,
            certificateId,
            reviewerClerkUserId: STAFF,
            expiresAt: Date.now() + YEAR,
        });

        const active = await t.query(api.resaleCertificates.getActiveCertificateForOrg, {
            clerkOrgId: ORG,
        });
        expect(active?.status).toBe("approved");
        expect(active?.reviewedBy).toBe(STAFF);
    });

    it("does not claim a Shopify exemption that has not been written", async () => {
        const t = convexTest(schema, modules);
        const { certificateId } = await submit(t);

        await t.mutation(api.resaleCertificates.approveResaleCertificate, {
            writeToken: WRITE_TOKEN,
            certificateId,
            reviewerClerkUserId: STAFF,
        });

        const active = await t.query(api.resaleCertificates.getActiveCertificateForOrg, {
            clerkOrgId: ORG,
        });
        // Approval in Convex is not exemption in Shopify.
        expect(active?.shopifyExemptionCode).toBeUndefined();
        expect(active?.shopifySyncedAt).toBeUndefined();
    });

    it("leaves only one approved certificate per account", async () => {
        const t = convexTest(schema, modules);
        const first = await submit(t, { permitNumber: "FIRST" });
        await t.mutation(api.resaleCertificates.approveResaleCertificate, {
            writeToken: WRITE_TOKEN,
            certificateId: first.certificateId,
            reviewerClerkUserId: STAFF,
        });

        const second = await submit(t, { permitNumber: "SECOND" });
        await t.mutation(api.resaleCertificates.approveResaleCertificate, {
            writeToken: WRITE_TOKEN,
            certificateId: second.certificateId,
            reviewerClerkUserId: STAFF,
        });

        const all = await t.query(api.resaleCertificates.listCertificatesByOrg, {
            clerkOrgId: ORG,
        });
        expect(all.filter((c) => c.status === "approved")).toHaveLength(1);

        const active = await t.query(api.resaleCertificates.getActiveCertificateForOrg, {
            clerkOrgId: ORG,
        });
        expect(active?.permitNumber).toBe("SECOND");
    });

    it("refuses an expiry in the past", async () => {
        const t = convexTest(schema, modules);
        const { certificateId } = await submit(t);

        await expect(
            t.mutation(api.resaleCertificates.approveResaleCertificate, {
                writeToken: WRITE_TOKEN,
                certificateId,
                reviewerClerkUserId: STAFF,
                expiresAt: Date.now() - 1000,
            }),
        ).rejects.toThrow(/expiry_must_be_in_the_future/);
    });

    it("refuses to approve anything that is not pending", async () => {
        const t = convexTest(schema, modules);
        const { certificateId } = await submit(t);

        await t.mutation(api.resaleCertificates.rejectResaleCertificate, {
            writeToken: WRITE_TOKEN,
            certificateId,
            reviewerClerkUserId: STAFF,
            reviewNote: "Permit number does not match CDTFA registry.",
        });

        await expect(
            t.mutation(api.resaleCertificates.approveResaleCertificate, {
                writeToken: WRITE_TOKEN,
                certificateId,
                reviewerClerkUserId: STAFF,
            }),
        ).rejects.toThrow(/certificate_not_pending/);
    });
});

// ─── Rejection ──────────────────────────────────────────────────────────────

describe("rejectResaleCertificate", () => {
    it("requires a reason the customer can act on", async () => {
        const t = convexTest(schema, modules);
        const { certificateId } = await submit(t);

        await expect(
            t.mutation(api.resaleCertificates.rejectResaleCertificate, {
                writeToken: WRITE_TOKEN,
                certificateId,
                reviewerClerkUserId: STAFF,
                reviewNote: "   ",
            }),
        ).rejects.toThrow(/rejection_reason_required/);
    });

    it("leaves the account with no active certificate", async () => {
        const t = convexTest(schema, modules);
        const { certificateId } = await submit(t);

        await t.mutation(api.resaleCertificates.rejectResaleCertificate, {
            writeToken: WRITE_TOKEN,
            certificateId,
            reviewerClerkUserId: STAFF,
            reviewNote: "Illegible document.",
        });

        expect(
            await t.query(api.resaleCertificates.getActiveCertificateForOrg, { clerkOrgId: ORG }),
        ).toBeNull();
    });
});

// ─── Expiry ─────────────────────────────────────────────────────────────────

describe("expiry", () => {
    it("stops reading as active the moment it lapses, before any sweep runs", async () => {
        const t = convexTest(schema, modules);
        const { certificateId } = await submit(t);
        await t.mutation(api.resaleCertificates.approveResaleCertificate, {
            writeToken: WRITE_TOKEN,
            certificateId,
            reviewerClerkUserId: STAFF,
            expiresAt: Date.now() + 50,
        });

        expect(
            await t.query(api.resaleCertificates.getActiveCertificateForOrg, { clerkOrgId: ORG }),
        ).not.toBeNull();

        await new Promise((resolve) => setTimeout(resolve, 80));

        // Still status "approved" in the row, but expired in fact — the read
        // must not trust the stale status.
        expect(
            await t.query(api.resaleCertificates.getActiveCertificateForOrg, { clerkOrgId: ORG }),
        ).toBeNull();
    });

    it("sweeps lapsed certificates and flags which need revoking in Shopify", async () => {
        const t = convexTest(schema, modules);
        const { certificateId } = await submit(t);
        await t.mutation(api.resaleCertificates.approveResaleCertificate, {
            writeToken: WRITE_TOKEN,
            certificateId,
            reviewerClerkUserId: STAFF,
            expiresAt: Date.now() + YEAR,
        });
        await t.mutation(api.resaleCertificates.markCertificateSyncedToShopify, {
            writeToken: WRITE_TOKEN,
            certificateId,
            shopifyExemptionCode: "US_CA_RESELLER_EXEMPTION",
        });

        const result = await t.mutation(api.resaleCertificates.expireLapsedCertificates, {
            writeToken: WRITE_TOKEN,
            now: Date.now() + 2 * YEAR,
        });

        expect(result.expiredCount).toBe(1);
        // It reached Shopify, so Shopify still believes the account is exempt.
        expect(result.expired[0].needsShopifyRevoke).toBe(true);
        expect(result.expired[0].clerkOrgId).toBe(ORG);
    });

    it("leaves a certificate with no expiry date alone", async () => {
        const t = convexTest(schema, modules);
        const { certificateId } = await submit(t);
        await t.mutation(api.resaleCertificates.approveResaleCertificate, {
            writeToken: WRITE_TOKEN,
            certificateId,
            reviewerClerkUserId: STAFF,
        });

        const result = await t.mutation(api.resaleCertificates.expireLapsedCertificates, {
            writeToken: WRITE_TOKEN,
            now: Date.now() + 50 * YEAR,
        });
        expect(result.expiredCount).toBe(0);
    });
});

// ─── Shopify sync bookkeeping ───────────────────────────────────────────────

describe("markCertificateSyncedToShopify", () => {
    it("refuses to record a sync for a certificate that is not approved", async () => {
        const t = convexTest(schema, modules);
        const { certificateId } = await submit(t);

        await expect(
            t.mutation(api.resaleCertificates.markCertificateSyncedToShopify, {
                writeToken: WRITE_TOKEN,
                certificateId,
                shopifyExemptionCode: "US_CA_RESELLER_EXEMPTION",
            }),
        ).rejects.toThrow(/certificate_not_approved/);
    });
});
