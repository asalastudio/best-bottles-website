/*
 * A family drawn as a group of its own outline icon, one per size, standing on one shelf at their relative heights
 * (Jordan, 24 Nov 2026: "instead of using the real Boston Round bottle, we can make a group of them: 15, 30 and 60").
 * Build Your Bottle's first screen draws these in place of bottle photographs.
 *
 * The outlines are the menu icons (family-shape-paths.generated.json, a 24-unit grid with the base at y = 22). Three
 * families get an outline of their own here:
 *   Diva, Diamond  the traced icon is made for 18 to 24 px and reads as a plain flask at tile size, so these carry
 *                  the detail that identifies the bottle (flutes and foot; the diamond cut). They clog at menu size,
 *                  which is why FamilyShapeIcon keeps the plain ones.
 *   Vial           its menu icon is drawn with arcs; the same vial here as straight segments.
 */
import traced from "./family-shape-paths.generated.json";

const TILE_OUTLINES: Record<string, string> = {
    Diva: "M10.30 2.00 L13.70 2.00 L13.80 2.40 L13.80 5.30 L14.30 5.50 L14.30 5.90 L15.50 6.10 L15.60 6.60 L16.70 7.60 L17.30 9.00 L17.44 10.20 L17.20 12.00 L16.50 14.20 L15.60 16.20 L14.90 17.60 L14.90 18.20 L15.10 18.50 L15.00 19.10 L15.90 19.90 L16.40 20.70 L16.30 21.50 L15.60 22.00 L8.40 22.00 L7.70 21.50 L7.60 20.70 L8.10 19.90 L9.00 19.10 L8.90 18.50 L9.10 18.20 L9.10 17.60 L8.40 16.20 L7.50 14.20 L6.80 12.00 L6.56 10.20 L6.70 9.00 L7.30 7.60 L8.40 6.60 L8.50 6.10 L9.70 5.90 L9.70 5.50 L10.20 5.30 L10.20 2.40 Z"
        + " M10.20 3.70 L13.80 3.70 M8.40 6.60 L15.60 6.60 M9.10 18.20 L14.90 18.20 M9.00 19.10 L15.00 19.10"
        + " M10.60 6.80 L9.95 8.60 L9.70 10.40 L9.85 12.60 L10.35 14.80 L11.00 17.90 M13.40 6.80 L14.05 8.60 L14.30 10.40 L14.15 12.60 L13.65 14.80 L13.00 17.90"
        + " M12.00 19.30 L12.00 21.80",
    Diamond: "M10.40 2.00 L13.60 2.00 L13.80 2.40 L13.80 5.30 L16.00 5.60 L16.40 5.95 L16.75 14.00 L16.30 20.60 L15.80 21.10 L12.00 22.00 L8.20 21.10 L7.70 20.60 L7.25 14.00 L7.60 5.95 L8.00 5.60 L10.20 5.30 L10.20 2.40 Z"
        + " M10.20 3.20 L13.80 3.20 M10.20 4.30 L13.80 4.30"
        + " M12.00 5.90 L16.75 14.00 L12.00 21.70 L7.25 14.00 Z M12.00 7.70 L15.65 14.00 L12.00 20.00 L8.35 14.00 Z",
    Vial: "M10.20 7.50 L13.80 7.50 L13.80 20.20 L13.56 21.10 L12.90 21.76 L12.00 22.00 L11.10 21.76 L10.44 21.10 L10.20 20.20 Z M9.90 7.50 L14.10 7.50 L14.10 4.50 L9.90 4.50 Z",
};
/** A family with no outline yet: a plain shouldered bottle. */
const GENERIC = "M10.20 5.50 L13.80 5.50 L13.80 8.00 L15.20 8.40 L15.80 10.00 L15.80 21.20 L15.00 22.00 L9.00 22.00 L8.20 21.20 L8.20 10.00 L8.80 8.40 L10.20 8.00 Z";

const BASE = 22;          // the icons' base line on their 24-unit grid
const SHELF = 78;         // where every group stands on the 100-unit tile
const TALLEST = 56;       // the tallest icon's height on the tile
const WIDEST = 86;        // the widest a group may be
const GAP = 7;

/** The outline the family screen draws for this family: straight segments only (M, L, Z), absolute. */
export function familyTileOutline(family: string): string {
    return TILE_OUTLINES[family] ?? (traced as Record<string, string>)[family] ?? GENERIC;
}

/** Relative heights, smallest first, kept visibly stepped: two sizes a few millimetres apart still read as two. */
export function steppedHeights(heights: readonly number[]): number[] {
    const sorted = heights.filter(h => Number.isFinite(h) && h > 0).sort((a, b) => a - b);
    if (!sorted.length) return [1];
    const stepped = sorted.map(h => h);
    for (let i = 1; i < stepped.length; i++) stepped[i] = Math.max(stepped[i], stepped[i - 1] + .08);
    const tallest = stepped[stepped.length - 1];
    return stepped.map(h => Math.round(h / tallest * 1000) / 1000);
}

/**
 * One path for the whole group on a 100 x 100 grid: the family's outline once per height, side by side, base
 * lines together. Every tile then draws its group at the same line weight, however many bottles it shows.
 */
export function familyIconGroup(family: string, heights: readonly number[]): string {
    const points: Array<["M" | "L", number, number] | ["Z"]> = [];
    let left = Infinity, right = -Infinity, top = Infinity;
    for (const [, command, x, y] of familyTileOutline(family).matchAll(/([MLZ])\s*(-?[\d.]+)?[\s,]*(-?[\d.]+)?/g)) {
        if (command === "Z") { points.push(["Z"]); continue; }
        const px = Number(x), py = Number(y);
        points.push([command as "M" | "L", px, py]);
        left = Math.min(left, px); right = Math.max(right, px); top = Math.min(top, py);
    }
    const scales = steppedHeights(heights);
    const width = right - left, height = BASE - top;
    const total = scales.reduce((sum, scale) => sum + width * scale, 0);
    const unit = Math.min(TALLEST / height, (WIDEST - GAP * (scales.length - 1)) / total);
    let x = 50 - (total * unit + GAP * (scales.length - 1)) / 2;
    const out: string[] = [];
    for (const scale of scales) {
        const f = unit * scale;
        for (const point of points) {
            out.push(point[0] === "Z" ? "Z" : `${point[0]}${(x + (point[1] - left) * f).toFixed(2)} ${(SHELF - (BASE - point[2]) * f).toFixed(2)}`);
        }
        x += width * f + GAP;
    }
    return out.join(" ");
}

/** "55 ml", "78 and 128 ml", "3.3 to 100 ml": the sizes a family comes in, from the ones its group shows. */
export function familySizeRange(capacitiesMl: readonly number[]): string {
    const sizes = [...new Set(capacitiesMl)].sort((a, b) => a - b);
    if (!sizes.length) return "";
    if (sizes.length === 1) return `${sizes[0]} ml`;
    if (sizes.length === 2) return `${sizes[0]} and ${sizes[1]} ml`;
    return `${sizes[0]} to ${sizes[sizes.length - 1]} ml`;
}
