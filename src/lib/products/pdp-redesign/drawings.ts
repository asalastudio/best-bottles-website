/**
 * Dimension drawings for the tech sheet (design 3a §5.2's drawing slot).
 *
 * The drawing is two things kept apart: the ART, a Sunburst 2.5 trace of the
 * register composition (the body's plate with one closure of the SKU's type),
 * fitted to the register geometry and keyed out of its paper
 * (scripts/register/drawings/), and the FIGURES, which the page draws itself
 * from the SKU's own measurements, so a number on the drawing is never
 * anything but the catalogue's. Only the figures the SKU holds are drawn.
 *
 * Art is registered per body and closure type in data/register/drawings/;
 * a body without art keeps the placeholder.
 */
import { parseProductSlug } from "@/lib/products/group-variant-intent";
import cylinder9 from "../../../../data/register/drawings/cylinder-9ml-17-415.json";

export type DrawingStyle = "ink" | "pencil";
export const DRAWING_STYLES: readonly DrawingStyle[] = ["ink", "pencil"];

export type DrawingArt = {
    src: string;
    width: number;
    height: number;
    /** The closure's top, the neck seat and the foot, in the art's pixels. */
    closureTopY: number;
    seatY: number;
    footY: number;
    axisX: number;
    glassLeft: number;
    glassRight: number;
};

export type DrawingFigures = {
    heightWithCapMm: number | null;
    heightWithoutCapMm: number | null;
    diameterMm: number | null;
    neck: string | null;
};

export type DrawingSpec = { art: DrawingArt; style: DrawingStyle; closure: string; figures: DrawingFigures };

type BodyDrawings = { body: string; closures: Record<string, Partial<Record<DrawingStyle, DrawingArt>>> };

const REGISTRY: Record<string, BodyDrawings> = {
    [cylinder9.body]: cylinder9 as BodyDrawings,
};

const CLOSURE_BY_APPLICATOR: Array<[RegExp, string]> = [
    [/roller/i, "rollon"],
    [/fine mist|sprayer|atomi[sz]er/i, "finemist"],
    [/lotion|pump/i, "lotionpump"],
    [/dropper/i, "dropper"],
];

/** "cylinder-9ml-17-415": the register's body id, from the group's slug grammar. */
export function drawingBodyId(slug: string): string | null {
    const parsed = parseProductSlug(slug);
    if (!parsed) return null;
    return `${parsed.family}-${parsed.capacityMl}ml-${parsed.neck}`;
}

export function drawingClosure(slug: string, applicator: string | null | undefined): string | null {
    const parsed = parseProductSlug(slug);
    if (parsed?.closure) return parsed.closure;
    for (const [pattern, closure] of CLOSURE_BY_APPLICATOR) if (applicator && pattern.test(applicator)) return closure;
    return null;
}

/** "83 ±1 mm" → 83; "20 ±0.5 mm" → 20; blank → null. Render only what the field holds. */
export function millimetres(value: string | number | null | undefined): number | null {
    if (value == null) return null;
    if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
    const match = /-?\d+(?:\.\d+)?/.exec(value);
    if (!match) return null;
    const mm = Number(match[0]);
    return Number.isFinite(mm) && mm > 0 ? mm : null;
}

export function drawingStyleFromQuery(value: string | null | undefined): DrawingStyle {
    return value === "pencil" ? "pencil" : "ink";
}

export function drawingFor(
    slug: string,
    variant: { applicator?: string | null; heightWithCap?: string | null; heightWithoutCap?: string | null; diameter?: string | null; neckThreadSize?: string | null } | null | undefined,
    style: DrawingStyle = "ink",
): DrawingSpec | null {
    const bodyId = drawingBodyId(slug);
    if (!bodyId) return null;
    const body = REGISTRY[bodyId];
    if (!body) return null;
    const closure = drawingClosure(slug, variant?.applicator);
    if (!closure) return null;
    const art = body.closures[closure]?.[style] ?? body.closures[closure]?.ink ?? null;
    if (!art) return null;
    return {
        art,
        style: body.closures[closure]?.[style] ? style : "ink",
        closure,
        figures: {
            heightWithCapMm: millimetres(variant?.heightWithCap),
            heightWithoutCapMm: millimetres(variant?.heightWithoutCap),
            diameterMm: millimetres(variant?.diameter),
            neck: variant?.neckThreadSize?.trim() || null,
        },
    };
}
