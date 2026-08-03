import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Executive Hub route wiring", () => {
    const pageSource = readFileSync(resolve(process.cwd(), "src/app/executive/page.tsx"), "utf8");
    const dashboardSource = readFileSync(resolve(process.cwd(), "src/components/executive/ExecutiveDashboard.tsx"), "utf8");

    it("routes the authenticated executive view to the source-aware Signal Board", () => {
        expect(pageSource).toContain("<ExecutiveDashboard");
        expect(pageSource).toContain("EXECUTIVE_HUB_FIXTURE");
        expect(dashboardSource).toContain("Executive signal board");
        expect(dashboardSource).toContain("Illustrative concept — not live business data");
    });

    it("keeps the approved B2B hierarchy in reusable dashboard components", () => {
        expect(dashboardSource).toContain("ExecutiveOperatingPanels");
        expect(dashboardSource).toContain("ExecutiveDecisionQueue");
        expect(dashboardSource).toContain("headlineMetricIds");
    });
});
