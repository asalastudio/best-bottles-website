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

    it("renders a contained 390px stage and horizontally reachable 44px controls without changing the 10:11 ratio", () => {
        const html = renderToStaticMarkup(createElement("div", { style: { width: 390, overflow: "hidden" } },
            createElement(FocusedPdpLayout, {
                stage: createElement("div", { "data-testid": "mobile-stage" }, "Bottle stage"),
                purchase: createElement("div", { "data-testid": "mobile-purchase" },
                    createElement("div", { className: "flex max-w-full gap-2 overflow-x-auto", "data-testid": "mobile-option-rail" },
                        ...["Black", "Gold", "Silver", "White", "Pink", "Copper"].map((label) =>
                            createElement("button", { key: label, type: "button", className: "min-h-11 min-w-11 shrink-0" }, label),
                        ),
                    ),
                ),
            }),
        ));

        expect(html).toContain("width:390px");
        expect(html).toContain('data-pdp-stage-plate="10:11"');
        expect(html).toContain("aspect-ratio:10 / 11");
        expect(html).toContain('data-testid="mobile-option-rail"');
        expect(html).toContain("max-w-full");
        expect(html).toContain("overflow-x-auto");
        expect((html.match(/min-h-11 min-w-11 shrink-0/g) ?? [])).toHaveLength(6);
    });

    it("renders mobile purchase controls after the stage instead of inside its bounded slot", () => {
        const html = renderToStaticMarkup(createElement(FocusedPdpLayout, {
            stage: createElement("div", { "data-testid": "bounded-stage" }, "Bottle stage"),
            purchase: createElement("div", { "data-testid": "purchase-controls" }, "Choose option"),
        }));

        expect(html.indexOf('data-testid="bounded-stage"')).toBeLessThan(html.indexOf('data-testid="purchase-controls"'));
        expect(html).toContain("Choose option");
    });

});
