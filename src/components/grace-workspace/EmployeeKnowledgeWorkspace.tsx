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
    const { messages, input, setInput, isSending, error, send, reset } = useEmployeeKnowledgeChat();
    const [correctionTarget, setCorrectionTarget] = useState<EmployeeKnowledgeMessage | null>(null);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isSending]);

    const handleReset = () => {
        setCorrectionTarget(null);
        reset();
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
                        messages.map((message) => (
                            <KnowledgeMessage key={message.id} message={message} onCorrect={setCorrectionTarget} />
                        ))
                    )}

                    {isSending ? (
                        <div className="mb-5 flex items-center gap-2 text-xs text-slate" role="status">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-gold" />
                            Grace is checking approved sources…
                        </div>
                    ) : null}
                    {error ? <p className="mb-5 border-l-2 border-red-400 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">{error}</p> : null}
                    {correctionTarget ? (
                        <p className="mb-5 border border-champagne/60 bg-linen px-4 py-3 text-xs text-slate">
                            Correction selected for request {correctionTarget.requestId}. Add the reviewed correction in the next step.
                        </p>
                    ) : null}
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
