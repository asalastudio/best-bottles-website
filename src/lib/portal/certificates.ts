import "server-only";

import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { CLERK_ENABLED } from "@/lib/clerk";
import { listTaxedOrdersForEmailSince, type PendingWindowOrders } from "@/lib/shopify-orders";
import {
    setShopifyCustomerTaxExempt,
    ShopifyCustomerScopeError,
    usResellerExemptionFor,
} from "@/lib/shopify-customers";
import { getPortalConvex, getPortalConvexWriteToken } from "./convexClient";
import { ensureShopifyCustomerForOrg, requirePortalViewer } from "./server";
import { requireStaffViewer } from "./staff";

/**
 * Resale certificates — server-side entry points for the portal and the staff
 * review queue.
 *
 * The load-bearing rule lives in `approveCertificateAsStaff`: approving in Convex
 * and exempting in Shopify are two separate writes, and only the second one makes
 * checkout untaxed. This layer reports which of them actually happened instead of
 * collapsing them into a single "approved", so a reviewer is never told tax is
 * handled when Shopify still disagrees.
 */

// ─── Customer side ──────────────────────────────────────────────────────────

export async function generateCertificateUploadUrlForViewer() {
    await requirePortalViewer();
    return await getPortalConvex().mutation(
        api.resaleCertificates.generateCertificateUploadUrl,
        { writeToken: getPortalConvexWriteToken() },
    );
}

export async function submitResaleCertificateForViewer(input: {
    legalBusinessName: string;
    issuingState: string;
    permitNumber: string;
    documentStorageId?: string;
}) {
    const viewer = await requirePortalViewer();

    // Reject a state we cannot map before it reaches a reviewer — approving it
    // later would produce an approval that can never be written to Shopify.
    if (!usResellerExemptionFor(input.issuingState)) {
        throw new Error("unsupported_issuing_state");
    }

    return await getPortalConvex().mutation(
        api.resaleCertificates.submitResaleCertificate,
        {
            writeToken: getPortalConvexWriteToken(),
            clerkOrgId: viewer.clerkOrgId,
            clerkUserId: viewer.clerkUserId,
            legalBusinessName: input.legalBusinessName,
            issuingState: input.issuingState,
            permitNumber: input.permitNumber,
            documentStorageId: input.documentStorageId as Id<"_storage"> | undefined,
        },
    );
}

export async function getCertificatesForViewer(): Promise<{
    certificates: Doc<"resaleCertificates">[];
    active: Doc<"resaleCertificates"> | null;
}> {
    // Annotated because the Clerk-disabled early return would otherwise narrow
    // `certificates` to never[], and callers could not read a row's fields.
    if (!CLERK_ENABLED) return { certificates: [], active: null };

    const viewer = await requirePortalViewer();
    const [certificates, active] = await Promise.all([
        getPortalConvex().query(api.resaleCertificates.listCertificatesByOrg, {
            clerkOrgId: viewer.clerkOrgId,
        }),
        getPortalConvex().query(api.resaleCertificates.getActiveCertificateForOrg, {
            clerkOrgId: viewer.clerkOrgId,
        }),
    ]);

    return { certificates, active };
}

// ─── Staff review queue ─────────────────────────────────────────────────────

/**
 * Master view: every certificate, plus the counts that matter operationally.
 *
 * Pending rows are enriched with the tax the customer has already paid since
 * submitting — the reviewer needs to see the consequence of the delay before
 * approving, not discover it afterwards. Shopify is queried only for pending
 * rows, and a failure there degrades the panel rather than the whole dashboard:
 * being unable to price the refund is no reason to block review.
 */
export async function listAllCertificatesForStaff() {
    await requireStaffViewer();
    const data = await getPortalConvex().query(api.resaleCertificates.listAllCertificates, {});

    const exposure = new Map<string, PendingWindowOrders | null>();
    await Promise.all(
        data.certificates
            .filter((cert) => cert.status === "pending")
            .map(async (cert) => {
                try {
                    exposure.set(
                        cert._id,
                        await listTaxedOrdersForEmailSince(cert.billingEmail, cert.submittedAt),
                    );
                } catch {
                    exposure.set(cert._id, null);
                }
            }),
    );

    return {
        ...data,
        certificates: data.certificates.map((cert) => ({
            ...cert,
            pendingWindow: exposure.get(cert._id) ?? null,
        })),
    };
}

export async function listPendingCertificatesForStaff() {
    await requireStaffViewer();
    return await getPortalConvex().query(
        api.resaleCertificates.listPendingCertificates,
        {},
    );
}

export type ApprovalOutcome = {
    certificateId: string;
    /** Always true once this resolves — the Convex record is approved. */
    approved: true;
    /** Whether Shopify now actually exempts this account. */
    exemptionLive: boolean;
    shopifyExemptionCode?: string;
    /** Why the exemption did not reach Shopify, when it did not. */
    syncBlockedReason?:
        | "no_portal_account"
        | "no_billing_email"
        | "shopify_scope_missing"
        | "unsupported_issuing_state"
        | "shopify_write_failed";
    syncDetail?: string;
};

/**
 * Approve a certificate and push the exemption to Shopify.
 *
 * The Convex approval is committed first and is never rolled back if the Shopify
 * write fails: the employee's decision is a real fact worth keeping, and the
 * account is simply still taxed until the sync is retried. The returned
 * `exemptionLive` is what the UI must show — not the approval itself.
 */
export async function approveCertificateAsStaff(input: {
    certificateId: string;
    expiresAt?: number;
    reviewNote?: string;
}): Promise<ApprovalOutcome> {
    const staff = await requireStaffViewer();
    const certificateId = input.certificateId as Id<"resaleCertificates">;

    const approved = await getPortalConvex().mutation(
        api.resaleCertificates.approveResaleCertificate,
        {
            writeToken: getPortalConvexWriteToken(),
            certificateId,
            reviewerClerkUserId: staff.clerkUserId,
            expiresAt: input.expiresAt,
            reviewNote: input.reviewNote,
        },
    );

    const base = { certificateId: String(approved.certificateId), approved: true as const };

    const exemptionCode = usResellerExemptionFor(approved.issuingState);
    if (!exemptionCode) {
        return { ...base, exemptionLive: false, syncBlockedReason: "unsupported_issuing_state" };
    }

    // No fallback email: this account's own billing address, or nothing. A
    // reviewer's address must never become the customer of record.
    const identity = await ensureShopifyCustomerForOrg(approved.clerkOrgId);
    if (identity.status === "unavailable") {
        return {
            ...base,
            exemptionLive: false,
            syncBlockedReason:
                identity.reason === "shopify_scope_missing"
                    ? "shopify_scope_missing"
                    : identity.reason === "no_billing_email"
                      ? "no_billing_email"
                      : "no_portal_account",
            syncDetail: identity.detail,
        };
    }

    try {
        await setShopifyCustomerTaxExempt(
            `gid://shopify/Customer/${identity.shopifyCustomerId}`,
            true,
            [exemptionCode],
        );
    } catch (err) {
        return {
            ...base,
            exemptionLive: false,
            syncBlockedReason:
                err instanceof ShopifyCustomerScopeError
                    ? "shopify_scope_missing"
                    : "shopify_write_failed",
            syncDetail: err instanceof Error ? err.message : String(err),
        };
    }

    // Recorded only now, so shopifySyncedAt never overstates what happened.
    await getPortalConvex().mutation(
        api.resaleCertificates.markCertificateSyncedToShopify,
        {
            writeToken: getPortalConvexWriteToken(),
            certificateId,
            shopifyExemptionCode: exemptionCode,
        },
    );

    return { ...base, exemptionLive: true, shopifyExemptionCode: exemptionCode };
}

export async function rejectCertificateAsStaff(input: {
    certificateId: string;
    reviewNote: string;
}) {
    const staff = await requireStaffViewer();

    return await getPortalConvex().mutation(
        api.resaleCertificates.rejectResaleCertificate,
        {
            writeToken: getPortalConvexWriteToken(),
            certificateId: input.certificateId as Id<"resaleCertificates">,
            reviewerClerkUserId: staff.clerkUserId,
            reviewNote: input.reviewNote,
        },
    );
}
