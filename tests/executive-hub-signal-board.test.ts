import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExecutiveQuestionCard } from "../src/components/executive/ExecutiveMetric";
import { ExecutiveDecisionQueue } from "../src/components/executive/ExecutiveDecisionQueue";
import { ExecutiveOperatingPanels, ExecutiveUnavailablePanels } from "../src/components/executive/ExecutiveOperatingPanels";
import { ExecutiveDashboard } from "../src/components/executive/ExecutiveDashboard";
import { ExecutiveDetailContent } from "../src/components/executive/ExecutiveDetailSheet";
import { EXECUTIVE_HUB_FIXTURE } from "../src/lib/executive/fixture";

describe("Executive Signal Board components", () => {
    it("renders value, comparison, source status, and coverage for a CEO question", () => {
        const html = renderToStaticMarkup(createElement(ExecutiveQuestionCard, {
            question: EXECUTIVE_HUB_FIXTURE.questions[0],
            snapshot: EXECUTIVE_HUB_FIXTURE,
            onOpenMetric: () => undefined,
        }));

        expect(html).toContain("Are we growing profitably?");
        expect(html).toContain("$1.84M");
        expect(html).toContain("+8.4% vs plan");
        expect(html).toContain("Directional");
        expect(html).toContain("Illustrative design fixture");
    });

    it("renders impact, owner, deadline, recommendation, and evidence for decisions", () => {
        const html = renderToStaticMarkup(createElement(ExecutiveDecisionQueue, {
            decisions: EXECUTIVE_HUB_FIXTURE.decisions,
            onOpenDecision: () => undefined,
        }));

        expect(html).toContain("$92k stockout exposure");
        expect(html).toContain("CEO");
        expect(html).toContain("Today");
        expect(html).toContain("Approve expedited replenishment quantity.");
        expect(html).toContain("Cylinder stock cover falls below");
    });

    it("renders packaging operations ahead of supporting digital channels", () => {
        const html = renderToStaticMarkup(createElement(ExecutiveOperatingPanels));

        expect(html).toContain("Commercial funnel");
        expect(html).toContain("Inventory and supply health");
        expect(html).toContain("Customer account health");
        expect(html).toContain("Operations and production");
        expect(html).not.toContain("Website conversion");
    });

    it("renders the approved questions, honest data mode, ranges, and mobile navigation", () => {
        const html = renderToStaticMarkup(createElement(ExecutiveDashboard, {
            snapshot: EXECUTIVE_HUB_FIXTURE,
            previewMode: true,
        }));

        expect(html).toContain("Executive signal board");
        expect(html).toContain("Illustrative concept — not live business data");
        expect(html).toContain("Are we growing profitably?");
        expect(html).toContain("Is the pipeline healthy?");
        expect(html).toContain("What needs me today?");
        expect(html).toContain("Open Executive Hub navigation");
        expect(html).toContain("aria-pressed=\"true\"");
        expect(html).toContain("MTD");
        expect(html).toContain("YTD");
    });

    it("renders accessible metric and decision detail contracts", () => {
        const metricHtml = renderToStaticMarkup(createElement(ExecutiveDetailContent, {
            selection: { kind: "metric", metric: EXECUTIVE_HUB_FIXTURE.metrics[0] },
            snapshot: EXECUTIVE_HUB_FIXTURE,
        }));
        const decisionHtml = renderToStaticMarkup(createElement(ExecutiveDetailContent, {
            selection: { kind: "decision", decision: EXECUTIVE_HUB_FIXTURE.decisions[0] },
            snapshot: EXECUTIVE_HUB_FIXTURE,
        }));

        expect(metricHtml).toContain("Source");
        expect(metricHtml).toContain("Coverage");
        expect(metricHtml).toContain("Illustrative concept");
        expect(decisionHtml).toContain("Recommendation");
        expect(decisionHtml).toContain("Evidence");
        expect(decisionHtml).toContain("$92k stockout exposure");
    });

    it("never carries illustrative operating values into an unavailable range", () => {
        const html = renderToStaticMarkup(createElement(ExecutiveUnavailablePanels, { range: "mtd" }));

        expect(html).toContain("Commercial funnel");
        expect(html).toContain("CEO decision queue");
        expect(html).toContain("MTD data is not connected");
        expect(html).not.toContain("$428k");
        expect(html).not.toContain("Approve expedited Cylinder replenishment");
    });
});
