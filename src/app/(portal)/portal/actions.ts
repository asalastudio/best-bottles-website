"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
    createGraceProjectForViewer,
    createPortalDraftForViewer,
    createPortalDraftFromOrderForViewer,
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
