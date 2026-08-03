import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExecutiveQuestionCard } from "../src/components/executive/ExecutiveMetric";
import { ExecutiveDecisionQueue } from "../src/components/executive/ExecutiveDecisionQueue";
import { ExecutiveOperatingPanels } from "../src/components/executive/ExecutiveOperatingPanels";
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
});
