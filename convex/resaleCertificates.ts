/**
 * resaleCertificates — the document that makes an order tax-free.
 *
 * Jordan, on the pricing model: "This is just one price. It's not wholesale.
 * It's one price. If customers show a sales permit or sales license, they get
 * tax-free." Everyone pays the same. The ONLY thing an account changes is
 * whether tax is charged — which makes this module the whole of wholesale
 * identity, and worth getting exactly right.
 *
 * THE ONE RULE: EXEMPTION IS DERIVED, NEVER STORED.
 *
 * `portalAccounts.taxExempt` is a boolean seeded from QuickBooks. A boolean
 * cannot expire. A resale certificate can, and does — so the day one lapses,
 * a stored flag keeps asserting an exemption the business is no longer
 * entitled to claim, and that is a tax liability, not a display bug.
 * getExemptionStatus computes the answer from the certificates on file every
 * time it is asked. There is deliberately no "expired" status to write and no
 * cron to age rows: between cron runs the database would be lying.
 *
 * WHAT FEEDS SHOPIFY. Best Bottles is on Shopify Plus, so a Multipass session
 * carries the buyer into a headless checkout as a real customer, and Shopify
 * applies exemption from the CUSTOMER RECORD. So the flow is:
 *     certificate approved here -> Admin API sets the exemption on the Shopify
 *     customer -> the authenticated cart is charged no tax.
 * That Shopify write is deliberately NOT in this module: this owns the truth,
 * a separate syncer owns the side effect, and the syncer reads
 * getExemptionStatus rather than a flag someone might have hand-edited.
 *
 * NOT ENFORCEMENT. Per Jordan's decision an unapproved buyer is charged tax
 * but is never blocked from purchasing. Nothing here refuses a sale.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

/** Staff-only calls share the write token the other convex modules use. */
function verifyWriteToken(writeToken: string) {
    const expected = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!expected) throw new Error("convex_write_token_not_configured");
    if (writeToken !== expected) throw new Error("unauthorized_convex_write");
}

/** ISO "YYYY-MM-DD" for a timestamp, compared as a string.
 *  Lexicographic order IS chronological order for ISO dates, so no Date
 *  parsing and no timezone to get wrong. */
function isoDay(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
}

export type ExemptionStatus = {
    exempt: boolean;
    /** why — so the portal can say something true rather than "Taxable" */
    reason:
        | "approved"
        | "no_certificate"
        | "awaiting_review"
        | "rejected"
        | "revoked"
        | "expired";
    certificate: Doc<"resaleCertificates"> | null;
    /** set when an approved certificate has a stated expiry */
    expiresOn?: string;
    /** counts down; negative means it lapsed that many days ago */
    daysUntilExpiry?: number;
};

/**
 * The answer, computed. Approved AND not past its stated expiry.
 *
 * An absent expiresOn is a BLANKET certificate — valid until revoked — and is
 * not treated as expired. Conflating "no expiry" with "expired" would silently
 * tax the accounts most likely to be long-standing.
 *
 * When several certificates are on file (a renewal, or a second state) the
 * best one wins: any live approved certificate exempts the order.
 */
export function deriveExemption(
    certs: Doc<"resaleCertificates">[],
    nowMs: number,
): ExemptionStatus {
    if (certs.length === 0) {
        return { exempt: false, reason: "no_certificate", certificate: null };
    }
    const today = isoDay(nowMs);
    const approved = certs.filter((c) => c.status === "approved");

    // a live one exempts; prefer the one that lasts longest
    const live = approved
        .filter((c) => !c.expiresOn || c.expiresOn >= today)
        .sort((a, b) => (b.expiresOn ?? "9999-12-31").localeCompare(a.expiresOn ?? "9999-12-31"));
    if (live.length > 0) {
        const c = live[0];
        const out: ExemptionStatus = { exempt: true, reason: "approved", certificate: c };
        if (c.expiresOn) {
            out.expiresOn = c.expiresOn;
            out.daysUntilExpiry = Math.floor(
                (Date.parse(`${c.expiresOn}T00:00:00Z`) - nowMs) / 86_400_000,
            );
        }
        return out;
    }

    // nothing live — say which of the near misses it is, newest first
    const newest = [...certs].sort((a, b) => b.submittedAt - a.submittedAt)[0];
    if (approved.length > 0) {
        const lapsed = approved
            .sort((a, b) => (b.expiresOn ?? "").localeCompare(a.expiresOn ?? ""))[0];
        return {
            exempt: false, reason: "expired", certificate: lapsed,
            expiresOn: lapsed.expiresOn,
            daysUntilExpiry: lapsed.expiresOn
                ? Math.floor((Date.parse(`${lapsed.expiresOn}T00:00:00Z`) - nowMs) / 86_400_000)
                : undefined,
        };
    }
    if (certs.some((c) => c.status === "submitted")) {
        const pending = certs
            .filter((c) => c.status === "submitted")
            .sort((a, b) => b.submittedAt - a.submittedAt)[0];
        return { exempt: false, reason: "awaiting_review", certificate: pending };
    }
    return {
        exempt: false,
        reason: newest.status === "revoked" ? "revoked" : "rejected",
        certificate: newest,
    };
}

/* ------------------------------------------------------------------ reads */

export const getExemptionStatus = query({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args): Promise<ExemptionStatus> => {
        const certs = await ctx.db
            .query("resaleCertificates")
            .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .collect();
        return deriveExemption(certs, Date.now());
    },
});

export const listForOrg = query({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args) => {
        const certs = await ctx.db
            .query("resaleCertificates")
            .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .collect();
        certs.sort((a, b) => b.submittedAt - a.submittedAt);
        // the document is served through a short-lived Convex URL, never a
        // raw storage id, so a certificate scan cannot leak by guessing
        return Promise.all(certs.map(async (c) => ({
            ...c,
            documentUrl: c.blobId ? await ctx.storage.getUrl(c.blobId) : null,
        })));
    },
});

/** Staff review queue: everything waiting, oldest first — and separately the
 *  approved ones about to lapse, because a renewal chased late is a customer
 *  charged tax by surprise. */
export const listReviewQueue = query({
    args: { writeToken: v.string(), expiringWithinDays: v.optional(v.number()) },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const submitted = await ctx.db
            .query("resaleCertificates")
            .withIndex("by_status", (q) => q.eq("status", "submitted"))
            .collect();
        submitted.sort((a, b) => a.submittedAt - b.submittedAt);

        const horizon = args.expiringWithinDays ?? 60;
        const cutoff = isoDay(Date.now() + horizon * 86_400_000);
        const today = isoDay(Date.now());
        const approved = await ctx.db
            .query("resaleCertificates")
            .withIndex("by_status", (q) => q.eq("status", "approved"))
            .collect();
        const expiringSoon = approved
            .filter((c) => c.expiresOn && c.expiresOn >= today && c.expiresOn <= cutoff)
            .sort((a, b) => (a.expiresOn ?? "").localeCompare(b.expiresOn ?? ""));
        const lapsed = approved
            .filter((c) => c.expiresOn && c.expiresOn < today)
            .sort((a, b) => (b.expiresOn ?? "").localeCompare(a.expiresOn ?? ""));

        return { submitted, expiringSoon, lapsed };
    },
});

/* ----------------------------------------------------------------- writes */

/** One-shot upload URL for the certificate scan (same lane as graceUploads). */
export const generateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const submit = mutation({
    args: {
        clerkOrgId: v.string(),
        permitNumber: v.string(),
        issuingState: v.string(),
        blobId: v.optional(v.id("_storage")),
        fileName: v.optional(v.string()),
        mime: v.optional(v.string()),
        issuedOn: v.optional(v.string()),
        expiresOn: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const permitNumber = args.permitNumber.trim();
        const issuingState = args.issuingState.trim().toUpperCase();
        if (!permitNumber) throw new Error("permit_number_required");
        if (issuingState.length !== 2) throw new Error("issuing_state_must_be_2_letter");
        // A certificate that is already expired on the day it is submitted is
        // a paperwork error, and catching it here saves a reviewer the trip.
        if (args.expiresOn && args.expiresOn < isoDay(Date.now())) {
            throw new Error("certificate_already_expired");
        }
        return await ctx.db.insert("resaleCertificates", {
            clerkOrgId: args.clerkOrgId,
            blobId: args.blobId,
            fileName: args.fileName,
            mime: args.mime,
            permitNumber,
            issuingState,
            issuedOn: args.issuedOn,
            expiresOn: args.expiresOn,
            status: "submitted",
            submittedAt: Date.now(),
        });
    },
});

/** Employee decision. Rejection must say why — a buyer who is charged tax is
 *  owed a reason they can act on. */
export const review = mutation({
    args: {
        writeToken: v.string(),
        certificateId: v.id("resaleCertificates"),
        decision: v.union(v.literal("approved"), v.literal("rejected"), v.literal("revoked")),
        reviewedBy: v.string(),
        reviewNote: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const cert = await ctx.db.get(args.certificateId);
        if (!cert) throw new Error("certificate_not_found");
        if (args.decision !== "approved" && !args.reviewNote?.trim()) {
            throw new Error("review_note_required_when_not_approving");
        }
        await ctx.db.patch(args.certificateId, {
            status: args.decision,
            reviewedAt: Date.now(),
            reviewedBy: args.reviewedBy,
            reviewNote: args.reviewNote?.trim(),
        });
        // NOTE: the Shopify customer's exemption is NOT written here. A
        // separate syncer reads getExemptionStatus and pushes it, so the
        // side effect always follows the derived truth rather than racing it.
        return await ctx.db.get(args.certificateId);
    },
});
