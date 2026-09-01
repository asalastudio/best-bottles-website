"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
    createGraceProjectForViewer,
    createPortalDraftForViewer,
    createPortalDraftFromOrderForViewer,
    submitResaleCertificateForViewer,
} from "@/lib/portal/server";

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

/** Submit a resale certificate. Returns a message rather than throwing so the
 *  form can say what went wrong — a buyer who is about to be charged tax
 *  deserves the reason, not a generic failure. */
export async function submitResaleCertificateAction(
    _prev: { error?: string; ok?: boolean } | null,
    formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
    try {
        await submitResaleCertificateForViewer({
            file: (formData.get("certificate") as File | null) ?? null,
            permitNumber: String(formData.get("permitNumber") ?? ""),
            issuingState: String(formData.get("issuingState") ?? ""),
            issuedOn: String(formData.get("issuedOn") ?? "") || undefined,
            expiresOn: String(formData.get("expiresOn") ?? "") || undefined,
        });
    } catch (err) {
        const raw = err instanceof Error ? err.message : "Submission failed.";
        // Convex throws machine codes; turn the ones a customer can act on
        // into something they can actually act on.
        const friendly: Record<string, string> = {
            permit_number_required: "Enter the permit or licence number.",
            issuing_state_must_be_2_letter: "Use the two-letter state code, e.g. CA.",
            certificate_already_expired: "That certificate has already expired — upload a current one.",
        };
        const key = Object.keys(friendly).find((k) => raw.includes(k));
        return { error: key ? friendly[key] : raw };
    }
    revalidatePath("/portal");
    revalidatePath("/portal/account");
    revalidatePath("/portal/documents");
    return { ok: true };
}
