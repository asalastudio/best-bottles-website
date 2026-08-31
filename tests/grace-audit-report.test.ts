/**
 * Contracts for the executive-hub Grace audit artifacts.
 *
 * The dashboard's colour coding is only trustworthy if verdict derivation and
 * the exported CSV/HTML agree with the underlying checks — these lock that.
 */
import { describe, expect, it } from "vitest";
import { verdictFor, GRACE_AUDIT_SCENARIOS, estimateAuditCostUsd } from "../src/lib/grace/auditScenarios";
import { buildAuditCsv, buildAuditHtml, type AuditResultRow, type AuditRunHeader } from "../src/lib/executive/auditReport";

const check = (passed: boolean, severity: "critical" | "soft" = "critical") => ({
    label: `check-${severity}-${passed}`, passed, severity, detail: "detail",
});

const run: AuditRunHeader = {
    kind: "conversation", status: "complete", startedAt: 1_780_000_000_000, finishedAt: 1_780_000_600_000,
    environment: "https://precise-raccoon-123.convex.cloud",
    scenarioTotal: 2, scenarioComplete: 2, passCount: 1, warnCount: 0, failCount: 1, scorePct: 50,
};

const results: AuditResultRow[] = [
    {
        scenarioId: "A1a", group: "Product knowledge", title: "Exact SKU recall",
        verdict: "pass", checks: [check(true)], toolCallCount: 1, durationMs: 1200, error: null,
        transcript: [{ user: "price?", assistant: "$0.42 each", toolCalls: [{ name: "getProductBySku", executed: "live" }] }],
    },
    {
        scenarioId: "D13", group: "Policy grounding", title: "Damage window",
        verdict: "fail", checks: [check(false)], toolCallCount: 0, durationMs: 900,
        error: null, transcript: [],
    },
];

describe("verdict derivation", () => {
    it("fails when any critical check fails", () => {
        expect(verdictFor([check(true), check(false)], null)).toBe("fail");
    });

    it("warns when only a soft check fails", () => {
        expect(verdictFor([check(true), check(false, "soft")], null)).toBe("warn");
    });

    it("passes when everything passes", () => {
        expect(verdictFor([check(true), check(true, "soft")], null)).toBe("pass");
    });

    it("fails on a runner error regardless of checks", () => {
        expect(verdictFor([check(true)], "OpenAI 500")).toBe("fail");
    });
});

describe("scenario catalogue", () => {
    it("has unique ids and at least one expectation each", () => {
        const ids = GRACE_AUDIT_SCENARIOS.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const s of GRACE_AUDIT_SCENARIOS) {
            expect(s.turns.length, `${s.id} needs turns`).toBeGreaterThan(0);
            expect(Object.keys(s.expect).length, `${s.id} needs expectations`).toBeGreaterThan(0);
        }
    });

    it("guards the two historical critical failures", () => {
        // Policy fabrication: the audit must reject the invented damage window.
        const policy = GRACE_AUDIT_SCENARIOS.find((s) => s.id === "D13");
        expect(policy?.expect.mustIncludeAll).toContain("7 days");
        expect(policy?.expect.mustNotInclude).toContain("2 business days");

        // SKU false-negatives: real SKUs must never be denied.
        const sku = GRACE_AUDIT_SCENARIOS.find((s) => s.id === "A1b");
        expect(sku?.expect.mustNotInclude?.some((p) => p.includes("don't carry"))).toBe(true);
    });

    it("surfaces a non-zero cost estimate so spend is never silent", () => {
        expect(estimateAuditCostUsd()).toBeGreaterThan(0);
    });
});

describe("CSV export", () => {
    const csv = buildAuditCsv(run, results);

    it("emits one row per check so the sheet is filterable line by line", () => {
        const dataRows = csv.split("\n").filter((l) => l.startsWith("A1a,") || l.startsWith("D13,"));
        expect(dataRows).toHaveLength(2);
    });

    it("includes verdicts and a run summary", () => {
        expect(csv).toContain("Verdict");
        expect(csv).toContain("pass");
        expect(csv).toContain("fail");
        expect(csv).toContain("# Run summary");
        expect(csv).toContain("50%");
    });

    it("escapes commas and quotes", () => {
        const tricky = buildAuditCsv(run, [{ ...results[0], title: 'Has, comma and "quote"' }]);
        expect(tricky).toContain('"Has, comma and ""quote"""');
    });
});

describe("HTML report", () => {
    const html = buildAuditHtml(run, results);

    it("is self-contained — no external CSS or JS", () => {
        expect(html).toContain("<style>");
        expect(html).not.toMatch(/<link[^>]+stylesheet/i);
        expect(html).not.toMatch(/<script[^>]+src=/i);
    });

    it("colour-codes every verdict", () => {
        expect(html).toContain("PASS");
        expect(html).toContain("FAIL");
        expect(html).toContain("#15803d"); // pass green
        expect(html).toContain("#b91c1c"); // fail red
    });

    it("escapes untrusted transcript text", () => {
        const nasty = buildAuditHtml(run, [{
            ...results[0],
            transcript: [{ user: "<img src=x onerror=alert(1)>", assistant: "ok", toolCalls: [] }],
        }]);
        expect(nasty).not.toContain("<img src=x");
        expect(nasty).toContain("&lt;img src=x");
    });
});
