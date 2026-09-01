/**
 * Exemption is DERIVED. These tests are the reason that matters.
 *
 * The failure this module exists to prevent is silent and expensive: a
 * certificate lapses, a stored boolean keeps saying "tax exempt", and Best
 * Bottles under-collects tax on every order until somebody notices. So the
 * cases below are mostly about TIME — the one thing a boolean cannot model.
 */
import { describe, expect, it } from "vitest";
import { deriveExemption } from "../convex/resaleCertificates";

type Cert = Parameters<typeof deriveExemption>[0][number];

const NOW = Date.parse("2026-09-01T12:00:00Z");
const day = 86_400_000;

function cert(over: Partial<Cert>): Cert {
    return {
        _id: "c1" as Cert["_id"],
        _creationTime: NOW,
        clerkOrgId: "org_1",
        permitNumber: "SR-KH-123456",
        issuingState: "CA",
        status: "approved",
        submittedAt: NOW - 30 * day,
        ...over,
    } as Cert;
}

describe("deriveExemption", () => {
    it("no certificate on file means taxable, and says so", () => {
        const r = deriveExemption([], NOW);
        expect(r.exempt).toBe(false);
        expect(r.reason).toBe("no_certificate");
    });

    it("a submitted certificate does NOT exempt while it waits", () => {
        // Jordan's rule: unapproved buyers pay tax but are never blocked.
        const r = deriveExemption([cert({ status: "submitted" })], NOW);
        expect(r.exempt).toBe(false);
        expect(r.reason).toBe("awaiting_review");
    });

    it("approved with a future expiry exempts, and counts down", () => {
        const r = deriveExemption([cert({ expiresOn: "2027-01-01" })], NOW);
        expect(r.exempt).toBe(true);
        expect(r.reason).toBe("approved");
        expect(r.daysUntilExpiry).toBeGreaterThan(100);
    });

    it("APPROVED BUT EXPIRED does not exempt — the whole point", () => {
        // yesterday. A boolean would still be saying true right now.
        const r = deriveExemption([cert({ expiresOn: "2026-08-31" })], NOW);
        expect(r.exempt).toBe(false);
        expect(r.reason).toBe("expired");
        expect(r.daysUntilExpiry).toBeLessThan(0);
    });

    it("expires TODAY is still valid today", () => {
        // a certificate is good through its stated last day, not until the
        // day before it
        const r = deriveExemption([cert({ expiresOn: "2026-09-01" })], NOW);
        expect(r.exempt).toBe(true);
    });

    it("no stated expiry is a BLANKET certificate, not an expired one", () => {
        // conflating these would tax the longest-standing accounts
        const r = deriveExemption([cert({ expiresOn: undefined })], NOW);
        expect(r.exempt).toBe(true);
        expect(r.expiresOn).toBeUndefined();
    });

    it("a renewal rescues a lapsed certificate", () => {
        const r = deriveExemption([
            cert({ _id: "old" as Cert["_id"], expiresOn: "2026-08-01" }),
            cert({ _id: "new" as Cert["_id"], expiresOn: "2027-08-01",
                   submittedAt: NOW - day }),
        ], NOW);
        expect(r.exempt).toBe(true);
        expect(r.certificate?._id).toBe("new");
    });

    it("picks the longest-lived when several are live", () => {
        const r = deriveExemption([
            cert({ _id: "short" as Cert["_id"], expiresOn: "2026-10-01" }),
            cert({ _id: "long" as Cert["_id"], issuingState: "TX",
                   expiresOn: "2028-01-01" }),
        ], NOW);
        expect(r.exempt).toBe(true);
        expect(r.certificate?._id).toBe("long");
    });

    it("rejected and revoked are reported apart, so the portal can explain", () => {
        expect(deriveExemption([cert({ status: "rejected" })], NOW).reason)
            .toBe("rejected");
        expect(deriveExemption([cert({ status: "revoked" })], NOW).reason)
            .toBe("revoked");
    });

    it("a pending renewal does not resurrect an expired certificate", () => {
        // the customer has filed, staff have not approved: still taxable
        const r = deriveExemption([
            cert({ _id: "lapsed" as Cert["_id"], expiresOn: "2026-08-01" }),
            cert({ _id: "pending" as Cert["_id"], status: "submitted",
                   expiresOn: "2027-08-01", submittedAt: NOW - day }),
        ], NOW);
        expect(r.exempt).toBe(false);
        expect(r.reason).toBe("expired");
    });
});
