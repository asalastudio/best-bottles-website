import { describe, expect, it } from "vitest";
import {
    clipPolygonAbove,
    clipPolylineAbove,
    drawingFigureRows,
    formatMm,
    splitLeftHalf,
    technicalDrawingFor,
    type Point,
} from "@/lib/products/pdp-redesign/tech-drawing";
import { finishPart, hasMechanism, overcapPart, type KitLike, type KitPartLike } from "@/lib/products/pdp-redesign/stage";

describe("technical drawing data", () => {
    const data = technicalDrawingFor("cylinder-9ml-13-415");

    it("has the Tall 9 mL section, and nothing for a body without one", () => {
        expect(data).not.toBeNull();
        expect(technicalDrawingFor("cylinder-9ml-17-415")).toBeNull();
        expect(technicalDrawingFor(null)).toBeNull();
    });

    it("keeps each half on its own side of the axis and tops out at the rim datum", () => {
        const { section, datums } = data!;
        expect(Math.min(...section.right.map(([x]) => x))).toBeGreaterThanOrEqual(0);
        expect(Math.max(...section.left.map(([x]) => x))).toBeLessThanOrEqual(0);
        const top = Math.max(...section.right.map(([, z]) => z));
        expect(top).toBeCloseTo(datums.rimZ, 2);
        expect(Math.max(...section.right.map(([x]) => x))).toBeCloseTo(datums.bodyR, 2);
    });

    it("lists the caliper figures, tenths unless the reading has hundredths", () => {
        const rows = drawingFigureRows(data!);
        expect(rows.find((row) => row.label === "Height")?.value).toBe("105.6 mm");
        expect(rows.find((row) => row.label === "Standing ring")?.value).toBe("Ø 18.05 mm");
        expect(rows.find((row) => row.label === "Finish height")?.value).toBe("11.0 mm");
        expect(formatMm(7)).toBe("7.0");
    });
});

describe("the 5 mL cylinder's drawing", () => {
    const data = technicalDrawingFor("cylinder-5ml-13-415");

    it("is one closed outline, drawn at 2:1, topping out at its own rim", () => {
        expect(data).not.toBeNull();
        const { section, datums } = data!;
        expect(data!.scale).toBe(2);
        expect(section.right[0]).toEqual([0, 0.12]);
        expect(section.right.at(-1)).toEqual([0, datums.floorZ]);
        expect(section.left[0]).toEqual([0, datums.floorZ]);
        expect(section.left.at(-1)).toEqual([0, 0.12]);
        expect(Math.max(...section.right.map(([, z]) => z))).toBeCloseTo(datums.rimZ, 2);
        expect(Math.max(...section.right.map(([x]) => x))).toBeCloseTo(datums.bodyR, 2);
    });

    it("shares the Tall's 13-415 neck, 52.37 mm lower", () => {
        const tall = technicalDrawingFor("cylinder-9ml-13-415")!.datums;
        const { datums } = data!;
        for (const key of ["boreR", "neckR", "threadR"] as const) expect(datums[key]).toBe(tall[key]);
        expect(tall.rimZ - datums.rimZ).toBeCloseTo(52.37, 2);
        expect(tall.threadCrestZ - datums.threadCrestZ).toBeCloseTo(52.37, 2);
    });

    it("lists its own caliper figures", () => {
        const rows = drawingFigureRows(data!);
        expect(rows.find((row) => row.label === "Height")?.value).toBe("53.12 mm");
        expect(rows.find((row) => row.label === "Body")?.value).toBe("Ø 17.69 mm");
        expect(rows.find((row) => row.label === "Foot")?.value).toBe("Ø 17.51 mm");
        expect(rows.find((row) => row.label === "Capacity")?.value).toBe("≈ 5.5 ml");
    });
});

describe("drawing geometry", () => {
    const square: Point[] = [[0, 0], [2, 0], [2, 2], [0, 2]];

    it("clips a polygon to the part at or above a height", () => {
        const kept = clipPolygonAbove(square, 1);
        expect(Math.min(...kept.map(([, z]) => z))).toBe(1);
        expect(kept).toContainEqual([2, 2]);
        expect(kept).not.toContainEqual([0, 0]);
    });

    it("splits a polyline into its runs above a height", () => {
        const runs = clipPolylineAbove([[0, 0], [0, 2], [1, 0], [1, 2]], 1);
        expect(runs).toHaveLength(2);
        expect(runs[0][0]).toEqual([0, 1]);
    });

    it("separates the outside from the cavity whichever way the half was traced", () => {
        // base axis → outside wall → rim → bore → floor axis
        const half: Point[] = [[0, 0], [-5, 0], [-5, 10], [-2, 10], [-2, 3], [0, 3]];
        const forward = splitLeftHalf(half, 10);
        const backward = splitLeftHalf([...half].reverse(), 10);
        expect(forward.outside[0]).toEqual([0, 0]);
        expect(forward.outside.at(-1)).toEqual([-2, 10]);
        expect(forward.inside.at(-1)).toEqual([0, 3]);
        expect(backward).toEqual(forward);
    });
});

describe("strip parts", () => {
    const part = (slot: string, views?: KitPartLike["views"]): KitPartLike => ({
        slot, zOrder: 1, explodeIndex: 1, views,
        bounds: { left: 0, top: 0, right: 10, bottom: 10 },
        assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: 0 },
        image: { url: `${slot}-${views?.join("-") ?? "all"}.png`, width: 10, height: 10 },
    });
    const kit = (parts: KitPartLike[]): KitLike => ({
        sku: "SKU", canvas: { width: 100, height: 100 },
        anchors: { axisX: 50, neckAxisX: null, seatY: 20, baselineY: 90 }, parts,
    });

    it("knows a sprayer kit and picks its seated overcap", () => {
        const sprayer = kit([part("body"), part("sprayer"), part("overcap", ["exploded"]), part("overcap", ["sidecar", "capon"])]);
        expect(hasMechanism(sprayer)).toBe(true);
        expect(overcapPart(sprayer)?.image.url).toBe("overcap-sidecar-capon.png");
        expect(hasMechanism(kit([part("body"), part("cap")]))).toBe(false);
        expect(overcapPart(kit([part("body"), part("cap")]))).toBeNull();
    });

    it("takes the finish chip from the overcap, else the cap, never the glass or an insert", () => {
        expect(finishPart(kit([part("body"), part("sprayer"), part("overcap", ["sidecar", "capon"])]))?.slot).toBe("overcap");
        expect(finishPart(kit([part("body"), part("roller"), part("cap")]))?.slot).toBe("cap");
        expect(finishPart(kit([part("body"), part("roller")]))).toBeNull();
        expect(finishPart(null)).toBeNull();
    });
});
