import snapshot from "./component-reconciliation-snapshot.json";

export type ComponentFinding = {
    id: string; evidenceSha: string; family: string; capacityMl: number; glass: string;
    bottleSku: string; bottleName: string; neck: string | null; fitment: string; finish: string;
    componentSku: string; componentName: string; componentNeck: string | null;
    status: string; issues: string[]; sourceUrl: string | null; sourceDescription: string | null;
    componentSourceUrl: string | null; componentSourceDescription: string | null;
};
export const componentFindings = snapshot.rows as ComponentFinding[];
export const auditCheckedAt = snapshot.checkedAt as string | null;
export const REVIEW_DECISIONS = ["pending", "needs_information", "confirmed", "correction_proposed"] as const;
export type ReviewDecision = typeof REVIEW_DECISIONS[number];
export type ReviewDraft = { decision: ReviewDecision; correctComponentSku: string; notes: string; sourceUrl: string };
export type SavedReview = ReviewDraft & { caseId: string; evidenceSha: string; revision: number; actorId: string; actorEmail: string | null; updatedAt: number };
export type QueueRow = ComponentFinding & { review: SavedReview | null };
export type ReviewQueue = { checkedAt: string | null; rows: QueueRow[] };
export type ComponentCandidate = { sku: string; name: string; neck: string; kind: string };
export type ComponentChoices = { candidates: ComponentCandidate[]; catalogVersion: number; appliedSku: string | null };

export function validateReview(draft: ReviewDraft): string | null {
    if (!REVIEW_DECISIONS.includes(draft.decision)) return "Choose a review decision.";
    if (draft.notes.length > 4000 || draft.correctComponentSku.length > 120 || draft.sourceUrl.length > 1500) return "Review text exceeds the allowed length.";
    if (draft.decision !== "pending" && !draft.notes.trim()) return "Add a note explaining the decision.";
    if (draft.decision === "correction_proposed" && !draft.correctComponentSku.trim()) return "Enter the proposed correct component SKU.";
    if (draft.decision !== "correction_proposed" && draft.correctComponentSku.trim()) return "Choose Correction proposed to suggest a different component SKU.";
    if (["confirmed", "correction_proposed"].includes(draft.decision) && !draft.sourceUrl.trim()) return "Add a supporting source URL before confirming or proposing a correction.";
    if (draft.sourceUrl) {
        try { const url = new URL(draft.sourceUrl); if (url.protocol !== "https:" || url.username || url.password) return "Use an HTTPS evidence URL without credentials."; }
        catch { return "Enter a valid HTTPS evidence URL."; }
    }
    return null;
}
