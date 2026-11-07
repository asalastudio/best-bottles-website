"use client";

import { useState, type FormEvent } from "react";

const MAX = 1000;

/**
 * Question to the team. Email is optional and only collected for a reply,
 * behind an unticked consent box. Nothing submitted here is published
 * automatically.
 */
export default function HelpQuestionForm({ defaultQuestion = "" }: { defaultQuestion?: string }) {
    const [question, setQuestion] = useState(defaultQuestion.slice(0, MAX));
    const [wantsReply, setWantsReply] = useState(false);
    const [email, setEmail] = useState("");
    const [consent, setConsent] = useState(false);
    const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
    const [error, setError] = useState("");

    async function submit(event: FormEvent) {
        event.preventDefault();
        setError("");
        if (wantsReply && !consent) {
            setError("Please tick the box so we can use your email for the reply, or choose “No reply needed”.");
            return;
        }
        setState("sending");
        try {
            const response = await fetch("/api/help/questions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question, wantsReply, email: wantsReply ? email : undefined, consent: wantsReply && consent, pagePath: "/help/ask" }),
            });
            const data = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) throw new Error(data.error || "We couldn't send that. Please try again or email us.");
            setState("sent");
        } catch (err) {
            setState("error");
            setError(err instanceof Error ? err.message : "We couldn't send that. Please try again or email us.");
        }
    }

    if (state === "sent") {
        return (
            <div role="status" className="rounded-sm border border-champagne/70 bg-warm-white p-6">
                <h2 className="font-serif text-2xl">Thank you. We&apos;ve got your question.</h2>
                <p className="mt-2 text-sm text-slate">
                    {wantsReply ? "Our team will email you the answer." : "Our team will review it. If it’s a common question, the answer may be added to the help center."}
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="flex flex-col gap-5 rounded-sm border border-champagne/70 bg-warm-white p-5 sm:p-8">
            <div className="flex flex-col gap-1.5">
                <label htmlFor="hq-question" className="text-sm font-medium">Your question</label>
                <textarea
                    id="hq-question"
                    required
                    minLength={3}
                    maxLength={MAX}
                    rows={4}
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    className="rounded-md border border-champagne bg-white p-3 text-base focus:border-gold-dim focus:outline-none focus:ring-2 focus:ring-muted-gold/30"
                />
                <span className="text-xs text-slate">Please don&apos;t include order numbers, card details or other personal information.</span>
            </div>

            <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">Would you like a reply?</legend>
                <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input type="radio" name="reply" checked={!wantsReply} onChange={() => setWantsReply(false)} className="h-5 w-5 accent-obsidian" />
                    No reply needed
                </label>
                <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input type="radio" name="reply" checked={wantsReply} onChange={() => setWantsReply(true)} className="h-5 w-5 accent-obsidian" />
                    Yes, email me the answer
                </label>
            </fieldset>

            {wantsReply && (
                <>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="hq-email" className="text-sm font-medium">Email</label>
                        <input
                            id="hq-email"
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            className="h-12 max-w-md rounded-md border border-champagne bg-white px-3 text-base focus:border-gold-dim focus:outline-none focus:ring-2 focus:ring-muted-gold/30"
                        />
                    </div>
                    <label className="flex items-start gap-3 text-sm leading-relaxed text-obsidian/80">
                        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-obsidian" />
                        <span>
                            Best Bottles may use my email to answer this question only. It won&apos;t be added to marketing lists.{" "}
                            <a href="/privacy" className="text-gold-dim underline underline-offset-4">Privacy policy</a>
                        </span>
                    </label>
                </>
            )}

            <p className="text-xs text-slate">Our team reviews every question before anything is published. Names and emails are never published.</p>

            {error && <p role="alert" className="text-sm text-[#8A2E20]">{error}</p>}

            <button type="submit" disabled={state === "sending"} className="h-12 self-start rounded-md bg-obsidian px-6 text-sm font-medium text-warm-white hover:bg-obsidian/90 disabled:opacity-60">
                {state === "sending" ? "Sending…" : "Send question"}
            </button>
        </form>
    );
}
