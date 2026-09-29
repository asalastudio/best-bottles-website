import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PdpLabelPlacement, { PdpLabelTemplate } from "@/components/pdp/PdpLabelPlacement";
import { drawingBodyId } from "@/lib/products/pdp-redesign/drawings";
import {
    LABEL_FIT_DISCLAIMER,
    LABEL_FIT_SOURCE_TEXT,
    allLabelFits,
    circumferenceMm,
    discCentreMm,
    frontZoneMm,
    inches,
    labelFitFor,
    labelFitRows,
    stockText,
} from "@/lib/products/pdp-redesign/label-fit";

const fits = allLabelFits();

describe("label fit data", () => {
    it("finds a bottle by the tech sheet's body id, and nothing for a custom shape", () => {
        expect(labelFitFor(drawingBodyId("cylinder-9ml-clear-17-415-rollon"))?.label).toMatchObject({ widthMm: 60, heightMm: 49 });
        expect(labelFitFor(drawingBodyId("empire-100ml-clear-18-415-antiquespray"))?.shape).toBe("face");
        expect(labelFitFor(drawingBodyId("diva-46ml-clear-18-415-perfumespray"))).toBeNull();
        expect(labelFitFor(null)).toBeNull();
    });

    it("keys every bottle once, in the tech drawing's <family>-<ml>ml-<neck> form", () => {
        const ids = fits.map((fit) => fit.body);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(id).toMatch(/^[a-z]+(?:-[a-z]+)*-\d+(?:\.\d+)?ml-(?:\d+-\d+|\d+mm)$/);
    });

    it("keeps the print area drawings' own numbers", () => {
        const official: Record<string, [number, number]> = {
            "cylinder-5ml-13-415": [54, 35],
            "cylinder-9ml-17-415": [60, 49],
            "tulip-6ml-13-415": [30, 24],
            "empire-50ml-18-415": [29.9, 59],
            "empire-100ml-18-415": [35.4, 80.1],
            "sleek-30ml-18-415": [20, 71.5],
            "sleek-50ml-18-415": [20, 113],
            "slim-100ml-18-415": [24, 120],
        };
        for (const [body, [w, h]] of Object.entries(official)) {
            const fit = labelFitFor(body)!;
            expect(fit.source).toBe("print-area");
            expect([fit.label.widthMm, fit.label.heightMm]).toEqual([w, h]);
        }
        expect(fits.filter((fit) => fit.source === "print-area")).toHaveLength(Object.keys(official).length);
    });

    it("leaves a seam gap on every wrap and keeps it on the straight wall", () => {
        for (const fit of fits.filter((entry) => entry.shape === "wrap" && entry.label.panels === 1)) {
            const gap = Math.PI * fit.glass.widthMm - fit.label.widthMm;
            expect(gap, fit.body).toBeGreaterThanOrEqual(2.5);
            expect(gap, fit.body).toBeLessThan(4);
        }
    });

    it("keeps every label between the heel and the shoulder", () => {
        for (const fit of fits.filter((entry) => entry.shape !== "disc")) {
            expect(fit.label.fromBaseMm, fit.body).toBeGreaterThanOrEqual(fit.glass.heelMm);
            expect(fit.label.fromBaseMm + fit.label.heightMm, fit.body).toBeLessThanOrEqual(fit.glass.shoulderMm);
            expect(fit.glass.shoulderMm, fit.body).toBeLessThanOrEqual(fit.glass.neckBaseMm);
            expect(fit.glass.neckBaseMm, fit.body).toBeLessThan(fit.glass.heightMm);
        }
    });

    it("fits a flat label inside its face and a disc label inside its face", () => {
        for (const fit of fits.filter((entry) => entry.shape === "face")) expect(fit.label.widthMm, fit.body).toBeLessThan(fit.glass.widthMm);
        for (const fit of fits.filter((entry) => entry.shape === "disc")) {
            expect(fit.label.widthMm, fit.body).toBeLessThanOrEqual(fit.glass.widthMm - 2 * (2 + 3.2) + 0.5);
            expect(discCentreMm(fit) - fit.label.widthMm / 2, fit.body).toBeGreaterThan(0);
        }
    });

    it("only suggests standard sizes that fit inside the label area", () => {
        const tolerance = 0.7;
        for (const fit of fits) {
            for (const [kind, stock] of Object.entries(fit.stock)) {
                const w = stock.widthIn * 25.4;
                const h = stock.heightIn * 25.4;
                expect(w, `${fit.body} ${kind}`).toBeLessThanOrEqual(fit.label.widthMm + tolerance);
                if (fit.shape !== "disc") expect(h, `${fit.body} ${kind}`).toBeLessThanOrEqual(fit.label.heightMm + tolerance);
                if (kind === "wrap") expect(w, `${fit.body} wrap`).toBeGreaterThanOrEqual(0.75 * Math.PI * fit.glass.widthMm);
                if (kind === "front" && fit.shape === "wrap" && fit.label.panels === 1) expect(w, `${fit.body} front`).toBeLessThanOrEqual(frontZoneMm(fit)! + tolerance);
            }
        }
    });
});

describe("label fit copy", () => {
    it("formats inch sizes the way a label catalogue lists them", () => {
        expect(inches(2.125)).toBe("2⅛");
        expect(inches(1.6875)).toBe("1 11/16");
        expect(inches(0.5)).toBe("½");
        expect(inches(3)).toBe("3");
        expect(stockText({ widthIn: 2.125, heightIn: 1.6875 })).toBe("2⅛ × 1 11/16 in (54 × 42.9 mm)");
        expect(stockText({ widthIn: 2, heightIn: 2, round: true })).toBe("2 in round (Ø 50.8 mm)");
    });

    it("lists the wrap's front and circumference for the roll-on", () => {
        const fit = labelFitFor("cylinder-9ml-17-415")!;
        expect(frontZoneMm(fit)).toBe(25.1);
        expect(circumferenceMm(fit)).toBe(62.8);
        const rows = labelFitRows(fit);
        expect(rows.map((row) => row.k)).toEqual(["Label area", "Where", "Faces the customer", "Standard sizes that fit", "Label stock", "Source"]);
        expect(rows.find((row) => row.k === "Source")?.v).toBe("Best Bottles print area drawing");
    });

    it("credits Best Bottles, never the parent company, in anything a customer reads", () => {
        const text = [
            LABEL_FIT_DISCLAIMER,
            ...Object.values(LABEL_FIT_SOURCE_TEXT),
            ...fits.flatMap((fit) => [...labelFitRows(fit).map((row) => row.v), fit.note ?? ""]),
        ].join(" ");
        expect(text).not.toMatch(/nemat/i);
        expect(LABEL_FIT_DISCLAIMER).toMatch(/printer/);
        expect(LABEL_FIT_DISCLAIMER).toMatch(/sample/);
    });
});

describe("label placement drawing", () => {
    it("draws every bottle without a missing number", () => {
        for (const fit of fits) {
            const svg = renderToStaticMarkup(createElement(PdpLabelPlacement, { fit, idPrefix: "t" }));
            expect(svg, fit.body).toContain('data-testid="pdp-label-placement"');
            expect(svg, fit.body).not.toMatch(/NaN|undefined|Infinity/);
            const template = renderToStaticMarkup(createElement(PdpLabelTemplate, { fit }));
            expect(template, fit.body).not.toMatch(/NaN|undefined|Infinity/);
        }
    });

    it("prints the template at true size", () => {
        const fit = labelFitFor("cylinder-9ml-17-415")!;
        const template = renderToStaticMarkup(createElement(PdpLabelTemplate, { fit }));
        expect(template).toContain('width="76mm"');
        expect(template).toContain('height="65mm"');
    });
});
