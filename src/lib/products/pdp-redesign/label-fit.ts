/**
 * Label placement for the tech sheet (Jordan 2026-09-29: "for every bottle that
 * can accommodate a label … a label example of where the label goes").
 *
 * One entry per standard glass body, keyed like the technical drawings
 * (drawingBodyId: "<family>-<ml>ml-<neck>"). Each entry is the largest label
 * the bottle takes, where it sits, and the standard stock sizes that fit inside
 * it. Custom shapes (Diva, Diamond, Grace, Royal, Flair, Teardrop, Bell,
 * Pillar, the round spheres, decoratives) have no entry and show nothing.
 *
 * Where the numbers come from, best first:
 *   print-area  the Best Bottles print area drawing for the bottle
 *   drawing     calculated from the Best Bottles bottle drawing
 *   supplier    published label panels for the same bottle size
 *   measured    calculated from our own measurements (register, plates, caliper)
 * The calculated ones use rules that reproduce the print-area drawings exactly:
 * wrap = ⌊π·Ø − 2.5⌋; round height = shoulder − heel − 4; flat faces start
 * 5 mm above the base and stop about 4 mm under the straight wall.
 * Research and sources: the Label Fit Guide (claude.ai artifact Pf3RBc6CoPL2iXFZuMAskc).
 *
 * Every length is millimetres, heights measured up from the standing ring.
 */

export type LabelFitSource = "print-area" | "drawing" | "supplier" | "measured";

/** wrap: round body, one label round the wall. face: a flat label per face. disc: a round label on each flat face. */
export type LabelFitShape = "wrap" | "face" | "disc";

/** A standard label size in inches (width across the bottle × height). */
export type StockLabel = { widthIn: number; heightIn: number; round?: boolean };

export type LabelFit = {
    body: string;
    shape: LabelFitShape;
    glass: {
        heightMm: number;
        /** Round bodies: the diameter. Flat bodies: the front face. Discs: the disc's width. */
        widthMm: number;
        /** Flat bodies and discs: the side (thickness). */
        depthMm?: number;
        /** Base up to where the straight wall starts (the heel). */
        heelMm: number;
        /** Base up to where the wall or face ends (the shoulder); a disc's top. */
        shoulderMm: number;
        /** Base up to the neck. */
        neckBaseMm: number;
        /** The finish's thread diameter. */
        finishMm: number;
        /** Discs: the width of the foot. */
        footMm?: number;
    };
    label: {
        /** Round bodies: the wrap length. Flat: the face width. Discs: the largest round label. */
        widthMm: number;
        heightMm: number;
        /** Base up to the label's bottom edge (discs: centred on the face). */
        fromBaseMm: number;
        /** How many identical faces take it (4 on a square, 2 front and back). */
        panels: number;
    };
    source: LabelFitSource;
    stock: { wrap?: StockLabel; front?: StockLabel };
    note?: string;
};

const wrap = (d: number) => Math.floor(Math.PI * d - 2.5);

const FITS: LabelFit[] = [
    // ── cylinders ──────────────────────────────────────────────────────────
    {
        body: "cylinder-5ml-13-415", shape: "wrap", source: "print-area",
        glass: { heightMm: 53, widthMm: 18, heelMm: 0.8, shoulderMm: 40, neckBaseMm: 42, finishMm: 12.9 },
        label: { widthMm: 54, heightMm: 35, fromBaseMm: 2.5, panels: 1 },
        stock: { wrap: { widthIn: 2, heightIn: 1 }, front: { widthIn: 0.75, heightIn: 1 } },
    },
    {
        body: "cylinder-9ml-17-415", shape: "wrap", source: "print-area",
        glass: { heightMm: 70, widthMm: 20, heelMm: 1.5, shoulderMm: 55.5, neckBaseMm: 56.5, finishMm: 16.3 },
        label: { widthMm: 60, heightMm: 49, fromBaseMm: 3.25, panels: 1 },
        stock: { wrap: { widthIn: 2.125, heightIn: 1.6875 }, front: { widthIn: 1, heightIn: 1.5 } },
    },
    {
        body: "cylinder-9ml-13-415", shape: "wrap", source: "drawing",
        glass: { heightMm: 106.2, widthMm: 18, heelMm: 1.2, shoulderMm: 94.75, neckBaseMm: 96.75, finishMm: 12.87 },
        label: { widthMm: wrap(18), heightMm: 89, fromBaseMm: 3.2, panels: 1 },
        stock: { wrap: { widthIn: 2.125, heightIn: 2.125 }, front: { widthIn: 0.5, heightIn: 1.75 } },
    },
    {
        body: "cylinder-25ml-18-415", shape: "wrap", source: "measured",
        glass: { heightMm: 83, widthMm: 32, heelMm: 2.8, shoulderMm: 67.2, neckBaseMm: 68.4, finishMm: 17.5 },
        label: { widthMm: wrap(32), heightMm: 60, fromBaseMm: 4.8, panels: 1 },
        stock: { wrap: { widthIn: 3.75, heightIn: 1.25 }, front: { widthIn: 1, heightIn: 2 } },
    },
    {
        body: "cylinder-50ml-18-415", shape: "wrap", source: "measured",
        glass: { heightMm: 116.45, widthMm: 32, heelMm: 3.2, shoulderMm: 100.67, neckBaseMm: 101.9, finishMm: 17.5 },
        label: { widthMm: wrap(32), heightMm: 93, fromBaseMm: 5.2, panels: 1 },
        stock: { wrap: { widthIn: 3.75, heightIn: 1.25 }, front: { widthIn: 1.5, heightIn: 3 } },
    },
    {
        body: "cylinder-100ml-18-415", shape: "wrap", source: "measured",
        glass: { heightMm: 154, widthMm: 35, heelMm: 4.2, shoulderMm: 138.2, neckBaseMm: 139.4, finishMm: 17.5 },
        label: { widthMm: wrap(35), heightMm: 130, fromBaseMm: 6.2, panels: 1 },
        stock: { wrap: { widthIn: 4, heightIn: 1.5 }, front: { widthIn: 1.5, heightIn: 4 } },
    },
    {
        body: "cylinder-28ml-16mm", shape: "wrap", source: "measured",
        glass: { heightMm: 81, widthMm: 31, heelMm: 2.8, shoulderMm: 65.7, neckBaseMm: 67.2, finishMm: 16 },
        label: { widthMm: wrap(31), heightMm: 58, fromBaseMm: 4.8, panels: 1 },
        stock: { wrap: { widthIn: 3, heightIn: 1.5 }, front: { widthIn: 1, heightIn: 2 } },
    },
    {
        body: "cylinder-50ml-16mm", shape: "wrap", source: "measured",
        glass: { heightMm: 98, widthMm: 37, heelMm: 2.8, shoulderMm: 85.2, neckBaseMm: 86.7, finishMm: 16 },
        label: { widthMm: wrap(37), heightMm: 78, fromBaseMm: 4.8, panels: 1 },
        stock: { wrap: { widthIn: 4, heightIn: 1.5 }, front: { widthIn: 1.5, heightIn: 3 } },
    },
    // ── vials ──────────────────────────────────────────────────────────────
    {
        body: "vial-4ml-13-425", shape: "wrap", source: "measured",
        glass: { heightMm: 45, widthMm: 15, heelMm: 3, shoulderMm: 34.5, neckBaseMm: 36, finishMm: 12.9 },
        label: { widthMm: wrap(15), heightMm: 27, fromBaseMm: 5, panels: 1 },
        stock: { wrap: { widthIn: 1.5, heightIn: 1 }, front: { widthIn: 0.75, heightIn: 1 } },
    },
    {
        body: "vial-2ml-8-425", shape: "wrap", source: "measured",
        glass: { heightMm: 35, widthMm: 12, heelMm: 2, shoulderMm: 26, neckBaseMm: 27.5, finishMm: 8 },
        label: { widthMm: wrap(12), heightMm: 20, fromBaseMm: 4, panels: 1 },
        stock: {},
        note: "Use a thin film label; standard sizes run too long or too short for this diameter.",
    },
    {
        body: "vial-9ml-18-400", shape: "wrap", source: "measured",
        glass: { heightMm: 79.4, widthMm: 20, heelMm: 2, shoulderMm: 73.3, neckBaseMm: 74.5, finishMm: 17.9 },
        label: { widthMm: wrap(20), heightMm: 67, fromBaseMm: 4, panels: 1 },
        stock: { wrap: { widthIn: 2.125, heightIn: 2.125 }, front: { widthIn: 1, heightIn: 2.625 } },
    },
    // ── tulip: two panels between the mould seams ──────────────────────────
    ...(["tulip-5ml-13-415", "tulip-6ml-13-415"] as const).map((body): LabelFit => ({
        body, shape: "wrap", source: body === "tulip-6ml-13-415" ? "print-area" : "drawing",
        glass: { heightMm: 46.4, widthMm: 23, heelMm: 6, shoulderMm: 34, neckBaseMm: 34.8, finishMm: 12.9 },
        label: { widthMm: 30, heightMm: 24, fromBaseMm: 6, panels: 2 },
        stock: { front: { widthIn: 1, heightIn: 0.75 } },
        note: "Two labels, front and back, each between the mould seams.",
    })),
    // ── Boston rounds (published panels for the same ½, 1 and 2 oz bottle) ──
    {
        body: "boston-round-15ml-18-400", shape: "wrap", source: "supplier",
        glass: { heightMm: 68, widthMm: 25, heelMm: 4, shoulderMm: 47, neckBaseMm: 57.5, finishMm: 17.9 },
        label: { widthMm: wrap(25), heightMm: 38, fromBaseMm: 6, panels: 1 },
        stock: { wrap: { widthIn: 3, heightIn: 1.5 }, front: { widthIn: 1, heightIn: 1.5 } },
    },
    {
        body: "boston-round-30ml-20-400", shape: "wrap", source: "supplier",
        glass: { heightMm: 78, widthMm: 33, heelMm: 4, shoulderMm: 52, neckBaseMm: 67, finishMm: 19.9 },
        label: { widthMm: wrap(33), heightMm: 43, fromBaseMm: 6, panels: 1 },
        stock: { wrap: { widthIn: 4, heightIn: 1.5 }, front: { widthIn: 1.5, heightIn: 1 } },
    },
    {
        body: "boston-round-60ml-20-400", shape: "wrap", source: "supplier",
        glass: { heightMm: 94, widthMm: 39, heelMm: 5, shoulderMm: 60, neckBaseMm: 83, finishMm: 19.9 },
        label: { widthMm: wrap(39), heightMm: 50, fromBaseMm: 7, panels: 1 },
        stock: { wrap: { widthIn: 4, heightIn: 1.5 }, front: { widthIn: 1.5, heightIn: 1 } },
    },
    // ── flat faces ─────────────────────────────────────────────────────────
    {
        body: "empire-50ml-18-415", shape: "face", source: "print-area",
        glass: { heightMm: 88, widthMm: 37, depthMm: 37, heelMm: 1, shoulderMm: 71, neckBaseMm: 72.2, finishMm: 17.5 },
        label: { widthMm: 29.9, heightMm: 59, fromBaseMm: 5, panels: 4 },
        stock: { front: { widthIn: 1, heightIn: 2 } },
    },
    {
        body: "empire-100ml-18-415", shape: "face", source: "print-area",
        glass: { heightMm: 107.12, widthMm: 45.4, depthMm: 45.4, heelMm: 1, shoulderMm: 89.12, neckBaseMm: 91.32, finishMm: 17.5 },
        label: { widthMm: 35.4, heightMm: 80.1, fromBaseMm: 5, panels: 4 },
        stock: { front: { widthIn: 1, heightIn: 2.625 } },
    },
    {
        body: "sleek-30ml-18-415", shape: "face", source: "print-area",
        glass: { heightMm: 97.6, widthMm: 28, depthMm: 28, heelMm: 0.5, shoulderMm: 81.82, neckBaseMm: 82.3, finishMm: 17.5 },
        label: { widthMm: 20, heightMm: 71.5, fromBaseMm: 5, panels: 4 },
        stock: { front: { widthIn: 0.5, heightIn: 1.75 } },
    },
    {
        body: "sleek-50ml-18-415", shape: "face", source: "print-area",
        glass: { heightMm: 139.18, widthMm: 28, depthMm: 28, heelMm: 0.5, shoulderMm: 123.38, neckBaseMm: 123.9, finishMm: 17.5 },
        label: { widthMm: 20, heightMm: 113, fromBaseMm: 7.38, panels: 4 },
        stock: { front: { widthIn: 0.5, heightIn: 1.75 } },
    },
    {
        body: "sleek-100ml-18-415", shape: "face", source: "measured",
        glass: { heightMm: 149, widthMm: 36, depthMm: 36, heelMm: 0.5, shoulderMm: 135.8, neckBaseMm: 136.3, finishMm: 17.5 },
        label: { widthMm: 25, heightMm: 126, fromBaseMm: 5, panels: 4 },
        stock: { front: { widthIn: 1, heightIn: 2.625 } },
    },
    {
        body: "sleek-8ml-13-415", shape: "face", source: "measured",
        glass: { heightMm: 66, widthMm: 17, depthMm: 17, heelMm: 0.5, shoulderMm: 55.1, neckBaseMm: 55.6, finishMm: 12.9 },
        label: { widthMm: 12, heightMm: 46, fromBaseMm: 5, panels: 4 },
        stock: {},
        note: "A ½ in wide label fits if centred. Set the text turned 90° to read up the face.",
    },
    {
        body: "sleek-5ml-13-415", shape: "face", source: "measured",
        glass: { heightMm: 45, widthMm: 17, depthMm: 17, heelMm: 0.5, shoulderMm: 33.1, neckBaseMm: 33.6, finishMm: 12.9 },
        label: { widthMm: 12, heightMm: 24, fromBaseMm: 5, panels: 4 },
        stock: {},
        note: "A ½ in wide label fits if centred. Set the text turned 90° to read up the face.",
    },
    {
        body: "slim-100ml-18-415", shape: "face", source: "print-area",
        glass: { heightMm: 154, widthMm: 37, depthMm: 37, heelMm: 1, shoulderMm: 136, neckBaseMm: 138.2, finishMm: 17.5 },
        label: { widthMm: 24, heightMm: 120, fromBaseMm: 8, panels: 4 },
        stock: { front: { widthIn: 0.5, heightIn: 1.75 } },
    },
    {
        body: "slim-50ml-18-415", shape: "face", source: "measured",
        glass: { heightMm: 121, widthMm: 31, depthMm: 31, heelMm: 1, shoulderMm: 103.5, neckBaseMm: 105.2, finishMm: 17.5 },
        label: { widthMm: 20, heightMm: 90, fromBaseMm: 6.7, panels: 4 },
        stock: { front: { widthIn: 0.5, heightIn: 1.75 } },
    },
    {
        body: "slim-30ml-18-415", shape: "face", source: "measured",
        glass: { heightMm: 87, widthMm: 30, depthMm: 30, heelMm: 1, shoulderMm: 70, neckBaseMm: 71.2, finishMm: 17.5 },
        label: { widthMm: 19, heightMm: 64, fromBaseMm: 3, panels: 4 },
        stock: { front: { widthIn: 0.5, heightIn: 1.75 } },
    },
    {
        body: "square-15ml-13-415", shape: "face", source: "measured",
        glass: { heightMm: 52, widthMm: 26, depthMm: 26, heelMm: 1, shoulderMm: 42.3, neckBaseMm: 42.8, finishMm: 12.9 },
        label: { widthMm: 19, heightMm: 33, fromBaseMm: 5, panels: 4 },
        stock: { front: { widthIn: 0.5, heightIn: 1 } },
    },
    {
        body: "footed-rectangle-10ml-13-415", shape: "face", source: "measured",
        glass: { heightMm: 50, widthMm: 29, depthMm: 19, heelMm: 6, shoulderMm: 35, neckBaseMm: 35.8, finishMm: 12.9 },
        label: { widthMm: 21, heightMm: 23, fromBaseMm: 8, panels: 2 },
        stock: {},
        note: "The foot raises the label; the wide faces take it.",
    },
    {
        body: "elegant-15ml-13-415", shape: "face", source: "drawing",
        glass: { heightMm: 61.4, widthMm: 36.1, depthMm: 18.2, heelMm: 1, shoulderMm: 50, neckBaseMm: 50.8, finishMm: 12.9 },
        label: { widthMm: 28, heightMm: 41, fromBaseMm: 5, panels: 2 },
        stock: { front: { widthIn: 1, heightIn: 1.5 } },
    },
    {
        body: "elegant-30ml-15-415", shape: "face", source: "drawing",
        glass: { heightMm: 75, widthMm: 45, depthMm: 22, heelMm: 2, shoulderMm: 58, neckBaseMm: 59.5, finishMm: 14.3 },
        label: { widthMm: 35, heightMm: 50, fromBaseMm: 5, panels: 2 },
        stock: { front: { widthIn: 1, heightIn: 1.5 } },
    },
    {
        body: "elegant-60ml-18-415", shape: "face", source: "drawing",
        glass: { heightMm: 86.7, widthMm: 54.5, depthMm: 27.5, heelMm: 2, shoulderMm: 68.9, neckBaseMm: 70.8, finishMm: 17.5 },
        label: { widthMm: 42, heightMm: 59, fromBaseMm: 5, panels: 2 },
        stock: { front: { widthIn: 1, heightIn: 2 } },
    },
    {
        body: "elegant-100ml-18-415", shape: "face", source: "measured",
        glass: { heightMm: 109, widthMm: 61, depthMm: 30, heelMm: 2, shoulderMm: 91.5, neckBaseMm: 93.2, finishMm: 17.5 },
        label: { widthMm: 47, heightMm: 84, fromBaseMm: 5, panels: 2 },
        stock: { front: { widthIn: 1.5, heightIn: 3 } },
    },
    // ── discs: a round label on each flat face ─────────────────────────────
    {
        body: "circle-15ml-13-415", shape: "disc", source: "measured",
        glass: { heightMm: 60, widthMm: 50, depthMm: 17, heelMm: 0, shoulderMm: 48, neckBaseMm: 48, finishMm: 12.9, footMm: 31 },
        label: { widthMm: 39, heightMm: 39, fromBaseMm: 0, panels: 2 },
        stock: { front: { widthIn: 1.5, heightIn: 1.5, round: true } },
    },
    {
        body: "circle-30ml-15-415", shape: "disc", source: "drawing",
        glass: { heightMm: 74, widthMm: 60.3, depthMm: 20.5, heelMm: 0, shoulderMm: 59.6, neckBaseMm: 59.6, finishMm: 14.3, footMm: 37.1 },
        label: { widthMm: 49, heightMm: 49, fromBaseMm: 0, panels: 2 },
        stock: { front: { widthIn: 1.75, heightIn: 1.75, round: true } },
    },
    {
        body: "circle-50ml-18-415", shape: "disc", source: "drawing",
        glass: { heightMm: 87.7, widthMm: 72.5, depthMm: 23.5, heelMm: 0, shoulderMm: 71.9, neckBaseMm: 71.9, finishMm: 17.5, footMm: 45 },
        label: { widthMm: 62, heightMm: 62, fromBaseMm: 0, panels: 2 },
        stock: { front: { widthIn: 2, heightIn: 2, round: true } },
    },
    {
        body: "circle-100ml-18-415", shape: "disc", source: "measured",
        glass: { heightMm: 105, widthMm: 89, depthMm: 29, heelMm: 0, shoulderMm: 89.2, neckBaseMm: 89.2, finishMm: 17.5, footMm: 55 },
        label: { widthMm: 78, heightMm: 78, fromBaseMm: 0, panels: 2 },
        stock: { front: { widthIn: 2.5, heightIn: 2.5, round: true } },
    },
];

const BY_BODY = new Map(FITS.map((fit) => [fit.body, fit]));

export function labelFitFor(bodyId: string | null | undefined): LabelFit | null {
    return bodyId ? BY_BODY.get(bodyId) ?? null : null;
}

export function allLabelFits(): readonly LabelFit[] {
    return FITS;
}

/** Discs: where the face's centre sits (the disc's top less its radius). */
export function discCentreMm(fit: LabelFit): number {
    return fit.glass.shoulderMm - fit.glass.widthMm / 2;
}

/** The part of a wrap that faces the customer: 40% of the way round, as the FDA sizes a round bottle's front. */
export function frontZoneMm(fit: LabelFit): number | null {
    if (fit.shape !== "wrap" || fit.label.panels !== 1) return null;
    return Math.round(0.4 * Math.PI * fit.glass.widthMm * 10) / 10;
}

export function circumferenceMm(fit: LabelFit): number | null {
    return fit.shape === "wrap" ? Math.round(Math.PI * fit.glass.widthMm * 10) / 10 : null;
}

export const LABEL_FIT_SOURCE_TEXT: Record<LabelFitSource, string> = {
    "print-area": "Best Bottles print area drawing",
    drawing: "Calculated from the Best Bottles bottle drawing",
    supplier: "Published label panels for this bottle size",
    measured: "Calculated from our measurements of this bottle",
};

export const LABEL_FIT_DISCLAIMER =
    "Label guidance, not a print specification. Glass varies slightly from batch to batch, about ±1 mm across the diameter, " +
    "so confirm the size, bleed and label material with your label printer, and test a printed label on a sample of this bottle " +
    "before ordering a full run. Label wording and regulatory content are the brand's responsibility; Best Bottles supplies the " +
    "glass and does not print or apply labels.";

const FRACTIONS: Array<[number, string]> = [
    [0.125, "⅛"], [0.1875, "3/16"], [0.25, "¼"], [0.375, "⅜"], [0.5, "½"], [0.625, "⅝"], [0.6875, "11/16"], [0.75, "¾"], [0.875, "⅞"],
];

/** 2.125 → "2⅛", 1.6875 → "1 11/16", 0.5 → "½", 3 → "3". */
export function inches(value: number): string {
    const whole = Math.floor(value + 1e-9);
    const part = value - whole;
    if (part < 1e-6) return String(whole);
    const match = FRACTIONS.find(([f]) => Math.abs(f - part) < 1e-6);
    if (!match) return value.toFixed(2).replace(/0+$/, "");
    const [, glyph] = match;
    if (!whole) return glyph;
    return glyph.includes("/") ? `${whole} ${glyph}` : `${whole}${glyph}`;
}

/** "2⅛ × 1 11/16 in (54 × 42.9 mm)"; rounds say "2 in round (50.8 mm)". */
export function stockText(stock: StockLabel): string {
    const mm = (v: number) => (Math.round(v * 25.4 * 10) / 10).toString();
    if (stock.round) return `${inches(stock.widthIn)} in round (Ø ${mm(stock.widthIn)} mm)`;
    return `${inches(stock.widthIn)} × ${inches(stock.heightIn)} in (${mm(stock.widthIn)} × ${mm(stock.heightIn)} mm)`;
}

/** Film below Ø25.4: stiff paper lifts at the edges on a tight curve. */
export function labelStock(fit: LabelFit): string {
    if (fit.shape !== "wrap") return "Paper or film";
    if (fit.glass.widthMm < 12.7) return "Thin, conformable film";
    if (fit.glass.widthMm < 25.4) return "Film (paper lifts at the edges on this curve)";
    return "Paper or film";
}

/** The figures beside the drawing, in the order the tech sheet lists them. */
export function labelFitRows(fit: LabelFit): Array<{ k: string; v: string }> {
    const lab = fit.label;
    const size = `${formatLabelMm(lab.widthMm)} × ${formatLabelMm(lab.heightMm)} mm`;
    const rows: Array<{ k: string; v: string }> = [];
    if (fit.shape === "disc") {
        rows.push({ k: "Label area", v: `Round, up to Ø ${formatLabelMm(lab.widthMm)} mm` });
        rows.push({ k: "Where", v: "Centred on each flat face" });
    } else if (fit.shape === "face") {
        rows.push({ k: "Label area", v: `${size}, each face` });
        rows.push({ k: "Where", v: `${formatLabelMm(lab.fromBaseMm)} mm above the base, on ${lab.panels === 4 ? "any of the four faces" : "the front and back"}` });
    } else if (lab.panels > 1) {
        rows.push({ k: "Label area", v: `${size}, front and back` });
        rows.push({ k: "Where", v: `${formatLabelMm(lab.fromBaseMm)} mm above the base, between the mould seams` });
    } else {
        rows.push({ k: "Label area", v: `${size} wrap` });
        rows.push({ k: "Where", v: `${formatLabelMm(lab.fromBaseMm)} mm above the base, seam at the back` });
        const front = frontZoneMm(fit);
        const circ = circumferenceMm(fit);
        if (front && circ) rows.push({ k: "Faces the customer", v: `The middle ${formatLabelMm(front)} mm of the wrap (${formatLabelMm(circ)} mm round)` });
    }
    const frontName = fit.shape === "wrap" ? "Front " : fit.shape === "face" ? "Face " : "";
    const stock = [fit.stock.wrap ? `Wrap ${stockText(fit.stock.wrap)}` : null, fit.stock.front ? `${frontName}${stockText(fit.stock.front)}` : null].filter(Boolean);
    rows.push({ k: "Standard sizes that fit", v: stock.length ? stock.join(" · ") : "Custom size" });
    rows.push({ k: "Label stock", v: labelStock(fit) });
    rows.push({ k: "Source", v: LABEL_FIT_SOURCE_TEXT[fit.source] });
    return rows;
}

export function formatLabelMm(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(value * 10 === Math.round(value * 10) ? 1 : 2);
}
