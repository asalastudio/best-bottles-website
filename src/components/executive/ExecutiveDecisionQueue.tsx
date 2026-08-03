"use client";

import { ArrowRight } from "@phosphor-icons/react";

import type { ExecutiveDecision } from "@/lib/executive/contracts";
import { cn } from "@/lib/utils";

const severityStyles: Record<ExecutiveDecision["severity"], string> = {
    critical: "text-rose-300",
    watch: "text-amber-300",
    assign: "text-sky-300",
};

type ExecutiveDecisionQueueProps = {
    decisions: ExecutiveDecision[];
    onOpenDecision: (decision: ExecutiveDecision) => void;
};

export function ExecutiveDecisionQueue({ decisions, onOpenDecision }: ExecutiveDecisionQueueProps) {
    return (
        <section id="decisions" aria-labelledby="decision-queue-title" className="border border-zinc-800 bg-zinc-900/80">
            <header className="flex items-start justify-between gap-4 border-b border-zinc-800 px-4 py-3">
                <div>
                    <h2 id="decision-queue-title" className="font-serif text-base text-zinc-100">CEO decision queue</h2>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">Impact · owner · deadline</p>
                </div>
                <span className="text-xs tabular-nums text-zinc-500">{decisions.length} open</span>
            </header>
            <div className="divide-y divide-zinc-800">
                {decisions.map((decision) => (
                    <button
                        key={decision.id}
                        type="button"
                        onClick={() => onOpenDecision(decision)}
                        className="group grid w-full grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-zinc-800/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
                    >
                        <span className={cn("text-[9px] font-semibold uppercase tracking-[0.14em]", severityStyles[decision.severity])}>
                            {decision.category}
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate text-xs font-medium text-zinc-200">{decision.title}</span>
                            <span className="mt-1 block truncate text-[10px] text-zinc-500">
                                {decision.impact} · {decision.owner}
                            </span>
                            <span className="sr-only">Recommendation: {decision.recommendation}. Evidence: {decision.evidence}</span>
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-medium text-zinc-400">
                            {decision.dueLabel}
                            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </span>
                    </button>
                ))}
            </div>
        </section>
    );
}
