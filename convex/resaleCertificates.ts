/**
 * Resale certificates — the seller's-permit record behind wholesale tax exemption.
 *
 * Two rules shape this module:
 *
 *  1. **Nothing here blocks a purchase.** An unapproved buyer is charged tax;
 *     they are never stopped from ordering. The certificate only decides whether
 *     tax comes off.
 *  2. **Convex approval and Shopify exemption are separate facts.** Approving a
 *     row here does not make checkout untaxed — only the write onto the Shopify
 *     customer does. `shopifySyncedAt` records that second fact, and code must
 *     never infer one from the other.
 *
 * Rows are history: a superseded or lapsed certificate is kept, never mutated
 * into the new one, so "what were we relying on last March" stays answerable.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { verifyWriteToken } from "./portalAuth";

function normalizeState(raw: string): string {
    const code = raw.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) {
        throw new Error("invalid_issuing_state");
    }
    return code;
}

function normalizePermitNumber(raw: string): string {
    const permit = raw.trim();
    if (!permit) throw new Error("permit_number_required");
    return permit;
}

/** An approved certificate that has not lapsed as of `now`. */
function isActive(cert: Doc<"resaleCertificates">, now: number): boolean {
    if (cert.status !== "approved") return false;
    return cert.expiresAt === undefined || cert.expiresAt > now;
}

// ─── Upload ─────────────────────────────────────────────────────────────────

/** One-shot Convex storage URL for the certificate PDF or image. */
export const generateCertificateUploadUrl = mutation({
    args: { writeToken: v.string() },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        return await ctx.storage.generateUploadUrl();
    },
});

// ─── Customer side ──────────────────────────────────────────────────────────

export const submitResaleCertificate = mutation({
    args: {
        writeToken: v.string(),
        clerkOrgId: v.string(),
        clerkUserId: v.string(),
        legalBusinessName: v.string(),
        issuingState: v.string(),
        permitNumber: v.string(),
        documentStorageId: v.optional(v.id("_storage")),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        const legalBusinessName = args.legalBusinessName.trim();
        if (!legalBusinessName) throw new Error("legal_business_name_required");

        const issuingState = normalizeState(args.issuingState);
        const permitNumber = normalizePermitNumber(args.permitNumber);

        // A second submission replaces an earlier one still awaiting review —
        // otherwise the queue accumulates duplicates of the same business and a
        // reviewer cannot tell which document is current.
        const existing = await ctx.db
            .query("resaleCertificates")
            .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .collect();

        for (const cert of existing) {
            if (cert.status === "pending") {
                await ctx.db.patch(cert._id, {
                    status: "revoked",
                    reviewNote: "Superseded by a newer submission.",
                    reviewedAt: Date.now(),
                });
            }
        }

        const certificateId = await ctx.db.insert("resaleCertificates", {
            clerkOrgId: args.clerkOrgId,
            legalBusinessName,
            issuingState,
            permitNumber,
            documentStorageId: args.documentStorageId,
            status: "pending",
            submittedAt: Date.now(),
            submittedBy: args.clerkUserId,
        });

        return { certificateId };
    },
});

export const listCertificatesByOrg = query({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args) => {
        const certs = await ctx.db
            .query("resaleCertificates")
            .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .collect();

        return certs.sort((a, b) => b.submittedAt - a.submittedAt);
    },
});

/**
 * The certificate currently entitling this account to buy untaxed, or null.
 *
 * Evaluates expiry at read time rather than trusting `status`, so a certificate
 * that lapsed since the last sweep does not read as active.
 */
export const getActiveCertificateForOrg = query({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args) => {
        const now = Date.now();
        const certs = await ctx.db
            .query("resaleCertificates")
            .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .collect();

        const active = certs
            .filter((cert) => isActive(cert, now))
            .sort((a, b) => b.submittedAt - a.submittedAt);

        return active[0] ?? null;
    },
});

// ─── Staff review queue ─────────────────────────────────────────────────────

/**
 * Oldest first — a reviewer should clear the longest wait, not the newest.
 * Resolves each document to a URL so the queue can link straight to the permit;
 * verifying against the issuing state's registry is the whole job, and a row
 * without a viewable document cannot be reviewed.
 */
export const listPendingCertificates = query({
    args: {},
    handler: async (ctx) => {
        const pending = await ctx.db
            .query("resaleCertificates")
            .withIndex("by_status", (q) => q.eq("status", "pending"))
            .collect();

        pending.sort((a, b) => a.submittedAt - b.submittedAt);

        return await Promise.all(
            pending.map(async (cert) => ({
                ...cert,
                documentUrl: cert.documentStorageId
                    ? await ctx.storage.getUrl(cert.documentStorageId)
                    : null,
            })),
        );
    },
});

/**
 * Every certificate, newest first, joined to the account that submitted it.
 *
 * The queue alone hides the two states that actually cost money: an approval
 * that never reached Shopify (the account is still being taxed) and one that has
 * lapsed (the account is being under-taxed). Both are computed here rather than
 * read off `status`, which is only as fresh as the last sweep.
 */
export const listAllCertificates = query({
    args: {},
    handler: async (ctx) => {
        const certs = await ctx.db.query("resaleCertificates").collect();
        certs.sort((a, b) => b.submittedAt - a.submittedAt);

        const now = Date.now();
        const accounts = await ctx.db.query("portalAccounts").collect();
        const byOrg = new Map(accounts.map((a) => [a.clerkOrgId, a]));

        const rows = await Promise.all(
            certs.map(async (cert) => {
                const account = byOrg.get(cert.clerkOrgId);
                const lapsed =
                    cert.status === "approved" &&
                    cert.expiresAt !== undefined &&
                    cert.expiresAt <= now;

                return {
                    ...cert,
                    companyName: account?.companyName ?? "Unknown account",
                    accountNumber: account?.accountNumber ?? null,
                    billingEmail: account?.billingEmail ?? null,
                    shopifyCustomerId: account?.shopifyCustomerId ?? null,
                    documentUrl: cert.documentStorageId
                        ? await ctx.storage.getUrl(cert.documentStorageId)
                        : null,
                    // Approved here but never written to Shopify: the customer
                    // believes they are exempt and checkout still charges tax.
                    awaitingShopifySync: cert.status === "approved" && !cert.shopifySyncedAt,
                    // Past its expiry but not yet swept — Shopify may still be
                    // exempting this account.
                    lapsed,
                };
            }),
        );

        return {
            certificates: rows,
            counts: {
                pending: rows.filter((r) => r.status === "pending").length,
                approved: rows.filter((r) => r.status === "approved" && !r.lapsed).length,
                awaitingSync: rows.filter((r) => r.awaitingShopifySync).length,
                lapsed: rows.filter((r) => r.lapsed).length,
                rejected: rows.filter((r) => r.status === "rejected").length,
                expired: rows.filter((r) => r.status === "expired").length,
            },
        };
    },
});

export const approveResaleCertificate = mutation({
    args: {
        writeToken: v.string(),
        certificateId: v.id("resaleCertificates"),
        reviewerClerkUserId: v.string(),
        /** Certificates lapse; omit only for a state that issues no expiry. */
        expiresAt: v.optional(v.number()),
        reviewNote: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        const cert = await ctx.db.get(args.certificateId);
        if (!cert) throw new Error("certificate_not_found");
        if (cert.status !== "pending") throw new Error("certificate_not_pending");

        if (args.expiresAt !== undefined && args.expiresAt <= Date.now()) {
            throw new Error("expiry_must_be_in_the_future");
        }

        // Only one certificate entitles an account at a time. Superseding the
        // previous approval keeps `getActiveCertificateForOrg` unambiguous.
        const siblings = await ctx.db
            .query("resaleCertificates")
            .withIndex("by_orgId", (q) => q.eq("clerkOrgId", cert.clerkOrgId))
            .collect();

        for (const sibling of siblings) {
            if (sibling._id !== cert._id && sibling.status === "approved") {
                await ctx.db.patch(sibling._id, {
                    status: "revoked",
                    reviewNote: "Superseded by a newer approved certificate.",
                    reviewedAt: Date.now(),
                });
            }
        }

        await ctx.db.patch(cert._id, {
            status: "approved",
            reviewedAt: Date.now(),
            reviewedBy: args.reviewerClerkUserId,
            reviewNote: args.reviewNote,
            expiresAt: args.expiresAt,
        });

        // Deliberately does NOT set shopifyExemptionCode — the exemption is not
        // real until it is written onto the Shopify customer.
        return {
            certificateId: cert._id,
            clerkOrgId: cert.clerkOrgId,
            issuingState: cert.issuingState,
        };
    },
});

export const rejectResaleCertificate = mutation({
    args: {
        writeToken: v.string(),
        certificateId: v.id("resaleCertificates"),
        reviewerClerkUserId: v.string(),
        reviewNote: v.string(),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        const reviewNote = args.reviewNote.trim();
        if (!reviewNote) throw new Error("rejection_reason_required");

        const cert = await ctx.db.get(args.certificateId);
        if (!cert) throw new Error("certificate_not_found");
        if (cert.status !== "pending") throw new Error("certificate_not_pending");

        await ctx.db.patch(cert._id, {
            status: "rejected",
            reviewedAt: Date.now(),
            reviewedBy: args.reviewerClerkUserId,
            reviewNote,
        });

        return { certificateId: cert._id };
    },
});

// ─── Shopify sync + expiry ──────────────────────────────────────────────────

/**
 * Record that the exemption reached Shopify. Called only after the Admin API
 * write succeeds, so `shopifySyncedAt` never claims more than actually happened.
 */
export const markCertificateSyncedToShopify = mutation({
    args: {
        writeToken: v.string(),
        certificateId: v.id("resaleCertificates"),
        shopifyExemptionCode: v.string(),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        const cert = await ctx.db.get(args.certificateId);
        if (!cert) throw new Error("certificate_not_found");
        if (cert.status !== "approved") throw new Error("certificate_not_approved");

        await ctx.db.patch(cert._id, {
            shopifyExemptionCode: args.shopifyExemptionCode,
            shopifySyncedAt: Date.now(),
        });

        return { certificateId: cert._id };
    },
});

/**
 * Flip approved-but-lapsed certificates to `expired`.
 *
 * Returns the orgs whose exemption must now be revoked in Shopify — this
 * mutation cannot call the Admin API itself, and a certificate that lapsed here
 * while Shopify still says exempt is exactly the untaxed-sale exposure the whole
 * feature exists to prevent.
 */
export const expireLapsedCertificates = mutation({
    args: { writeToken: v.string(), now: v.optional(v.number()) },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const now = args.now ?? Date.now();

        const approved = await ctx.db
            .query("resaleCertificates")
            .withIndex("by_status", (q) => q.eq("status", "approved"))
            .collect();

        const expired: Array<{
            certificateId: string;
            clerkOrgId: string;
            needsShopifyRevoke: boolean;
        }> = [];

        for (const cert of approved) {
            if (cert.expiresAt === undefined || cert.expiresAt > now) continue;

            await ctx.db.patch(cert._id, { status: "expired" });
            expired.push({
                certificateId: cert._id,
                clerkOrgId: cert.clerkOrgId,
                needsShopifyRevoke: cert.shopifySyncedAt !== undefined,
            });
        }

        return { expiredCount: expired.length, expired };
    },
});
