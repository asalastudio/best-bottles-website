"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
    createGraceProjectForViewer,
    createPortalDraftForViewer,
    createPortalDraftFromOrderForViewer,
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
