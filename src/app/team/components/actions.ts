"use server";
import { componentReviewHistory, loadComponentReviews, saveComponentReview, componentReviewChoices, applyComponentReview, type SaveReviewInput, type ApplyReviewInput } from "@/lib/team/componentReviewStaff";
import { revalidatePath, updateTag } from "next/cache";
import { isStaffAccessError } from "@/lib/portal/staff";

function failure(error: unknown) {
    return { ok: false as const, error: isStaffAccessError(error)
        ? "Sign in with a Best Bottles staff account to review components."
        : "The shared review database is unavailable. Nothing was saved. Refresh or contact the team managing this release." };
}
export async function refreshComponentQueueAction() {
    try { return { ok: true as const, queue: await loadComponentReviews() }; } catch (error) { return failure(error); }
}
export async function saveComponentReviewAction(input: SaveReviewInput) {
    try { return await saveComponentReview(input); } catch (error) { return failure(error); }
}
export async function componentReviewHistoryAction(caseId: string) {
    try { return { ok: true as const, history: await componentReviewHistory(caseId) }; } catch (error) { return failure(error); }
}
export async function componentReviewChoicesAction(caseId: string) {
    try { return { ok: true as const, choices: await componentReviewChoices(caseId) }; } catch (error) { return failure(error); }
}
export async function applyComponentReviewAction(input: ApplyReviewInput) {
    let result;
    try {
        result = await applyComponentReview(input);
    } catch (error) { return failure(error); }
    if (result.ok) {
        try {
            updateTag("bottle-components");
            revalidatePath("/matrix");
            revalidatePath("/products", "layout");
        } catch { return { ...result, warning: "Correction saved. Cache refresh failed; cached builder choices may take up to five minutes to refresh." }; }
    }
    return { ...result, warning: null };
}
