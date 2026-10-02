import { mutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { serverQuery, verifyWriteToken } from "./portalAuth";
import { requireVerifiedDocument } from "./certificateDocuments";
import { enqueueCertificateEvent } from "./certificateNotifications";

export async function accountCertificateStatus(ctx: QueryCtx | MutationCtx, account: Doc<"portalAccounts"> | null) {
    if (!account) return null;
    const certs = await ctx.db.query("resaleCertificates").withIndex("by_orgId", q => q.eq("clerkOrgId", account.clerkOrgId)).collect();
    const active = certs.find(c => c.status === "approved" && (c.expiresAt === undefined || c.expiresAt > Date.now()));
    const unresolvedCheckout = certs.some(c => c.syncAttemptId || c.shopifySyncedAt);
    const taxStatus = active ? active.shopifySyncedAt ? "exempt" : "sync_pending" : unresolvedCheckout ? "review_required" : certs.some(c => c.status === "pending") ? "under_review" : "taxable";
    return { ...account, taxExempt: taxStatus === "exempt", certificateTaxStatus: taxStatus };
}
export async function requireNoSyncInProgress(ctx: MutationCtx, org: string) {
    const certs = await ctx.db.query("resaleCertificates").withIndex("by_orgId", q => q.eq("clerkOrgId", org)).collect();
    if (certs.some(c => c.syncAttemptId)) throw new Error("certificate_sync_in_progress");
}
export const beginSync = mutation({
    args: { writeToken: v.string(), certificateId: v.id("resaleCertificates"), attemptId: v.string() },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const cert = await ctx.db.get(args.certificateId);
        if (!cert || cert.status !== "approved" || (cert.expiresAt !== undefined && cert.expiresAt <= Date.now())) throw new Error("certificate_not_active");
        await requireVerifiedDocument(ctx, cert.documentStorageId, cert.clerkOrgId);
        if (cert.shopifySyncedAt) return { done: true as const, certificate: cert };
        await requireNoSyncInProgress(ctx, cert.clerkOrgId);
        await ctx.db.patch(cert._id, { syncAttemptId: args.attemptId, syncStartedAt: Date.now(), syncFailure: undefined });
        return { done: false as const, certificate: cert };
    },
});
export const finishSync = mutation({
    args: { writeToken: v.string(), certificateId: v.id("resaleCertificates"), attemptId: v.string(), exemptionCode: v.optional(v.string()), failureCode: v.optional(v.string()) },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const cert = await ctx.db.get(args.certificateId);
        if (!cert || cert.syncAttemptId !== args.attemptId) throw new Error("stale_sync_attempt");
        if (args.exemptionCode) {
            if (cert.status !== "approved" || (cert.expiresAt !== undefined && cert.expiresAt <= Date.now())) {
                // Shopify may have accepted a write near expiry: retain the lock for reconciliation.
                await ctx.db.patch(cert._id, { syncFailure: "reconciliation_required" });
                return { exemptionLive: false };
            }
            await ctx.db.patch(cert._id, { shopifySyncedAt: Date.now(), shopifyExemptionCode: args.exemptionCode, syncAttemptId: undefined, syncFailure: undefined });
            await enqueueCertificateEvent(ctx, cert._id, "synced");
        } else {
            await ctx.db.patch(cert._id, { syncAttemptId: undefined, syncFailure: args.failureCode ?? "sync_failed" });
            await enqueueCertificateEvent(ctx, cert._id, "sync_failed");
        }
        return { exemptionLive: Boolean(args.exemptionCode) };
    },
});
/** Read-only plan. No schedule, expiry mutation, or Shopify revoke is executed. */
export const reconciliationPlan = serverQuery({
    args: {},
    handler: async (ctx) => {
        const certs = await ctx.db.query("resaleCertificates").collect();
        const now = Date.now();
        return certs.filter(c => c.syncAttemptId || (c.shopifySyncedAt && (c.status === "expired" || c.status === "revoked" || (c.expiresAt !== undefined && c.expiresAt <= now)))).map(c => ({
            certificateId: c._id, clerkOrgId: c.clerkOrgId,
            action: c.syncAttemptId ? "review_incomplete_sync" as const : certs.some(other => other.clerkOrgId === c.clerkOrgId && other.status === "approved" && (other.expiresAt === undefined || other.expiresAt > now)) ? "review_current_certificate" as const : "review_revocation" as const,
        }));
    },
});
