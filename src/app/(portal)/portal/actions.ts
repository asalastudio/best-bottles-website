"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SubmitDraftState } from "@/components/portal/SubmitDraftForm";
import type { AddressFormState } from "@/components/portal/PortalAddressForm";
import {
    addSkuToOpenDraftForViewer,
    searchProductsForViewer,
    setDraftLinesForViewer,
    submitDraftForViewer,
} from "@/lib/portal/draftEditor";
import {
    createGraceProjectForViewer,
    createPortalDraftForViewer,
    createPortalDraftFromOrderForViewer,
    discardDraftForViewer,
    renameGraceProjectForViewer,
    savePortalAddressesForViewer,
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

/**
 * Discard a draft. An unsubmitted draft is deleted outright; a submitted one
 * is archived, so the portal keeps its record of what was sent to Shopify.
 * Always lands back on the list, which is where the row just disappeared from.
 */
export async function discardDraftAction(formData: FormData) {
    const draftId = String(formData.get("draftId") ?? "");
    if (!draftId) return;

    await discardDraftForViewer(draftId);
    revalidatePath("/portal");
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

// ─── Shipping address ───────────────────────────────────────────────────────

/**
 * Save where this account's orders ship to and bill from.
 *
 * Reads the form twice under two prefixes rather than accepting a nested
 * object, because the two addresses are independent documents and a shared
 * field name would silently keep only one of them.
 */
export async function saveAddressAction(
    _prev: AddressFormState,
    formData: FormData,
): Promise<AddressFormState> {
    const read = (prefix: string) => ({
        contactName: String(formData.get(`${prefix}contactName`) ?? ""),
        company: String(formData.get(`${prefix}company`) ?? ""),
        phone: String(formData.get(`${prefix}phone`) ?? ""),
        address1: String(formData.get(`${prefix}address1`) ?? ""),
        address2: String(formData.get(`${prefix}address2`) ?? ""),
        city: String(formData.get(`${prefix}city`) ?? ""),
        provinceCode: String(formData.get(`${prefix}provinceCode`) ?? ""),
        zip: String(formData.get(`${prefix}zip`) ?? ""),
        countryCode: String(formData.get(`${prefix}countryCode`) ?? "US"),
    });

    const separateBilling = formData.get("separateBilling") === "on";

    const result = await savePortalAddressesForViewer({
        shippingAddress: read(""),
        billingAddress: separateBilling ? read("billing_") : null,
    });

    if (!result.ok) {
        return { ok: false, errors: result.errors, message: "Check the highlighted fields." };
    }

    revalidatePath("/portal/account");
    revalidatePath("/portal");
    revalidatePath("/portal/drafts");
    return {
        ok: true,
        errors: {},
        message: result.shopifyWarning ?? "Address saved. Orders will ship here.",
    };
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
    // A permit number alone is an assertion. Review means reading the actual
    // certificate against the state's registry, so a submission without the
    // document cannot be reviewed — it just sits in the queue with nothing to
    // open, which is exactly how the queue filled up with unreviewable rows.
    if (!documentStorageId) {
        return { ok: false, error: "Attach a photo or PDF of the certificate — we can't verify a permit number on its own." };
    }

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

export type AddToOrderState =
    | { ok: true; draftId: string; draftName: string; quantity: number }
    | { ok: false; message: string };

/**
 * Add one catalogue row to the customer's open order.
 *
 * Returns the outcome instead of redirecting: the buyer is working down a
 * table and adding several things, and bouncing them to the draft after each
 * click would cost them their place.
 */
export async function addToOrderAction(input: {
    sku: string;
    quantity: number;
    draftId?: string;
}): Promise<AddToOrderState> {
    const result = await addSkuToOpenDraftForViewer(input);

    if (!result.ok) {
        return {
            ok: false,
            message:
                result.reason === "no_price"
                    ? "No published price — ask your account manager."
                    : result.reason === "draft_closed"
                      ? "That order has already been sent."
                      : "We don't recognise that SKU.",
        };
    }

    revalidatePath("/portal");
    revalidatePath("/portal/drafts");
    revalidatePath(`/portal/drafts/${result.draftId}`);
    return { ok: true, draftId: result.draftId, draftName: result.draftName, quantity: result.quantity };
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

export async function searchProductsAction(term: string) {
    return await searchProductsForViewer(term);
}
