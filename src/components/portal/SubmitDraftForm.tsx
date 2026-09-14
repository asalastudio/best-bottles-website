"use client";

import { useActionState } from "react";
import { PortalButton } from "@/components/portal/ui";

export type SubmitDraftState = { error: string | null; sentAs: string | null };

const INITIAL: SubmitDraftState = { error: null, sentAs: null };

/**
 * Sending is deliberately its own deliberate step with its own button, rather
 * than something that can happen while editing quantities. Nothing is charged
 * by it — the order reaches Shopify as a draft for a person to review — but it
 * is still the moment the customer hands work over, so it should feel like one.
 */
export default function SubmitDraftForm({
    draftId,
    lineCount,
    submitAction,
}: {
    draftId: string;
    lineCount: number;
    submitAction: (prev: SubmitDraftState, formData: FormData) => Promise<SubmitDraftState>;
}) {
    const [state, action, pending] = useActionState(submitAction, INITIAL);

    return (
        <form action={action} className="mt-4 bg-white rounded-lg border border-neutral-200 px-5 py-5">
            <input type="hidden" name="draftId" value={draftId} />

            <h2 className="font-sans text-[14px] font-semibold text-neutral-900">
                Send to Best Bottles
            </h2>
            <p className="font-sans text-[13px] text-neutral-500 mt-1.5 leading-relaxed max-w-[560px]">
                Your order goes to Best Bottles for review. Nothing is charged now — your account
                manager confirms quantities and pricing, then sends the invoice.
            </p>

            {state.error && (
                <p className="font-sans text-[13px] text-red-600 mt-3">{state.error}</p>
            )}

            <div className="mt-4">
                <PortalButton type="submit" disabled={pending || lineCount === 0}>
                    {pending ? "Sending…" : "Send order"}
                </PortalButton>
                {lineCount === 0 && (
                    <span className="ml-3 font-sans text-[12px] text-neutral-400">
                        Add at least one item first.
                    </span>
                )}
            </div>
        </form>
    );
}
