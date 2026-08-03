import { describe, expect, it } from "vitest";
import { summarizeKnowledgeTraces } from "../src/lib/knowledge/operations";

describe("knowledge operations", () => {
    it("summarizes cost, reliability, and latency without raw content", () => {
        const summary = summarizeKnowledgeTraces([
            { status: "success", estimatedCostUsd: 0.01, durationMs: 400, toolCalls: 2 },
            { status: "tool_error", estimatedCostUsd: 0.02, durationMs: 800, toolCalls: 1 },
        ], 3);
        expect(summary).toEqual({
            requestCount: 2,
            successRate: 0.5,
            estimatedCostUsd: 0.03,
            averageLatencyMs: 600,
            p95LatencyMs: 800,
            toolCalls: 3,
            pendingCorrections: 3,
        });
    });

    it("returns safe zeroes when no traces exist", () => {
        expect(summarizeKnowledgeTraces([], 0)).toEqual({
            requestCount: 0,
            successRate: 0,
            estimatedCostUsd: 0,
            averageLatencyMs: 0,
            p95LatencyMs: 0,
            toolCalls: 0,
            pendingCorrections: 0,
        });
    });
});
