import "server-only";
import { makeFunctionReference } from "convex/server";
import { requireStaffViewerOrLocalPreview } from "./createProductStaff";
import { getPortalConvex, getPortalConvexWriteToken } from "@/lib/portal/convexClient";
import type { ReviewDraft, ReviewQueue, SavedReview, ComponentChoices } from "../../../convex/componentReconciliationData";

export type SaveReviewInput = { caseId: string; evidenceSha: string; expectedRevision: number; draft: ReviewDraft };
type SaveArgs = SaveReviewInput & { writeToken: string; actor: { id: string; email: string | null } };
type SaveResult = { ok: true; review: SavedReview } | { ok: false; error: string };
const listRef = makeFunctionReference<"query", { writeToken: string }, ReviewQueue>("componentReconciliation:list");
const historyRef = makeFunctionReference<"query", { writeToken: string; caseId: string }, SavedReview[]>("componentReconciliation:history");
const saveRef = makeFunctionReference<"mutation", SaveArgs, SaveResult>("componentReconciliation:save");
const choicesRef = makeFunctionReference<"query", { writeToken: string; caseId: string }, ComponentChoices>("componentReconciliation:choices");
export type ApplyReviewInput = { caseId: string; evidenceSha: string; expectedReviewRevision: number; expectedCatalogVersion: number };
const applyRef = makeFunctionReference<"mutation", ApplyReviewInput & { writeToken: string; actor: { id: string; email: string | null } },
    { ok: true; appliedSku: string; catalogVersion: number } | { ok: false; error: string }>("componentReconciliation:apply");

export async function componentReviewChoices(caseId: string) {
    await requireStaffViewerOrLocalPreview();
    return getPortalConvex().query(choicesRef, { writeToken: getPortalConvexWriteToken(), caseId });
}
export async function applyComponentReview(input: ApplyReviewInput) {
    const viewer = await requireStaffViewerOrLocalPreview();
    return getPortalConvex().mutation(applyRef, { ...input, writeToken: getPortalConvexWriteToken(), actor: { id: viewer.clerkUserId, email: viewer.emailAddresses[0] ?? null } });
}

export async function loadComponentReviews() {
    await requireStaffViewerOrLocalPreview();
    return getPortalConvex().query(listRef, { writeToken: getPortalConvexWriteToken() });
}
export async function componentReviewHistory(caseId: string) {
    await requireStaffViewerOrLocalPreview();
    return getPortalConvex().query(historyRef, { writeToken: getPortalConvexWriteToken(), caseId });
}
export async function saveComponentReview(input: SaveReviewInput) {
    const viewer = await requireStaffViewerOrLocalPreview();
    return getPortalConvex().mutation(saveRef, { ...input, writeToken: getPortalConvexWriteToken(),
        actor: { id: viewer.clerkUserId, email: viewer.emailAddresses[0] ?? null } });
}
