/**
 * Technical drawings for the tech sheet and its PDF (Jordan 2026-09-28: "use
 * the bottle caliper details from the Blender renders").
 *
 * The outline is the LOCKED Blender body cut through its axis
 * (data/register/drawings/<body>-section.json: both halves, mm, z up from the
 * standing ring), so the drawing is the modelled glass to 8 microns. The
 * numbers are the caliper readings from the Bottle Caliper Log, drawn at the
 * model's own datums. A body without a section keeps the older art or none.
 */
import tall9 from "../../../../data/register/drawings/cylinder-9ml-13-415-section.json";

export type Point = [number, number];

export type DrawingFigure = { value: number; label: string; source: string };

export type TechnicalDrawingData = {
    body: string;
    title: string;
    source: string;
    section: { right: Point[]; left: Point[] };
    datums: {
        rimZ: number;
        shoulderZ: number;
        floorZ: number;
        neckPlainZ: number;
        threadCrestZ: number;
        boreR: number;
        neckR: number;
        threadR: number;
        bodyR: number;
    };
    figures: {
        heightMm: DrawingFigure;
        diameterMm: DrawingFigure;
        insideDepthMm: DrawingFigure;
        threadMm: DrawingFigure;
        neckMm: DrawingFigure;
        boreMm: DrawingFigure;
        finishHeightMm: DrawingFigure;
        standingRingMm: DrawingFigure;
        overflowMl: DrawingFigure;
    };
};

const SECTIONS: Record<string, TechnicalDrawingData> = {
    // JSON arrays type as number[][]; each point is an [x, z] pair.
    [tall9.body]: tall9 as unknown as TechnicalDrawingData,
};

export function technicalDrawingFor(bodyId: string | null | undefined): TechnicalDrawingData | null {
    return bodyId ? SECTIONS[bodyId] ?? null : null;
}

/** 105.6 → "105.6", 11 → "11.0", 18.05 → "18.05": tenths unless the reading has hundredths. */
export function formatMm(value: number): string {
    return Number.isInteger(Math.round(value * 1000) / 100) ? value.toFixed(1) : value.toFixed(2);
}

/** The figures in the order the drawing's table lists them. */
export function drawingFigureRows(data: TechnicalDrawingData): Array<{ label: string; value: string }> {
    const f = data.figures;
    const mm = (figure: DrawingFigure, prefix = "") => `${prefix}${formatMm(figure.value)} mm`;
    return [
        { label: f.heightMm.label, value: mm(f.heightMm) },
        { label: f.diameterMm.label, value: mm(f.diameterMm, "Ø ") },
        { label: f.standingRingMm.label, value: mm(f.standingRingMm, "Ø ") },
        { label: f.insideDepthMm.label, value: mm(f.insideDepthMm) },
        { label: f.finishHeightMm.label, value: mm(f.finishHeightMm) },
        { label: f.threadMm.label, value: mm(f.threadMm, "Ø ") },
        { label: f.neckMm.label, value: mm(f.neckMm, "Ø ") },
        { label: f.boreMm.label, value: mm(f.boreMm, "Ø ") },
        { label: f.overflowMl.label, value: `≈ ${f.overflowMl.value.toFixed(1)} ml` },
    ];
}

/** Keeps the part of a closed polygon at or above z = floor (Sutherland–Hodgman, one edge). */
export function clipPolygonAbove(points: Point[], floor: number): Point[] {
    const out: Point[] = [];
    for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const aIn = a[1] >= floor;
        const bIn = b[1] >= floor;
        if (aIn) out.push(a);
        if (aIn !== bIn) {
            const t = (floor - a[1]) / (b[1] - a[1]);
            out.push([a[0] + (b[0] - a[0]) * t, floor]);
        }
    }
    return out;
}

/** Splits an open polyline into the runs at or above z = floor. */
export function clipPolylineAbove(points: Point[], floor: number): Point[][] {
    const runs: Point[][] = [];
    let run: Point[] = [];
    for (let i = 0; i < points.length; i += 1) {
        const p = points[i];
        const prev = points[i - 1];
        if (p[1] >= floor) {
            if (!run.length && prev && prev[1] < floor) {
                const t = (floor - prev[1]) / (p[1] - prev[1]);
                run.push([prev[0] + (p[0] - prev[0]) * t, floor]);
            }
            run.push(p);
        } else if (run.length) {
            const t = (floor - prev[1]) / (p[1] - prev[1]);
            run.push([prev[0] + (p[0] - prev[0]) * t, floor]);
            runs.push(run);
            run = [];
        }
    }
    if (run.length) runs.push(run);
    return runs;
}

/**
 * The left half as the drawing shows it: the outside (base, wall, neck, rim)
 * as a visible edge and the cavity (bore, wall, floor) as a hidden edge.
 * The half runs base axis → outside → rim → inside → floor axis.
 */
export function splitLeftHalf(left: Point[], rimZ: number): { outside: Point[]; inside: Point[] } {
    // Walk from the base axis (the lower end) whichever way the section was traced.
    const half = left.length && left[0][1] > left[left.length - 1][1] ? [...left].reverse() : left;
    const rim = half.findIndex((p) => p[1] >= rimZ - 1e-3);
    if (rim < 0) return { outside: half, inside: [] };
    const rimEnd = half.length - 1 - [...half].reverse().findIndex((p) => p[1] >= rimZ - 1e-3);
    // The rim is flat: the outside owns its outer corner, the rim run and its inner corner.
    return { outside: half.slice(0, rimEnd + 1), inside: half.slice(rimEnd) };
}

export function pathOf(points: Point[], toX: (x: number) => number, toY: (z: number) => number, close = false): string {
    if (!points.length) return "";
    const d = points.map((p, i) => `${i ? "L" : "M"}${toX(p[0]).toFixed(3)} ${toY(p[1]).toFixed(3)}`).join("");
    return close ? `${d}Z` : d;
}
