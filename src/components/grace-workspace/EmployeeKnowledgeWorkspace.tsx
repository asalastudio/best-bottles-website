"use client";

import { useEffect, useRef, useState } from "react";
import WorkspaceShell from "@/components/grace-workspace/WorkspaceShell";
import DockedComposer from "@/components/grace-workspace/DockedComposer";
import KnowledgeMessage from "@/components/grace-workspace/KnowledgeMessage";
import {
    useEmployeeKnowledgeChat,
    type EmployeeKnowledgeMessage,
} from "@/lib/knowledge/useEmployeeKnowledgeChat";

const STARTERS = [
    "Which 9 mL Cylinder bottles use 17-415?",
    "What components fit a 17-415 neck?",
    "Compare clear and amber Cylinder options.",
];

export default function EmployeeKnowledgeWorkspace() {
    const { messages, input, setInput, isSending, error, send, reset, conversationId } = useEmployeeKnowledgeChat();
    const [correctionTarget, setCorrectionTarget] = useState<EmployeeKnowledgeMessage | null>(null);
    const [correctionCategory, setCorrectionCategory] = useState("product_truth");
    const [correctionText, setCorrectionText] = useState("");
    const [correctionSourceUrl, setCorrectionSourceUrl] = useState("");
    const [correctionStatus, setCorrectionStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isSending]);

    const handleReset = () => {
        setCorrectionTarget(null);
        setCorrectionStatus("idle");
        reset();
    };

    const openCorrection = (message: EmployeeKnowledgeMessage) => {
        setCorrectionTarget(message);
        setCorrectionCategory("product_truth");
        setCorrectionText("");
        setCorrectionSourceUrl("");
        setCorrectionStatus("idle");
    };

    const submitCorrection = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!correctionTarget || correctionText.trim().length < 10 || correctionStatus === "submitting") return;
        setCorrectionStatus("submitting");
        try {
            const response = await fetch("/api/knowledge/corrections", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    conversationId,
                    messageId: correctionTarget.id,
                    category: correctionCategory,
                    correction: correctionText,
                    sourceUrl: correctionSourceUrl || null,
                }),
            });
            if (!response.ok) throw new Error("Correction submission failed");
            setCorrectionStatus("success");
        } catch {
            setCorrectionStatus("error");
        }
    };

    return (
        <WorkspaceShell onNewConversation={handleReset}>
            <header className="shrink-0 border-b border-champagne/50 bg-linen/70 px-6 py-4">
                <div className="mx-auto flex max-w-[880px] items-start justify-between gap-6">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-gold">Best Bottles internal knowledge</p>
                        <h1 className="mt-1 font-serif text-[24px] leading-tight text-obsidian">Ask Grace across live product truth</h1>
                    </div>
                    <div className="hidden border border-champagne/60 bg-bone px-3 py-2 text-right text-[10px] leading-4 text-slate sm:block">
                        <strong className="block text-obsidian">Product truth: Convex</strong>
                        Policies: approved sources
                    </div>
                </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-7">
                <div className="mx-auto max-w-[880px]">
                    {messages.length === 0 ? (
                        <section className="mx-auto max-w-[720px] py-10 sm:py-16">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-gold">One verified operating brain</p>
                            <h2 className="mt-3 max-w-[620px] font-serif text-4xl leading-[1.08] text-obsidian sm:text-5xl">
                                Ask about products, fitments, policies, or customer questions.
                            </h2>
                            <p className="mt-5 max-w-[620px] text-sm leading-7 text-slate">
                                Grace checks live Convex catalog data for product claims and labels every approved policy source. She will not silently merge 13-415 and 17-415.
                            </p>
                            <div className="mt-8 grid gap-2 sm:grid-cols-3">
                                {STARTERS.map((starter) => (
                                    <button
                                        key={starter}
                                        type="button"
                                        onClick={() => void send(starter)}
                                        className="border border-champagne/65 bg-white/55 p-4 text-left text-[12px] leading-5 text-obsidian transition hover:border-muted-gold hover:bg-white"
                                    >
                                        {starter}
                                    </button>
                                ))}
                            </div>
                        </section>
                    ) : (
                        messages.map((message) => {
                            const correctionOpen = correctionTarget?.id === message.id;
                            return (
                                <div key={message.id}>
                                    <KnowledgeMessage
                                        message={message}
                                        onCorrect={openCorrection}
                                        correctionOpen={correctionOpen}
                                    />
                                    {correctionOpen ? (
                                        <form
                                            onSubmit={submitCorrection}
                                            className="mb-7 ml-auto max-w-[760px] border border-champagne/70 bg-linen p-5"
                                            aria-label="Suggest a correction"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-muted-gold">Controlled learning</p>
                                                    <h3 className="mt-1 font-serif text-xl text-obsidian">Submit for human review</h3>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setCorrectionTarget(null)}
                                                    className="text-xs text-slate underline underline-offset-4"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                            {correctionStatus === "success" ? (
                                                <p className="mt-4 border-l-2 border-emerald-600 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800" role="status">
                                                    Correction submitted for human review. No product data was changed.
                                                </p>
                                            ) : (
                                                <>
                                                    <label className="mt-4 block text-[11px] font-semibold text-obsidian">
                                                        Category
                                                        <select
                                                            value={correctionCategory}
                                                            onChange={(event) => setCorrectionCategory(event.target.value)}
                                                            className="mt-1.5 block w-full border border-champagne bg-bone px-3 py-2.5 text-sm"
                                                        >
                                                            <option value="product_truth">Product truth</option>
                                                            <option value="compatibility">Compatibility</option>
                                                            <option value="policy">Policy</option>
                                                            <option value="behavior">Grace behavior</option>
                                                            <option value="missing_knowledge">Missing knowledge</option>
                                                        </select>
                                                    </label>
                                                    <label className="mt-3 block text-[11px] font-semibold text-obsidian">
                                                        What should the reviewed answer say?
                                                        <textarea
                                                            value={correctionText}
                                                            onChange={(event) => setCorrectionText(event.target.value.slice(0, 2_000))}
                                                            minLength={10}
                                                            maxLength={2000}
                                                            required
                                                            rows={4}
                                                            className="mt-1.5 block w-full resize-y border border-champagne bg-bone px-3 py-2.5 text-sm leading-6"
                                                        />
                                                    </label>
                                                    <label className="mt-3 block text-[11px] font-semibold text-obsidian">
                                                        Supporting HTTPS source (optional)
                                                        <input
                                                            type="url"
                                                            pattern="https://.*"
                                                            value={correctionSourceUrl}
                                                            onChange={(event) => setCorrectionSourceUrl(event.target.value)}
                                                            placeholder="https://"
                                                            className="mt-1.5 block w-full border border-champagne bg-bone px-3 py-2.5 text-sm"
                                                        />
                                                    </label>
                                                    {correctionStatus === "error" ? (
                                                        <p className="mt-3 text-xs text-red-700" role="alert">The correction could not be submitted. Please try again.</p>
                                                    ) : null}
                                                    <button
                                                        type="submit"
                                                        disabled={correctionStatus === "submitting" || correctionText.trim().length < 10}
                                                        className="mt-4 bg-obsidian px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.13em] text-bone disabled:opacity-40"
                                                    >
                                                        {correctionStatus === "submitting" ? "Submitting…" : "Submit for review"}
                                                    </button>
                                                </>
                                            )}
                                        </form>
                                    ) : null}
                                </div>
                            );
                        })
                    )}

                    {isSending ? (
                        <div className="mb-5 flex items-center gap-2 text-xs text-slate" role="status">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-gold" />
                            Grace is checking approved sources…
                        </div>
                    ) : null}
                    {error ? <p className="mb-5 border-l-2 border-red-400 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">{error}</p> : null}
                    <div ref={endRef} />
                </div>
            </div>

            <div className="shrink-0 bg-bone px-6 pt-2 text-center text-[10px] uppercase tracking-[0.13em] text-slate">
                Typed internal mode · Grace voice (Marin) will remain separately controlled
            </div>
            <DockedComposer
                input={input}
                onInputChange={setInput}
                onSubmit={(text) => void send(text)}
                onToggleVoice={() => undefined}
                voiceEnabled={false}
                voiceAvailable={false}
                enableAttachments={false}
                disabled={isSending}
                placeholder="Ask Grace about products, fitments, policies, or operations"
                autoFocus
            />
        </WorkspaceShell>
    );
}
