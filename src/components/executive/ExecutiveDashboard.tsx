"use client";

import { useMemo, useState } from "react";
import { Circle } from "@phosphor-icons/react";

import { ExecutiveDecisionQueue } from "@/components/executive/ExecutiveDecisionQueue";
import { ExecutiveDetailSheet, type ExecutiveDetailSelection } from "@/components/executive/ExecutiveDetailSheet";
import { ExecutiveHeadlineMetric, ExecutiveQuestionCard } from "@/components/executive/ExecutiveMetric";
import { ExecutiveNavigation } from "@/components/executive/ExecutiveNavigation";
import { ExecutiveOperatingPanels, ExecutiveUnavailablePanels } from "@/components/executive/ExecutiveOperatingPanels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ExecutiveDashboardSnapshot, ExecutiveDateRange } from "@/lib/executive/contracts";
import { getExecutiveMetric } from "@/lib/executive/fixture";
import { cn } from "@/lib/utils";

const ranges: Array<{ value: ExecutiveDateRange; label: string }> = [
    { value: "today", label: "Today" },
    { value: "7d", label: "7D" },
    { value: "mtd", label: "MTD" },
    { value: "qtd", label: "QTD" },
    { value: "ytd", label: "YTD" },
];

type ExecutiveDashboardProps = {
    snapshot: ExecutiveDashboardSnapshot;
    previewMode?: boolean;
};

export function ExecutiveDashboard({ snapshot, previewMode = false }: ExecutiveDashboardProps) {
    const [range, setRange] = useState<ExecutiveDateRange>(snapshot.range);
    const [selection, setSelection] = useState<ExecutiveDetailSelection>(null);

    const visibleSnapshot = useMemo<ExecutiveDashboardSnapshot>(() => {
        if (range === snapshot.range) return snapshot;
        return {
            ...snapshot,
            range,
            metrics: snapshot.metrics.map((metric) => ({
                ...metric,
                value: "—",
                comparison: "No connected data for this range",
                status: "not-connected",
                asOf: null,
                coverage: `${range.toUpperCase()} source coverage is not connected`,
                tone: "neutral",
            })),
        };
    }, [range, snapshot]);

    const generatedAt = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: snapshot.timezone,
    }).format(new Date(snapshot.generatedAt));

    return (
        <div
            data-dashboard-mode={snapshot.mode}
            className="min-h-screen bg-[#111216] text-zinc-100 selection:bg-[#d6a52e] selection:text-[#17120a]"
        >
            <header className="sticky top-0 z-40 flex min-h-[66px] items-center justify-between gap-4 border-b border-zinc-800 bg-[#111216]/95 px-4 backdrop-blur lg:pl-20">
                <div className="flex items-center gap-3">
                    <ExecutiveNavigation />
                    <p className="font-serif text-lg font-semibold tracking-wide text-zinc-100">BB / EXECUTIVE</p>
                </div>
                <div className="hidden items-center gap-5 text-[9px] uppercase tracking-[0.14em] text-zinc-400 sm:flex">
                    <span className="flex items-center gap-1.5">
                        <Circle className={cn("size-2", snapshot.mode === "live" ? "text-emerald-400" : "text-amber-300")} weight="fill" aria-hidden="true" />
                        {snapshot.sources.length} {snapshot.mode === "live" ? "source current" : "directional source"}
                    </span>
                    <span>{snapshot.mode} concept</span>
                    <span>{generatedAt}</span>
                    {previewMode ? <span>Local preview</span> : null}
                </div>
            </header>

            <main id="overview" className="mx-auto max-w-[1540px] space-y-2 px-3 py-4 lg:pl-[76px] lg:pr-4">
                <div className="flex flex-col gap-4 py-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="font-serif text-3xl leading-none tracking-tight text-zinc-50">Executive signal board</h1>
                        <p className="mt-2 max-w-2xl text-xs text-zinc-400">Profitability, future revenue, supply, delivery, and customer risk—in that order.</p>
                    </div>
                    <div className="flex w-fit border border-zinc-800" aria-label="Dashboard date range">
                        {ranges.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                aria-pressed={range === item.value}
                                onClick={() => setRange(item.value)}
                                className={cn(
                                    "min-h-9 border-r border-zinc-800 px-3 text-[9px] font-medium text-zinc-400 outline-none last:border-r-0 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400",
                                    range === item.value && "bg-zinc-100 text-zinc-950 hover:text-zinc-950",
                                )}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {snapshot.mode === "illustrative" ? (
                    <Alert className="rounded-none border-amber-300/30 bg-amber-300/10 px-4 py-3 text-amber-100">
                        <AlertTitle className="text-xs">Illustrative concept — not live business data</AlertTitle>
                        <AlertDescription className="text-[10px] text-amber-100/80">Values demonstrate the approved decision hierarchy while operational sources are connected and validated.</AlertDescription>
                    </Alert>
                ) : null}

                {range !== snapshot.range ? (
                    <Alert className="rounded-none border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-200">
                        <AlertTitle className="text-xs">{range.toUpperCase()} range is not connected</AlertTitle>
                        <AlertDescription className="text-[10px] text-zinc-400">No totals or trends are inferred. Select Today to return to the illustrative fixture.</AlertDescription>
                    </Alert>
                ) : null}

                <section aria-label="Three CEO questions" className="grid grid-cols-1 gap-2 lg:grid-cols-12">
                    {visibleSnapshot.questions.map((question, index) => (
                        <div key={question.id} className={cn(index === 0 ? "lg:col-span-5" : index === 1 ? "lg:col-span-4" : "lg:col-span-3")}>
                            <ExecutiveQuestionCard question={question} snapshot={visibleSnapshot} onOpenMetric={(metric) => setSelection({ kind: "metric", metric })} />
                        </div>
                    ))}
                </section>

                <section id="financial" aria-label="Headline business signals" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                    {visibleSnapshot.headlineMetricIds.map((id) => (
                        <ExecutiveHeadlineMetric key={id} metric={getExecutiveMetric(visibleSnapshot, id)} onOpenMetric={(metric) => setSelection({ kind: "metric", metric })} />
                    ))}
                </section>

                {range === snapshot.range ? (
                    <ExecutiveOperatingPanels
                        decisionQueue={(
                            <ExecutiveDecisionQueue
                                decisions={snapshot.decisions}
                                onOpenDecision={(decision) => setSelection({ kind: "decision", decision })}
                            />
                        )}
                    />
                ) : <ExecutiveUnavailablePanels range={range} />}
            </main>

            <ExecutiveDetailSheet selection={selection} snapshot={visibleSnapshot} onClose={() => setSelection(null)} />
        </div>
    );
}
