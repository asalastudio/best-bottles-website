import { beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
vi.mock("server-only", () => ({}));
import { validateCertificateBytes } from "../src/lib/portal/certificateDocumentValidation";
import { CertificateWriteNotAppliedError, syncCertificate, type CertificateSyncAdapter } from "../src/lib/portal/certificateSync";
import { deliverCertificateNotification, type NotificationAdapter } from "../src/lib/portal/certificateNotifications";
const modules = import.meta.glob("../convex/**/*.ts");
const writeToken = "synthetic-only-server-token";
const clerkOrgId = "org_fixture", clerkUserId = "user_fixture";
const scope = { writeToken, clerkOrgId, clerkUserId };
beforeEach(() => { process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = writeToken; });
async function setup() {
    const t = convexTest(schema, modules);
    await t.run(ctx => ctx.db.insert("portalAccounts", { clerkOrgId, companyName: "Fixture", accountNumber: "TEST-1", tier: "test", accountManager: "Test", memberSince: "2026", taxExempt: true, billingEmail: "customer@example.test" }));
    return t;
}
async function upload(t: ReturnType<typeof convexTest>) {
    const pdf = await PDFDocument.create(); pdf.addPage();
    const bytes = await pdf.save();
    const ticket = "a".repeat(64);
    const documentId = await t.mutation(api.certificateDocuments.issue, { ...scope, ticketHash: createHash("sha256").update(ticket).digest("hex") });
    const response = await t.fetch("/certificate-upload", { method: "POST", headers: { Authorization: `Bearer ${ticket}`, "Content-Type": "application/pdf" }, body: new Uint8Array(bytes).buffer });
    expect(response.status).toBe(200);
    const doc = await t.query(api.certificateDocuments.forValidation, { ...scope, documentId });
    const stored = await t.run(async ctx => { const blob = await ctx.storage.get(doc.storageId!); return { bytes: await blob!.arrayBuffer(), type: blob!.type }; });
    const validation = await validateCertificateBytes(new Uint8Array(stored.bytes), stored.type);
    const storageId = await t.mutation(api.certificateDocuments.markVerified, { ...scope, documentId, ...validation });
    return { storageId, documentId, ticket };
}
async function submit(t: ReturnType<typeof convexTest>, storageId: Id<"_storage">) {
    return (await t.mutation(api.resaleCertificates.submitResaleCertificate, { ...scope, legalBusinessName: "Fixture LLC", issuingState: "CA", permitNumber: "TEST-NOT-A-PERMIT", documentStorageId: storageId })).certificateId;
}
async function approve(t: ReturnType<typeof convexTest>, certificateId: Id<"resaleCertificates">) {
    return t.mutation(api.resaleCertificates.approveResaleCertificate, { writeToken, certificateId, reviewerClerkUserId: "staff_fixture" });
}
function syncAdapter(t: ReturnType<typeof convexTest>): CertificateSyncAdapter {
    return {
        begin: (id, attemptId) => t.mutation(api.certificateWorkflow.beginSync, { writeToken, certificateId: id as Id<"resaleCertificates">, attemptId }),
        finish: (id, attemptId, result) => t.mutation(api.certificateWorkflow.finishSync, { writeToken, certificateId: id as Id<"resaleCertificates">, attemptId, ...result }),
        resolveCustomer: vi.fn(async () => ({ status: "linked", shopifyCustomerId: "synthetic" })),
        exemptionFor: () => "US_CA_RESELLER_EXEMPTION", write: vi.fn(async () => {}),
    };
}
async function accountViews(t: ReturnType<typeof convexTest>) {
    return [
        (await t.query(api.portal.getShellData, { writeToken, clerkOrgId })).account,
        (await t.query(api.portal.getDashboardData, { writeToken, clerkOrgId })).account,
        await t.query(api.portal.getAccountByOrg, { writeToken, clerkOrgId }),
        (await t.query(api.portal.listPortalAccounts, { writeToken }))[0],
    ];
}
describe("synthetic certificate workflow", () => {
    it("binds a readable upload, persists review, retries a failed sync, and unifies all account views", async () => {
        const t = await setup();
        // Stale true account boolean is never treated as proof of exemption.
        for (const view of await accountViews(t)) expect(view).toMatchObject({ taxExempt: false, certificateTaxStatus: "taxable" });
        const { storageId } = await upload(t);
        const certificateId = await submit(t, storageId);
        const queue = await t.query(api.resaleCertificates.listAllCertificates, { writeToken });
        expect(queue.certificates[0]).toMatchObject({ companyName: "Fixture", status: "pending" });
        expect(queue.certificates[0].documentUrl).toBeTruthy();
        await approve(t, certificateId);
        for (const view of await accountViews(t)) expect(view).toMatchObject({ taxExempt: false, certificateTaxStatus: "sync_pending" });
        const adapter = syncAdapter(t);
        vi.mocked(adapter.write).mockRejectedValueOnce(new CertificateWriteNotAppliedError("synthetic authoritative rejection"));
        expect(await syncCertificate(certificateId, adapter, true)).toMatchObject({ exemptionLive: false });
        expect((await t.query(api.resaleCertificates.getActiveCertificateForOrg, { writeToken, clerkOrgId }))?.status).toBe("approved");
        expect(await syncCertificate(certificateId, adapter, true)).toEqual({ exemptionLive: true });
        expect(await syncCertificate(certificateId, adapter, true)).toEqual({ exemptionLive: true });
        expect(adapter.write).toHaveBeenCalledTimes(2); // failed then successful; repeat skips external write
        for (const view of await accountViews(t)) expect(view).toMatchObject({ taxExempt: true, certificateTaxStatus: "exempt" });
        const events = await t.query(api.certificateNotifications.list, { writeToken, certificateId });
        expect(events.map(e => e.eventKey)).toHaveLength(new Set(events.map(e => e.eventKey)).size);
        expect(events.map(e => e.event)).toEqual(expect.arrayContaining(["submitted", "approved", "sync_failed", "synced"]));
    });
    it("rejects ownership forgery, replayed tickets, unverified and absent documents before review", async () => {
        const t = await setup(); const { documentId, storageId, ticket } = await upload(t);
        await expect(t.query(api.certificateDocuments.forValidation, { ...scope, documentId, clerkOrgId: "other" })).rejects.toThrow();
        await expect(t.mutation(api.resaleCertificates.submitResaleCertificate, { ...scope, clerkOrgId: "other", legalBusinessName: "Foreign", issuingState: "CA", permitNumber: "TEST", documentStorageId: storageId })).rejects.toThrow(/not_verified/);
        expect((await t.fetch("/certificate-upload", { method: "POST", headers: { Authorization: `Bearer ${ticket}`, "Content-Type": "application/pdf" }, body: "not a file" })).status).toBe(400);
        const id = await t.run(ctx => ctx.db.insert("resaleCertificates", { clerkOrgId, legalBusinessName: "Legacy", issuingState: "CA", permitNumber: "TEST", status: "pending", submittedAt: Date.now(), submittedBy: clerkUserId }));
        await expect(approve(t, id)).rejects.toThrow(/supporting_document_required/);
        await expect(t.mutation(api.certificateWorkflow.beginSync, { writeToken: "forged", certificateId: id, attemptId: "x" })).rejects.toThrow(/unauthorized/);
        await expect(t.query(api.certificateNotifications.list, { writeToken: "forged", certificateId: id })).rejects.toThrow(/unauthorized/);
    });
    it("blocks missing customer configuration and disabled writes without using any real transport", async () => {
        const t = await setup(); const { storageId } = await upload(t); const certificateId = await submit(t, storageId); await approve(t, certificateId);
        const adapter = syncAdapter(t);
        expect(await syncCertificate(certificateId, adapter)).toMatchObject({ syncBlockedReason: "activation_required" });
        expect(adapter.resolveCustomer).not.toHaveBeenCalled();
        vi.mocked(adapter.resolveCustomer).mockResolvedValueOnce({ status: "unavailable", reason: "no_billing_email" });
        expect(await syncCertificate(certificateId, adapter, true)).toMatchObject({ syncBlockedReason: "no_billing_email" });
        expect(adapter.write).not.toHaveBeenCalled();
        expect((await t.query(api.resaleCertificates.getActiveCertificateForOrg, { writeToken, clerkOrgId }))?.syncFailure).toBe("no_billing_email");
    });
    it("requires rejection reason and records one review event without activating delivery", async () => {
        const t = await setup(); const { storageId } = await upload(t); const certificateId = await submit(t, storageId);
        await expect(t.mutation(api.resaleCertificates.rejectResaleCertificate, { writeToken, certificateId, reviewerClerkUserId: "staff", reviewNote: " " })).rejects.toThrow(/reason_required/);
        await t.mutation(api.resaleCertificates.rejectResaleCertificate, { writeToken, certificateId, reviewerClerkUserId: "staff", reviewNote: "Please upload a complete scan." });
        const rows = await t.query(api.resaleCertificates.listCertificatesByOrg, { writeToken, clerkOrgId });
        expect(rows[0]).toMatchObject({ status: "rejected", reviewNote: "Please upload a complete scan." });
        expect(await t.query(api.resaleCertificates.listCertificatesByOrg, { writeToken, clerkOrgId: "other" })).toEqual([]);
        await expect(approve(t, certificateId)).rejects.toThrow(/not_pending/);
        const send = vi.fn();
        expect(await deliverCertificateNotification("anything", { prepare: vi.fn(), complete: vi.fn(), send })).toEqual({ status: "disabled" });
        expect(send).not.toHaveBeenCalled();
    });
    it("holds concurrent sync/review and preserves uncertain post-write state for reconciliation", async () => {
        const t = await setup(); const { storageId } = await upload(t); const certificateId = await submit(t, storageId); await approve(t, certificateId);
        const adapter = syncAdapter(t); const original = adapter.finish;
        adapter.finish = vi.fn(async (_id, _attempt, result) => { if (result.exemptionCode) throw new Error("lost database acknowledgement"); return original(_id, _attempt, result); });
        expect(await syncCertificate(certificateId, adapter, true)).toMatchObject({ syncBlockedReason: "reconciliation_required" });
        await expect(syncCertificate(certificateId, syncAdapter(t), true)).rejects.toThrow(/sync_in_progress/);
        expect(adapter.write).toHaveBeenCalledTimes(1);
        expect((await t.query(api.certificateWorkflow.reconciliationPlan, { writeToken }))[0].action).toBe("review_incomplete_sync");
        expect((await t.query(api.resaleCertificates.getActiveCertificateForOrg, { writeToken, clerkOrgId }))?.shopifySyncedAt).toBeUndefined();
    });
    it("fences an accepted Shopify write with a lost response through retry, replacement review and expiry", async () => {
        const t = await setup(); const { storageId } = await upload(t);
        const certificateId = await submit(t, storageId); await approve(t, certificateId);
        let externalExempt = false;
        const adapter = syncAdapter(t);
        adapter.write = vi.fn(async () => { externalExempt = true; throw new Error("response lost after provider accepted write"); });
        expect(await syncCertificate(certificateId, adapter, true)).toMatchObject({ syncBlockedReason: "reconciliation_required" });
        expect(externalExempt).toBe(true);
        const cert = await t.run(ctx => ctx.db.get(certificateId));
        expect(cert?.syncAttemptId).toBeTruthy();
        expect(cert?.syncFailure).toBe("reconciliation_required");
        expect(cert?.shopifySyncedAt).toBeUndefined();
        await expect(syncCertificate(certificateId, syncAdapter(t), true)).rejects.toThrow(/sync_in_progress/);
        const replacement = await submit(t, storageId);
        await expect(approve(t, replacement)).rejects.toThrow(/sync_in_progress/);
        await t.run(ctx => ctx.db.patch(certificateId, { expiresAt: Date.now() - 1 }));
        await expect(t.mutation(api.resaleCertificates.expireLapsedCertificates, { writeToken })).rejects.toThrow(/sync_in_progress/);
        expect((await t.query(api.certificateWorkflow.reconciliationPlan, { writeToken }))[0]).toMatchObject({ certificateId, action: "review_incomplete_sync" });
        for (const view of await accountViews(t)) expect(view?.certificateTaxStatus).toBe("review_required");
        expect(adapter.write).toHaveBeenCalledTimes(1);
    });
    it("plans expired exemption reconciliation without mutation or revoking a newer active exemption", async () => {
        const t = await setup(); const { storageId } = await upload(t); const certificateId = await submit(t, storageId); await approve(t, certificateId);
        await syncCertificate(certificateId, syncAdapter(t), true);
        await t.run(ctx => ctx.db.patch(certificateId, { expiresAt: Date.now() - 1 }));
        const plan = await t.query(api.certificateWorkflow.reconciliationPlan, { writeToken });
        expect(plan[0].action).toBe("review_revocation");
        expect((await t.run(ctx => ctx.db.get(certificateId)))?.status).toBe("approved");
        for (const view of await accountViews(t)) expect(view?.taxExempt).toBe(false);
        await t.run(ctx => ctx.db.insert("resaleCertificates", { clerkOrgId, legalBusinessName: "Replacement", issuingState: "CA", permitNumber: "TEST", status: "approved", submittedAt: Date.now(), submittedBy: clerkUserId }));
        expect((await t.query(api.certificateWorkflow.reconciliationPlan, { writeToken }))[0].action).toBe("review_current_certificate");
    });
    it("records delivery retries with stable deduplication keys and trusted recipients only", async () => {
        const t = await setup(); const { storageId } = await upload(t); const certificateId = await submit(t, storageId);
        const event = (await t.query(api.certificateNotifications.list, { writeToken, certificateId })).find(e => e.audience === "customer")!;
        const adapter: NotificationAdapter = {
            prepare: (id, attemptId) => t.mutation(api.certificateNotifications.prepare, { writeToken, notificationId: id as Id<"certificateNotifications">, attemptId }),
            complete: async (id, attemptId, result) => { await t.mutation(api.certificateNotifications.complete, { writeToken, notificationId: id as Id<"certificateNotifications">, attemptId, ...result }); },
            send: vi.fn(async () => ({ id: "fixture-message" })),
        };
        const policy = { enabled: true, from: "sender@example.test", staffRecipients: ["staff@example.test"], customerRecipient: "billing" as const, portalOrigin: "https://example.test" };
        vi.mocked(adapter.send).mockRejectedValueOnce(new Error("synthetic failure"));
        expect(await deliverCertificateNotification(event._id, adapter, policy)).toEqual({ status: "failed" });
        await t.run(ctx => ctx.db.patch(event._id, { nextAttemptAt: Date.now() - 1 }));
        expect(await deliverCertificateNotification(event._id, adapter, policy)).toEqual({ status: "sent" });
        expect(await deliverCertificateNotification(event._id, adapter, policy)).toEqual({ status: "skipped" });
        expect(adapter.send).toHaveBeenCalledTimes(2);
        for (const [message] of vi.mocked(adapter.send).mock.calls) {
            expect(message.to).toEqual(["customer@example.test"]);
            expect(message.idempotencyKey).toBe(event.eventKey);
            expect(message.text).not.toContain("TEST-NOT-A-PERMIT");
            expect(message.text).not.toContain("convex.cloud");
        }
        const staffEvent = (await t.query(api.certificateNotifications.list, { writeToken, certificateId })).find(e => e.audience === "staff")!;
        expect(await deliverCertificateNotification(staffEvent._id, adapter, { ...policy, staffRecipients: [] })).toEqual({ status: "blocked" });
        expect(adapter.send).toHaveBeenCalledTimes(2);
    });
});
