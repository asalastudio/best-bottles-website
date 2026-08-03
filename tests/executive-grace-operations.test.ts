import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GraceOperationsPanel } from "../src/components/executive/GraceOperationsPanel";

describe("Executive Grace Operations", () => {
    it("renders cost, reliability, latency, and corrections without conversation text", () => {
        const html = renderToStaticMarkup(createElement(GraceOperationsPanel, {
            snapshot: {
                status: "source-backed",
                asOf: "2026-08-03T08:00:00.000Z",
                requestCount: 120,
                successRate: 0.975,
                estimatedCostUsd: 14.82,
                averageLatencyMs: 720,
                p95LatencyMs: 1400,
                toolCalls: 188,
                pendingCorrections: 3,
                message: null,
            },
        }));
        expect(html).toContain("Grace Operations");
        expect(html).toContain("$14.82");
        expect(html).toContain("97.5%");
        expect(html).toContain("3 pending corrections");
        expect(html).not.toContain("conversation transcript");
    });
});
