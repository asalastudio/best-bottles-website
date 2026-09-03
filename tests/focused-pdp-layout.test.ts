import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import FocusedPdpLayout from "../src/components/products/FocusedPdpLayout";

vi.mock("convex/react", () => ({ useQuery: () => [] }));
vi.mock("@react-three/drei", () => ({ useGLTF: () => ({}) }));

const { default: ConfiguratorPdp } = await import("../src/components/products/ConfiguratorPdp");

describe("focused PDP layout", () => {
    const renderShell = () => renderToStaticMarkup(createElement(FocusedPdpLayout, {
        stage: createElement("div", null, "Bottle stage"),
        purchase: createElement("div", null, "Purchase panel"),
        mobileStickySummary: createElement("div", null, "Sticky summary"),
    }));

    it("exposes exactly two primary desktop columns at a 50/50 split", () => {
        const html = renderShell();

        expect(html).toContain("grid-template-columns:minmax(0, 1fr) minmax(320px, 1fr)");
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
        expect(html).toContain("max-height:min(72vh,720px)");
        expect(stage).toBeGreaterThan(-1);
        expect(stage).toBeLessThan(purchase);
    });

    it("uses a named container to stack before either panel clips and limits sticky summary to mobile", () => {
        const html = renderShell();

        expect(html).toContain("container-type:inline-size");
        expect(html).toContain("@container focused-pdp (min-width: 720px)");
        expect(html).toContain("pdp-mobile-sticky-summary");
        expect(html).toMatch(/@container focused-pdp \(min-width: 720px\)[\s\S]*\.pdp-mobile-sticky-summary\{display:none\}/);
    });

    it("shrinks only the stage when Grace insets the page and keeps two columns", () => {
        const html = renderShell();

        expect(html).toContain('[data-grace-layout="push"] .focused-pdp-grid{grid-template-columns:minmax(0, 0.72fr) minmax(280px, 1.28fr)');
        expect(html).toContain('[data-grace-layout="push"] .focused-pdp-stage-plate{max-height:min(52vh,520px)}');
        expect(html).not.toContain("focused-pdp-purchase{display:none");
    });

    it("renders the real focused purchase surface at 390px with contained closure controls", () => {
        const html = renderToStaticMarkup(createElement("div", { style: { width: 390 } },
            createElement(ConfiguratorPdp, {
                currentSlug: "cylinder-9ml-clear-17-415-rollon", groupTitle: "Cylinder 9 mL", capacityLabel: "Clear glass",
                displayName: "9 mL Clear Cylinder", priceEach: 0.72, inStock: true, checkoutReady: true,
                qty: 1, plateImage: "https://example.test/plate.png", neckSize: "17-415", capacityText: "9 mL",
                capOptions: ["Black", "Gold", "Silver", "White", "Pink", "Copper"], activeCapOption: "Black",
                glassOptions: [{ id: "clear", label: "Clear", href: "#", active: true }],
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
        expect(html.indexOf("1. Glass Finish")).toBeLessThan(html.indexOf("Add to cart"));
        expect(html).toContain('data-pdp-cta-cluster="above-fold"');
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
