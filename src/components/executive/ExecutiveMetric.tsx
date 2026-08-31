"use client";

import { ArrowUpRight } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    metricStatusLabel,
    type ExecutiveDashboardSnapshot,
    type ExecutiveMetric,
    type ExecutiveQuestionPanel,
} from "@/lib/executive/contracts";
import { getExecutiveMetric } from "@/lib/executive/fixture";

const toneStyles: Record<ExecutiveMetric["tone"], string> = {
    positive: "border-t-emerald-400 text-emerald-300",
    neutral: "border-t-zinc-400 text-zinc-300",
    watch: "border-t-amber-400 text-amber-300",
    risk: "border-t-rose-400 text-rose-300",
};

type ExecutiveQuestionCardProps = {
    question: ExecutiveQuestionPanel;
    snapshot: ExecutiveDashboardSnapshot;
    onOpenMetric: (metric: ExecutiveMetric) => void;
};

export function ExecutiveQuestionCard({
    question,
    snapshot,
    onOpenMetric,
}: ExecutiveQuestionCardProps) {
    const metrics = question.metricIds.map((id) => getExecutiveMetric(snapshot, id));
    const primaryMetric = metrics[0];

    return (
        <Card
            className={cn(
                "min-w-0 rounded-none border-zinc-700/80 border-t-2 bg-zinc-900/90 text-zinc-100 shadow-none",
                toneStyles[primaryMetric.tone],
            )}
        >
            <CardHeader className="space-y-2 p-4 pb-2 sm:p-5 sm:pb-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                    {question.eyebrow}
                </p>
                <h2 className="font-serif text-lg leading-tight text-zinc-100">
                    {question.question}
                </h2>
            </CardHeader>
            <CardContent className="p-4 pt-1 sm:p-5 sm:pt-1">
                <button
                    type="button"
                    onClick={() => onOpenMetric(primaryMetric)}
                    className="group flex w-full items-end justify-between gap-4 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    aria-label={`Open ${primaryMetric.label} details`}
                >
                    <span>
                        <span className="block text-3xl font-medium tabular-nums tracking-tight text-zinc-50 sm:text-4xl">
                            {primaryMetric.value}
                        </span>
                        <span className={cn("mt-1 block text-xs", toneStyles[primaryMetric.tone])}>
                            {primaryMetric.comparison}
                        </span>
                    </span>
                    <ArrowUpRight className="mb-1 size-4 text-zinc-600 transition-colors group-hover:text-zinc-200" aria-hidden="true" />
                </button>

                {metrics.length > 1 ? (
                    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-zinc-800 pt-4 sm:grid-cols-3">
                        {metrics.slice(1).map((metric) => (
                            <button
                                type="button"
                                key={metric.id}
                                onClick={() => onOpenMetric(metric)}
                                className="min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                            >
                                <dt className="truncate text-[10px] uppercase tracking-wider text-zinc-400">{metric.label}</dt>
                                <dd className="mt-1 text-sm font-medium tabular-nums text-zinc-200">{metric.value}</dd>
                            </button>
                        ))}
                    </dl>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3 text-[10px] text-zinc-400">
                    <Badge variant="outline" className="rounded-sm border-zinc-700 px-1.5 py-0 font-medium text-zinc-400">
                        {metricStatusLabel(primaryMetric.status)}
                    </Badge>
                    <span className="text-zinc-400">{primaryMetric.coverage}</span>
                </div>
            </CardContent>
        </Card>
    );
}

type ExecutiveHeadlineMetricProps = {
    metric: ExecutiveMetric;
    onOpenMetric: (metric: ExecutiveMetric) => void;
};

export function ExecutiveHeadlineMetric({ metric, onOpenMetric }: ExecutiveHeadlineMetricProps) {
    return (
        <button
            type="button"
            onClick={() => onOpenMetric(metric)}
            className="group min-w-0 border border-zinc-800 bg-zinc-900/75 p-4 text-left outline-none transition-colors hover:border-zinc-600 focus-visible:ring-2 focus-visible:ring-amber-400"
        >
            <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                {metric.label}
            </span>
            <span className="mt-2 block text-xl font-medium tabular-nums text-zinc-100">{metric.value}</span>
            <span className="mt-1 block truncate text-[10px] text-zinc-400">{metric.comparison}</span>
        </button>
    );
}
