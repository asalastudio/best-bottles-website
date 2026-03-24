"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
    createGraceProjectForViewer,
    createPortalDraftForViewer,
    createPortalDraftFromOrderForViewer,
    createDraftWithLineItemsForViewer,
} from "@/lib/portal/server";

export async function savePriceListToDraftAction(
    lineItems: Array<{ sku: string; description: string; quantity: number; unitPrice?: number }>,
    name?: string
) {
    await createDraftWithLineItemsForViewer(lineItems, name);
    revalidatePath("/portal");
    revalidatePath("/portal/drafts");
    revalidatePath("/portal/price-list");
    redirect("/portal/drafts");
}

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
