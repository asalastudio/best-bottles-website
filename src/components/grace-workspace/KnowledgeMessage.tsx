"use client";

import type { EmployeeKnowledgeMessage } from "@/lib/knowledge/useEmployeeKnowledgeChat";

export default function KnowledgeMessage({
    message,
    onCorrect,
    correctionOpen = false,
}: {
    message: EmployeeKnowledgeMessage;
    onCorrect: (message: EmployeeKnowledgeMessage) => void;
    correctionOpen?: boolean;
}) {
    const isAssistant = message.role === "assistant";
    return (
        <article className={`mb-6 ${isAssistant ? "mr-auto max-w-[760px]" : "ml-auto max-w-[680px]"}`}>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.17em] text-slate">
                <span>{isAssistant ? "Internal answer" : "You"}</span>
                {isAssistant ? <span className="h-1 w-1 rounded-full bg-muted-gold" aria-hidden="true" /> : null}
                {isAssistant ? <span>Grace · Internal knowledge</span> : null}
            </div>
            <div className={`whitespace-pre-wrap text-[14px] leading-7 ${
                isAssistant
                    ? "border-l-2 border-muted-gold bg-white/55 px-5 py-4 text-obsidian"
                    : "bg-obsidian px-5 py-3 text-bone"
            }`}>
                {message.content}
            </div>
            {isAssistant && message.citations.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Answer sources">
                    {message.citations.map((citation) => {
                        const className = "inline-flex items-center border border-champagne/70 bg-linen px-2.5 py-1 text-[10px] font-semibold tracking-[0.04em] text-slate";
                        return citation.url ? (
                            <a key={citation.sourceId} href={citation.url} className={className} target="_blank" rel="noreferrer">
                                {citation.title}
                            </a>
                        ) : (
                            <span key={citation.sourceId} className={className}>{citation.title}</span>
                        );
                    })}
                </div>
            ) : null}
            {isAssistant && message.requestId ? (
                <button
                    type="button"
                    onClick={() => onCorrect(message)}
                    aria-expanded={correctionOpen}
                    className="mt-3 text-[11px] font-semibold text-slate underline decoration-champagne underline-offset-4 transition hover:text-obsidian"
                >
                    {correctionOpen ? "Correction form open" : "Suggest a correction"}
                </button>
            ) : null}
        </article>
    );
}
