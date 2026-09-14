"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SubmitDraftState } from "@/components/portal/SubmitDraftForm";
import {
    setDraftLinesForViewer,
    submitDraftForViewer,
} from "@/lib/portal/draftEditor";
import {
    createGraceProjectForViewer,
    createPortalDraftForViewer,
    createPortalDraftFromOrderForViewer,
    renameGraceProjectForViewer,
} from "@/lib/portal/server";
import {
    approveCertificateAsStaff,
    generateCertificateUploadUrlForViewer,
    rejectCertificateAsStaff,
    submitResaleCertificateForViewer,
} from "@/lib/portal/certificates";

export async function createDraftAction() {
    await createPortalDraftForViewer();
    revalidatePath("/portal");
    revalidatePath("/portal/drafts");
    redirect("/portal/drafts");
}

export async function reorderToDraftAction(formData: FormData) {
    const orderId = String(formData.get("orderId") ?? "");
    if (!orderId) return;

    await createPortalDraftFromOrderForViewer(orderId);
    revalidatePath("/portal");
    revalidatePath("/portal/orders");
    revalidatePath("/portal/drafts");
    redirect("/portal/drafts");
}

export async function createGraceProjectAction() {
    await createGraceProjectForViewer();
    revalidatePath("/portal/grace");
    redirect("/portal/grace");
}

export async function renameGraceProjectAction(formData: FormData) {
    const projectId = String(formData.get("projectId") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    if (!projectId || !name) return;

    await renameGraceProjectForViewer(projectId, name);
    revalidatePath("/portal/grace");
    redirect(`/portal/grace?project=${projectId}`);
}

// ─── Resale certificates ────────────────────────────────────────────────────

export async function createCertificateUploadUrlAction() {
    return await generateCertificateUploadUrlForViewer();
}

export type CertificateSubmitState = { error: string | null; ok: boolean };

const STATE_NAMES: Record<string, string> = { XX: "that state" };

export async function submitCertificateAction(
    _prev: CertificateSubmitState,
    formData: FormData,
): Promise<CertificateSubmitState> {
    const legalBusinessName = String(formData.get("legalBusinessName") ?? "").trim();
    const issuingState = String(formData.get("issuingState") ?? "").trim();
    const permitNumber = String(formData.get("permitNumber") ?? "").trim();
    const documentStorageId = String(formData.get("documentStorageId") ?? "").trim();

    if (!legalBusinessName) return { ok: false, error: "Enter the legal business name on the certificate." };
    if (!issuingState) return { ok: false, error: "Choose the state that issued the permit." };
    if (!permitNumber) return { ok: false, error: "Enter the seller's permit number." };

    try {
        await submitResaleCertificateForViewer({
            legalBusinessName,
            issuingState,
            permitNumber,
            documentStorageId: documentStorageId || undefined,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("unsupported_issuing_state")) {
            return {
                ok: false,
                error: `We can't apply a resale exemption for ${STATE_NAMES[issuingState] ?? issuingState} yet. Contact your account manager.`,
            };
        }
        return { ok: false, error: "We couldn't submit that certificate. Try again, or contact your account manager." };
    }

    revalidatePath("/portal/tax-exemption");
    revalidatePath("/portal");
    return { ok: true, error: null };
}

export async function approveCertificateAction(formData: FormData) {
    const certificateId = String(formData.get("certificateId") ?? "");
    const expiryRaw = String(formData.get("expiresAt") ?? "").trim();
    if (!certificateId) return;

    // A date input gives a local calendar day; certificates lapse at end of day.
    const expiresAt = expiryRaw ? new Date(`${expiryRaw}T23:59:59`).getTime() : undefined;

    await approveCertificateAsStaff({
        certificateId,
        expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
    });

    revalidatePath("/team/resale-certificates");
}

export async function rejectCertificateAction(formData: FormData) {
    const certificateId = String(formData.get("certificateId") ?? "");
    const reviewNote = String(formData.get("reviewNote") ?? "").trim();
    if (!certificateId || !reviewNote) return;

    await rejectCertificateAsStaff({ certificateId, reviewNote });
    revalidatePath("/team/resale-certificates");
}

// ─── Order pad ──────────────────────────────────────────────────────────────

/**
 * The pad sends SKUs and quantities only. Prices are resolved server-side from
 * Convex, because `unitPrice` becomes the Shopify price override and a
 * browser-supplied figure would be a way to buy at any price.
 */
export async function saveDraftLinesAction(
    draftId: string,
    lines: Array<{ sku: string; quantity: number }>,
) {
    const result = await setDraftLinesForViewer(draftId, lines);
    revalidatePath(`/portal/drafts/${draftId}`);
    revalidatePath("/portal/drafts");
    revalidatePath("/portal");
    return {
        rejected: result.rejected.map((r) => ({
            sku: "sku" in r ? r.sku : "",
            reason: "reason" in r ? r.reason : "unknown_sku",
        })),
        lineCount: result.lineCount,
        totalAmount: result.totalAmount,
    };
}

export async function submitDraftAction(
    _prev: SubmitDraftState,
    formData: FormData,
): Promise<SubmitDraftState> {
    const draftId = String(formData.get("draftId") ?? "");
    if (!draftId) return { error: "That draft is no longer available.", sentAs: null };

    const result = await submitDraftForViewer(draftId);
    if (!result.ok) return { error: result.error, sentAs: null };

    revalidatePath(`/portal/drafts/${draftId}`);
    revalidatePath("/portal/drafts");
    revalidatePath("/portal");
    return { error: null, sentAs: result.shopifyDraftOrderName };
}
