import { describe, expect, it } from "vitest";
import {
    metricStatusLabel,
    validateExecutiveDashboardSnapshot,
    type ExecutiveDashboardSnapshot,
} from "../src/lib/executive/contracts";

const validSnapshot: ExecutiveDashboardSnapshot = {
    mode: "illustrative",
    generatedAt: "2026-08-02T15:42:00.000Z",
    timezone: "America/Los_Angeles",
    range: "today",
    sources: [{
        id: "fixture",
        label: "Illustrative fixture",
        status: "directional",
        asOf: "2026-08-02T15:42:00.000Z",
        coverage: "Design preview only",
    }],
    questions: [
        { id: "performance", eyebrow: "01 · Performance", question: "Are we growing profitably?", metricIds: ["revenue"] },
        { id: "future-revenue", eyebrow: "02 · Future revenue", question: "Is the pipeline healthy?", metricIds: ["pipeline"] },
        { id: "attention", eyebrow: "03 · CEO attention", question: "What needs me today?", metricIds: ["decisions"] },
    ],
    metrics: [
        { id: "revenue", label: "Net revenue MTD", value: "$1.84M", comparison: "+8.4% vs plan", sourceId: "fixture", status: "directional", asOf: "2026-08-02T15:42:00.000Z", coverage: "Illustrative", tone: "positive", href: "#financial" },
        { id: "pipeline", label: "Qualified pipeline", value: "$3.21M", comparison: "2.4× coverage", sourceId: "fixture", status: "directional", asOf: "2026-08-02T15:42:00.000Z", coverage: "Illustrative", tone: "watch", href: "#sales" },
        { id: "decisions", label: "Open CEO decisions", value: "3", comparison: "$218k exposure", sourceId: "fixture", status: "directional", asOf: "2026-08-02T15:42:00.000Z", coverage: "Illustrative", tone: "risk", href: "#decisions" },
    ],
    headlineMetricIds: ["revenue", "pipeline", "decisions"],
    decisions: [],
    panels: [],
};

describe("Executive Hub contract", () => {
    it("rejects a reordered CEO question hierarchy", () => {
        const invalid = {
            ...validSnapshot,
            questions: [validSnapshot.questions[1], validSnapshot.questions[0], validSnapshot.questions[2]],
        } as ExecutiveDashboardSnapshot;

        expect(validateExecutiveDashboardSnapshot(invalid)).toContain(
            "Executive questions must be performance, future-revenue, and attention in that order.",
        );
    });

    it("rejects more than six headline metrics", () => {
        const invalid = { ...validSnapshot, headlineMetricIds: ["1", "2", "3", "4", "5", "6", "7"] };
        expect(validateExecutiveDashboardSnapshot(invalid)).toContain("Headline metric strip cannot exceed 6 metrics.");
    });

    it("rejects metrics without provenance", () => {
        const invalid = { ...validSnapshot, metrics: [{ ...validSnapshot.metrics[0], sourceId: "" }] };
        expect(validateExecutiveDashboardSnapshot(invalid)).toContain("Metric revenue is missing sourceId.");
    });

    it("rejects metrics whose source is not registered", () => {
        const invalid = { ...validSnapshot, metrics: [{ ...validSnapshot.metrics[0], sourceId: "unknown" }] };
        expect(validateExecutiveDashboardSnapshot(invalid)).toContain("Metric revenue references unknown source unknown.");
    });

    it("uses honest source-state labels", () => {
        expect(metricStatusLabel("source-backed")).toBe("Source-backed");
        expect(metricStatusLabel("not-connected")).toBe("Not connected");
    });
});
