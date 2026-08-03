"use client";

import { ArrowSquareOut } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    metricStatusLabel,
    type ExecutiveDashboardSnapshot,
    type ExecutiveDecision,
    type ExecutiveMetric,
} from "@/lib/executive/contracts";

export type ExecutiveDetailSelection =
    | { kind: "metric"; metric: ExecutiveMetric }
    | { kind: "decision"; decision: ExecutiveDecision }
    | null;

function formatAsOf(value: string | null) {
    if (!value) return "No timestamp available";
    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Los_Angeles",
    }).format(new Date(value));
}

type ExecutiveDetailContentProps = {
    selection: Exclude<ExecutiveDetailSelection, null>;
    snapshot: ExecutiveDashboardSnapshot;
};

export function ExecutiveDetailContent({ selection, snapshot }: ExecutiveDetailContentProps) {
    const sourceId = selection.kind === "metric" ? selection.metric.sourceId : selection.decision.sourceId;
    const source = snapshot.sources.find((candidate) => candidate.id === sourceId);

    if (selection.kind === "metric") {
        const { metric } = selection;
        return (
            <div className="space-y-7">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Metric detail</p>
                    <p className="mt-3 text-4xl font-medium tabular-nums text-zinc-50">{metric.value}</p>
                    <p className="mt-1 text-sm text-zinc-400">{metric.comparison}</p>
                </div>
                <dl className="divide-y divide-zinc-800 border-y border-zinc-800 text-sm">
                    <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">Status</dt><dd><Badge variant="outline" className="rounded-none border-zinc-700 text-zinc-300">{metricStatusLabel(metric.status)}</Badge></dd></div>
                    <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">Source</dt><dd className="text-right text-zinc-200">{source?.label ?? sourceId}</dd></div>
                    <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">As of</dt><dd className="text-right text-zinc-200">{formatAsOf(metric.asOf)}</dd></div>
                    <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-500">Coverage</dt><dd className="max-w-[14rem] text-right text-zinc-200">{metric.coverage}</dd></div>
                </dl>
                <Button asChild className="w-full rounded-none bg-amber-300 text-zinc-950 hover:bg-amber-200">
                    <a href={metric.href}>Open supporting lane <ArrowSquareOut className="ml-2 size-4" aria-hidden="true" /></a>
                </Button>
            </div>
        );
    }

    const { decision } = selection;
    return (
        <div className="space-y-7">
            <div className="grid grid-cols-2 gap-3">
                <div className="border border-zinc-800 p-3"><p className="text-[9px] uppercase tracking-wider text-zinc-600">Impact</p><p className="mt-2 text-sm text-zinc-100">{decision.impact}</p></div>
                <div className="border border-zinc-800 p-3"><p className="text-[9px] uppercase tracking-wider text-zinc-600">Due</p><p className="mt-2 text-sm text-zinc-100">{decision.dueLabel}</p></div>
            </div>
            <dl className="space-y-5">
                <div><dt className="text-[10px] uppercase tracking-wider text-zinc-500">Owner</dt><dd className="mt-1 text-sm text-zinc-200">{decision.owner}</dd></div>
                <div><dt className="text-[10px] uppercase tracking-wider text-zinc-500">Recommendation</dt><dd className="mt-1 text-sm leading-6 text-zinc-200">{decision.recommendation}</dd></div>
                <div><dt className="text-[10px] uppercase tracking-wider text-zinc-500">Evidence</dt><dd className="mt-1 text-sm leading-6 text-zinc-200">{decision.evidence}</dd></div>
                <div><dt className="text-[10px] uppercase tracking-wider text-zinc-500">Source</dt><dd className="mt-1 text-sm text-zinc-200">{source?.label ?? sourceId}</dd></div>
            </dl>
        </div>
    );
}

type ExecutiveDetailSheetProps = {
    selection: ExecutiveDetailSelection;
    snapshot: ExecutiveDashboardSnapshot;
    onClose: () => void;
};

export function ExecutiveDetailSheet({ selection, snapshot, onClose }: ExecutiveDetailSheetProps) {
    return (
        <Sheet open={selection !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
            <SheetContent className="w-full border-zinc-800 bg-[#121318] text-zinc-100 sm:max-w-md">
                {selection ? (
                    <>
                        <SheetHeader className="border-b border-zinc-800 pb-5 pr-8">
                            <SheetTitle className="font-serif text-2xl leading-tight text-zinc-100">
                                {selection.kind === "metric" ? selection.metric.label : selection.decision.title}
                            </SheetTitle>
                            <SheetDescription className="text-zinc-500">
                                {selection.kind === "metric" ? "Value, comparison, and source coverage." : "Decision impact, recommendation, and supporting evidence."}
                            </SheetDescription>
                        </SheetHeader>
                        <div className="mt-7"><ExecutiveDetailContent selection={selection} snapshot={snapshot} /></div>
                    </>
                ) : null}
            </SheetContent>
        </Sheet>
    );
}
