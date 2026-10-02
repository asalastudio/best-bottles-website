import "server-only";
import type { CustomerDeclaredExpiration } from "./certificateExpiration";
import { randomBytes, createHash } from "node:crypto";
import { readBoundedDocument, validateCertificateBytes } from "./certificateDocumentValidation";
import { syncCertificate } from "./certificateSync";

import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { CLERK_ENABLED } from "@/lib/clerk";
import { listTaxedOrdersForEmailSince, type PendingWindowOrders } from "@/lib/shopify-orders";
import {
    setShopifyCustomerTaxExempt,
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
    const viewer = await requirePortalViewer();
    const ticket = randomBytes(32).toString("hex");
    const documentId = await getPortalConvex().mutation(api.certificateDocuments.issue, {
        writeToken: getPortalConvexWriteToken(), clerkOrgId: viewer.clerkOrgId,
        clerkUserId: viewer.clerkUserId, ticketHash: createHash("sha256").update(ticket).digest("hex"),
    });
    const deployment = new URL(process.env.NEXT_PUBLIC_CONVEX_URL ?? "");
    if (!deployment.hostname.endsWith(".convex.cloud")) throw new Error("upload_endpoint_not_configured");
    deployment.hostname = deployment.hostname.replace(/\.convex\.cloud$/, ".convex.site");
    return { url: `${deployment.origin}/certificate-upload`, ticket, documentId: String(documentId) };
}

export async function validateUploadedCertificateForViewer(documentId: string) {
    const viewer = await requirePortalViewer();
    const scope = { documentId: documentId as Id<"certificateDocuments">, clerkOrgId: viewer.clerkOrgId, clerkUserId: viewer.clerkUserId, writeToken: getPortalConvexWriteToken() };
    const doc = await getPortalConvex().query(api.certificateDocuments.forValidation, scope);
    if (!doc.url) throw new Error("document_not_available");
    const response = await fetch(doc.url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const validation = await validateCertificateBytes(await readBoundedDocument(response), response.headers.get("content-type")?.split(";")[0] ?? "");
    return getPortalConvex().mutation(api.certificateDocuments.markVerified, { ...scope, ...validation });
}

export async function submitResaleCertificateForViewer(input: {
    legalBusinessName: string;
    issuingState: string;
    permitNumber: string;
    documentStorageId?: string;
    customerDeclaredExpiration?: CustomerDeclaredExpiration;
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
            customerDeclaredExpiration: input.customerDeclaredExpiration,
        },
    );
}

export async function getCertificatesForViewer(): Promise<{
    certificates: Doc<"resaleCertificates">[];
    active: Doc<"resaleCertificates"> | null;
    asOf: number;
}> {
    // Annotated because the Clerk-disabled early return would otherwise narrow
    // `certificates` to never[], and callers could not read a row's fields.
    if (!CLERK_ENABLED) return { certificates: [], active: null, asOf: Date.now() };

    const viewer = await requirePortalViewer();
    const [certificates, active] = await Promise.all([
        getPortalConvex().query(api.resaleCertificates.listCertificatesByOrg, {
            writeToken: getPortalConvexWriteToken(),
            clerkOrgId: viewer.clerkOrgId,
        }),
        getPortalConvex().query(api.resaleCertificates.getActiveCertificateForOrg, {
            writeToken: getPortalConvexWriteToken(),
            clerkOrgId: viewer.clerkOrgId,
        }),
    ]);

    return { certificates, active, asOf: Date.now() };
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
    const data = await getPortalConvex().query(api.resaleCertificates.listAllCertificates, { writeToken: getPortalConvexWriteToken() });

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
        { writeToken: getPortalConvexWriteToken() },
    );
}

export type ApprovalOutcome = { certificateId: string; approved: true; exemptionLive: boolean; syncBlockedReason?: string };

async function syncApprovedCertificate(certificateId: string) {
    const convex = getPortalConvex();
    const writeToken = getPortalConvexWriteToken();
    const id = certificateId as Id<"resaleCertificates">;
    return syncCertificate(certificateId, {
        begin: (_id, attemptId) => convex.mutation(api.certificateWorkflow.beginSync, { writeToken, certificateId: id, attemptId }),
        finish: (_id, attemptId, result) => convex.mutation(api.certificateWorkflow.finishSync, { writeToken, certificateId: id, attemptId, ...result }),
        resolveCustomer: ensureShopifyCustomerForOrg,
        exemptionFor: usResellerExemptionFor,
        write: async (customerId, code) => { await setShopifyCustomerTaxExempt(`gid://shopify/Customer/${customerId}`, true, [code]); },
    });
}
export async function approveCertificateAsStaff(input: { certificateId: string; expiresAt?: number; reviewNote?: string }): Promise<ApprovalOutcome> {
    const staff = await requireStaffViewer();
    const result = await getPortalConvex().mutation(api.resaleCertificates.approveResaleCertificate, {
        writeToken: getPortalConvexWriteToken(), certificateId: input.certificateId as Id<"resaleCertificates">,
        reviewerClerkUserId: staff.clerkUserId, expiresAt: input.expiresAt, reviewNote: input.reviewNote,
    });
    return { certificateId: String(result.certificateId), approved: true, ...await syncApprovedCertificate(input.certificateId) };
}
export async function retryCertificateSyncAsStaff(certificateId: string) {
    await requireStaffViewer();
    return syncApprovedCertificate(certificateId);
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
