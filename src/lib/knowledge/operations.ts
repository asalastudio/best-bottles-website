import type { KnowledgeTraceStatus } from "@/lib/knowledge/contracts";

export type KnowledgeOperationsTrace = {
    status: KnowledgeTraceStatus;
    estimatedCostUsd: number;
    durationMs: number;
    toolCalls: number | readonly unknown[];
};

export type KnowledgeOperationsSummary = {
    requestCount: number;
    successRate: number;
    estimatedCostUsd: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    toolCalls: number;
    pendingCorrections: number;
};

const rounded = (value: number, digits = 6): number => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

export function summarizeKnowledgeTraces(
    traces: readonly KnowledgeOperationsTrace[],
    pendingCorrections: number,
): KnowledgeOperationsSummary {
    if (traces.length === 0) {
        return {
            requestCount: 0,
            successRate: 0,
            estimatedCostUsd: 0,
            averageLatencyMs: 0,
            p95LatencyMs: 0,
            toolCalls: 0,
            pendingCorrections,
        };
    }

    const sortedLatencies = traces.map((trace) => trace.durationMs).sort((a, b) => a - b);
    const p95Index = Math.max(0, Math.ceil(sortedLatencies.length * 0.95) - 1);
    const successful = traces.filter((trace) => trace.status === "success").length;

    return {
        requestCount: traces.length,
        successRate: rounded(successful / traces.length, 4),
        estimatedCostUsd: rounded(traces.reduce((sum, trace) => sum + trace.estimatedCostUsd, 0)),
        averageLatencyMs: Math.round(traces.reduce((sum, trace) => sum + trace.durationMs, 0) / traces.length),
        p95LatencyMs: sortedLatencies[p95Index] ?? 0,
        toolCalls: traces.reduce((sum, trace) => (
            sum + (typeof trace.toolCalls === "number" ? trace.toolCalls : trace.toolCalls.length)
        ), 0),
        pendingCorrections,
    };
}
