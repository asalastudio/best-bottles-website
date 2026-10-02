"use client";
import { useActionState, useState } from "react";
import { approveCertificateAction, rejectCertificateAction, retryCertificateSyncAction, type CertificateReviewState } from "@/app/(portal)/portal/actions";
const initial: CertificateReviewState = { ok: false, message: "" };
export default function CertificateReviewActions({ certificateId, retry = false, hasDocument = true }: { certificateId: string; retry?: boolean; hasDocument?: boolean }) {
    const [lastAction, setLastAction] = useState("approve");
    const [approval, approve, approving] = useActionState((_state: CertificateReviewState, form: FormData) => { setLastAction("approve"); return (retry ? retryCertificateSyncAction : approveCertificateAction)(form); }, initial);
    const [rejection, reject, rejecting] = useActionState((_state: CertificateReviewState, form: FormData) => { setLastAction("reject"); return rejectCertificateAction(form); }, initial);
    return <div className="mt-4 border-t border-neutral-100 pt-4 text-sm">
        <form action={approve} className="flex items-end gap-3">
            <input type="hidden" name="certificateId" value={certificateId} />
            {!retry && <label>Expires<input type="date" name="expiresAt" className="ml-2 rounded border p-2" /></label>}
            <button disabled={approving || rejecting || !hasDocument} className="rounded bg-neutral-900 px-3 py-2 text-white disabled:opacity-40">{approving ? "Saving…" : retry ? "Retry checkout sync" : "Approve review"}</button>
        </form>
        {!hasDocument && <p>A verified supporting document is required before approval.</p>}
        {!retry && <form action={reject} className="mt-3 flex gap-2">
            <input type="hidden" name="certificateId" value={certificateId} />
            <label className="flex-1">Reason shown to customer<input name="reviewNote" required maxLength={2000} className="ml-2 rounded border p-2" /></label>
            <button disabled={approving || rejecting} className="rounded border px-3 py-2">Reject</button>
        </form>}
        {(approval.message || rejection.message) && <p role="status" className="mt-2">{lastAction === "approve" ? approval.message : rejection.message}</p>}
    </div>;
}
