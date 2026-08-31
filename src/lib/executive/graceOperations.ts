import "server-only";

import { loadKnowledgeOperationsSummary } from "@/lib/knowledge/operationsServer";

export type GraceOperationsSnapshot = {
    coverage: "employee_responses_only";
    status: "source-backed" | "not-connected";
    asOf: string | null;
    requestCount: number | null;
    successRate: number | null;
    estimatedCostUsd: number | null;
    averageLatencyMs: number | null;
    p95LatencyMs: number | null;
    toolCalls: number | null;
    pendingCorrections: number | null;
    message: string | null;
};

const notConnected = (): GraceOperationsSnapshot => ({
    coverage: "employee_responses_only",
    status: "not-connected",
    asOf: null,
    requestCount: null,
    successRate: null,
    estimatedCostUsd: null,
    averageLatencyMs: null,
    p95LatencyMs: null,
    toolCalls: null,
    pendingCorrections: null,
    message: "Grace Operations data is not connected.",
});

export async function getGraceOperationsSnapshot(now = Date.now()): Promise<GraceOperationsSnapshot> {
    try {
        const trailingThirtyDays = now - 30 * 24 * 60 * 60 * 1000;
        const summary = await loadKnowledgeOperationsSummary(trailingThirtyDays);
        return {
            coverage: "employee_responses_only",
            status: "source-backed",
            asOf: new Date(now).toISOString(),
            ...summary,
            message: null,
        };
    } catch (error) {
        console.error("[executive/grace-operations] aggregate unavailable", {
            error: error instanceof Error ? error.name : "unknown",
        });
        return notConnected();
    }
}
