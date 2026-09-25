import { describe, expect, it } from "vitest";
import { drawingBodyId, drawingClosure, drawingFor, drawingStyleFromQuery, millimetres } from "@/lib/products/pdp-redesign/drawings";

const rollOn = { applicator: "Metal Roller Ball", heightWithCap: "83 ±1 mm", heightWithoutCap: "70 ±1 mm", diameter: "20 ±0.5 mm", neckThreadSize: "17-415" };

describe("dimension drawings", () => {
    it("maps a group slug to the register body and the closure type", () => {
        expect(drawingBodyId("cylinder-9ml-clear-17-415-rollon")).toBe("cylinder-9ml-17-415");
        expect(drawingBodyId("cylinder-9ml-cobalt-blue-17-415-finemist")).toBe("cylinder-9ml-17-415");
        expect(drawingBodyId("components-caps")).toBeNull();
        expect(drawingClosure("cylinder-9ml-clear-17-415-rollon", null)).toBe("rollon");
        expect(drawingClosure("cylinder-9ml-clear-17-415", "Fine Mist Sprayer")).toBe("finemist");
        expect(drawingClosure("cylinder-9ml-clear-17-415", "Lotion Pump")).toBe("lotionpump");
        expect(drawingClosure("cylinder-9ml-clear-17-415", null)).toBeNull();
    });

    it("reads figures as numbers and drops what the SKU lacks", () => {
        expect(millimetres("83 ±1 mm")).toBe(83);
        expect(millimetres("20 ±0.5 mm")).toBe(20);
        expect(millimetres("")).toBeNull();
        expect(millimetres(null)).toBeNull();
        expect(millimetres("n/a")).toBeNull();
        const spec = drawingFor("cylinder-9ml-clear-17-415-rollon", { ...rollOn, diameter: null })!;
        expect(spec.figures).toEqual({ heightWithCapMm: 83, heightWithoutCapMm: 70, diameterMm: null, neck: "17-415" });
    });

    it("finds the 9 mL Cylinder's traced art per closure and style, ink by default", () => {
        const ink = drawingFor("cylinder-9ml-clear-17-415-rollon", rollOn)!;
        expect(ink.style).toBe("ink");
        expect(ink.closure).toBe("rollon");
        expect(ink.art.src).toBe("/assets/drawings/cylinder-9ml-17-415/rollon-ink.webp");
        expect(ink.art.closureTopY).toBeLessThan(ink.art.seatY);
        expect(ink.art.seatY).toBeLessThan(ink.art.footY);
        expect(ink.art.glassLeft).toBeLessThan(ink.art.axisX);
        expect(ink.art.axisX).toBeLessThan(ink.art.glassRight);
        const pencil = drawingFor("cylinder-9ml-amber-17-415-finemist", { ...rollOn, applicator: "Fine Mist Sprayer" }, "pencil")!;
        expect(pencil.style).toBe("pencil");
        expect(pencil.art.src).toBe("/assets/drawings/cylinder-9ml-17-415/finemist-pencil.webp");
        expect(drawingStyleFromQuery("pencil")).toBe("pencil");
        expect(drawingStyleFromQuery("anything")).toBe("ink");
    });

    it("keeps the placeholder for a body or closure with no art", () => {
        expect(drawingFor("cylinder-9ml-clear-17-415-lotionpump", { ...rollOn, applicator: "Lotion Pump" })).toBeNull();
        expect(drawingFor("empire-50ml-clear-18-415-finemist", rollOn)).toBeNull();
        expect(drawingFor("cylinder-9ml-clear-17-415-rollon", null)).not.toBeNull();
    });
});
