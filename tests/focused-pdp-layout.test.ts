import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FocusedPdpLayout from "../src/components/products/FocusedPdpLayout";

describe("focused PDP layout", () => {
    const renderShell = () => renderToStaticMarkup(createElement(FocusedPdpLayout, {
        stage: createElement("div", null, "Bottle stage"),
        purchase: createElement("div", null, "Purchase panel"),
        mobileStickySummary: createElement("div", null, "Sticky summary"),
    }));

    it("exposes exactly two primary desktop columns with a dominant stage", () => {
        const html = renderShell();

        expect(html).toContain("grid-template-columns:minmax(0, 1.6fr) minmax(360px, 0.95fr)");
        expect(html.match(/data-pdp-primary-panel=/g)).toHaveLength(2);
        expect(html).toContain('data-pdp-primary-panel="stage"');
        expect(html).toContain('data-pdp-primary-panel="purchase"');
    });

    it("owns the 10:11 stage plate and keeps stage before purchase in source order", () => {
        const html = renderShell();
        const stage = html.indexOf('data-pdp-primary-panel="stage"');
        const purchase = html.indexOf('data-pdp-primary-panel="purchase"');

        expect(html).toContain('data-pdp-stage-plate="10:11"');
        expect(html).toContain("aspect-ratio:10 / 11");
        expect(stage).toBeGreaterThan(-1);
        expect(stage).toBeLessThan(purchase);
    });

    it("uses a named container to stack before either panel clips and limits sticky summary to mobile", () => {
        const html = renderShell();

        expect(html).toContain("container-type:inline-size");
        expect(html).toContain("@container focused-pdp (min-width: 960px)");
        expect(html).toContain("pdp-mobile-sticky-summary");
        expect(html).toMatch(/@container focused-pdp \(min-width: 960px\)[\s\S]*\.pdp-mobile-sticky-summary\{display:none\}/);
    });
});
