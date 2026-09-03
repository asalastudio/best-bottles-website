import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import FocusedPdpLayout from "../src/components/products/FocusedPdpLayout";

vi.mock("convex/react", () => ({ useQuery: () => [] }));
vi.mock("@react-three/drei", () => ({ useGLTF: () => ({}) }));

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

    it("renders the real focused purchase surface at 390px with contained closure controls", async () => {
        const { default: ConfiguratorPdp } = await import("../src/components/products/ConfiguratorPdp");
        const html = renderToStaticMarkup(createElement("div", { style: { width: 390, overflow: "hidden" } },
            createElement(ConfiguratorPdp, {
                currentSlug: "cylinder-9ml-clear-17-415-rollon", groupTitle: "Cylinder 9 mL", capacityLabel: "Clear glass",
                displayName: "9 mL Clear Cylinder", priceEach: 0.72, inStock: true, checkoutReady: true,
                qty: 1, plateImage: "https://example.test/plate.png", neckSize: "17-415", capacityText: "9 mL",
                capOptions: ["Black", "Gold", "Silver", "White", "Pink", "Copper"], activeCapOption: "Black",
            }),
        ));

        expect(html).toContain("width:390px");
        expect(html).toContain('data-pdp-stage-plate="10:11"');
        expect(html).toContain("aspect-ratio:10 / 11");
        expect(html).toContain('data-testid="pdp-closure-rail"');
        expect(html).toContain("max-w-full");
        expect(html).toContain("overflow-x-auto");
        expect((html.match(/min-h-11 min-w-11/g) ?? []).length).toBeGreaterThanOrEqual(6);
        expect(html).toContain("9 mL Clear Cylinder");
        expect(html).toContain("$0.72");
        expect(html).toContain('aria-label="Quantity"');
        expect(html).toContain("Add to cart");
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
