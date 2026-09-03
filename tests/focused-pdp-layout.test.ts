import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import FocusedPdpLayout from "../src/components/products/FocusedPdpLayout";

const configuratorSource = readFileSync(
    resolve(process.cwd(), "src/components/products/ConfiguratorPdp.tsx"),
    "utf8",
);
const productDetailSource = readFileSync(
    resolve(process.cwd(), "src/app/products/[slug]/ProductDetailClient.tsx"),
    "utf8",
);

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

    it("contains the six-tile configurator closure row at 390px without shrinking touch targets", () => {
        expect(configuratorSource).toContain('data-testid="pdp-closure-rail"');
        expect(configuratorSource).toMatch(/data-testid="pdp-closure-rail"[\s\S]{0,240}max-w-full[\s\S]{0,240}overflow-x-auto/);
        expect(configuratorSource).toMatch(/title=\{benefit\}[\s\S]{0,160}min-h-11/);
    });

    it("keeps classic mobile option trays outside the 10:11 stage slot", () => {
        const classicShell = productDetailSource.slice(
            productDetailSource.indexOf("<FocusedPdpLayout", productDetailSource.indexOf("!is3dFamily")),
            productDetailSource.indexOf("{/* ── Sanity Editorial Zone"),
        );
        const purchaseStart = classicShell.indexOf("purchase={");

        expect(purchaseStart).toBeGreaterThan(-1);
        expect(classicShell.indexOf("Choose Option")).toBeGreaterThan(purchaseStart);
        expect(classicShell.indexOf("Choose Shell")).toBeGreaterThan(purchaseStart);
    });

    it("removes kit entrance choreography and disables remaining transforms for reduced motion", () => {
        expect(configuratorSource).not.toContain("motion-safe:animate-[kitIn_180ms_ease-out]");
        expect(configuratorSource).toMatch(/transition-transform[\s\S]{0,120}motion-reduce:transition-none/);
    });
});
