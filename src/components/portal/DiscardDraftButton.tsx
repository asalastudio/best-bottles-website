"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

function ConfirmSubmit({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center h-8 px-2.5 font-sans text-[12.5px] font-medium rounded-md border transition-colors disabled:opacity-50"
            style={{
                borderColor: "var(--color-rule)",
                background: "var(--color-status-warning-surface)",
                color: "var(--color-status-warning-text)",
            }}
        >
            {pending ? "Working…" : label}
        </button>
    );
}

/**
 * Two-step discard.
 *
 * The first click only arms the control; the second one submits. A single
 * click would make a whole order disappear on a mis-tap, and `window.confirm`
 * both looks foreign here and is suppressed in some embedded browsers — an
 * inline confirm is visible proof that the click was deliberate.
 *
 * The verb tracks what actually happens on the server: an unsubmitted draft is
 * deleted, a submitted one is archived and still exists. Saying "Delete" over
 * an archive would be a lie the customer could later catch.
 */
export default function DiscardDraftButton({
    draftId,
    submitted,
    action,
}: {
    draftId: string;
    submitted: boolean;
    action: (formData: FormData) => void | Promise<void>;
}) {
    const [armed, setArmed] = useState(false);
    const verb = submitted ? "Archive" : "Discard";

    if (!armed) {
        return (
            <button
                type="button"
                onClick={() => setArmed(true)}
                aria-label={`${verb} this order`}
                className="inline-flex items-center justify-center h-8 px-2.5 font-sans text-[12.5px] font-medium rounded-md border bg-transparent transition-colors hover:bg-[color:var(--color-surface-sunken)]"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-text-secondary)" }}
            >
                {verb}
            </button>
        );
    }

    return (
        <form action={action} className="flex items-center gap-1.5">
            <input type="hidden" name="draftId" value={draftId} />
            <ConfirmSubmit label={submitted ? "Archive it" : "Discard it"} />
            <button
                type="button"
                onClick={() => setArmed(false)}
                className="inline-flex items-center justify-center h-8 px-2 font-sans text-[12.5px] rounded-md bg-transparent transition-colors hover:underline"
                style={{ color: "var(--color-text-muted)" }}
            >
                Cancel
            </button>
        </form>
    );
}
