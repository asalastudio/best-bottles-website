"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PortalButton } from "@/components/portal/ui";

export type SubmitDraftState = { error: string | null; sentAs: string | null };

const INITIAL: SubmitDraftState = { error: null, sentAs: null };

/**
 * Submitting is deliberately its own step with its own button, rather than
 * something that can happen while editing quantities. Nothing is charged by it
 * — the order reaches Best Bottles for a person to review — but it is still the
 * moment the customer hands work over, so it should feel like one.
 *
 * The word "draft" is Best Bottles' word, not the customer's: on the Shopify
 * side this lands under Orders → Drafts, but to the buyer it is simply their
 * order, and calling it a draft reads as "not real yet".
 */
export default function SubmitDraftForm({
    draftId,
    lineCount,
    hasAddress,
    submitAction,
}: {
    draftId: string;
    lineCount: number;
    /** Shopify cannot rate, tax, or fulfil an order with no address. */
    hasAddress: boolean;
    submitAction: (prev: SubmitDraftState, formData: FormData) => Promise<SubmitDraftState>;
}) {
    const [state, action, pending] = useActionState(submitAction, INITIAL);

    return (
        <form action={action} className="mt-4 bg-white rounded-lg border border-neutral-200 px-5 py-5">
            <input type="hidden" name="draftId" value={draftId} />

            <h2 className="font-sans text-[14px] font-semibold text-neutral-900">
                Submit this order
            </h2>
            <p className="font-sans text-[13px] text-neutral-500 mt-1.5 leading-relaxed max-w-[560px]">
                Best Bottles takes it from here. Nothing is charged now — your account manager
                confirms quantities and freight, then sends the invoice.
            </p>

            {!hasAddress && (
                <div className="mt-3 px-3 py-2.5 rounded-md bg-amber-50 border border-amber-200">
                    <p className="font-sans text-[13px] text-amber-800">
                        Add a shipping address before submitting — we can&rsquo;t ship or price
                        freight without one.{" "}
                        <Link href="/portal/account" className="underline underline-offset-2 font-medium">
                            Add it on your account
                        </Link>
                        .
                    </p>
                </div>
            )}

            {state.error && (
                <p className="font-sans text-[13px] text-red-600 mt-3">{state.error}</p>
            )}

            <div className="mt-4">
                <PortalButton type="submit" disabled={pending || lineCount === 0 || !hasAddress}>
                    {pending ? "Submitting…" : "Submit order"}
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
