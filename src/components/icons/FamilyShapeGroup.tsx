/*
 * A bottle family drawn as a group of outlines, one per size, standing on one shelf at their measured relative
 * heights (Jordan, 24 Nov 2026 Build Your Bottle mock-up: outline icons on the family screen instead of photos).
 *
 * Most families use the same plain outline the menus draw (FamilyShapeIcon). Diva and Diamond have tile-size
 * redraws with the detail that clogs at 18–24 px: Diva's flutes, shoulder disc, waist ring and foot; Diamond's
 * threaded neck and its double rhombus. Those redraws are only for this group, never for the small menu icons.
 */
import type { SVGProps } from "react";
import { FAMILY_SHAPE_BASELINE, familyShapeOutline } from "./FamilyShapeIcon";

/** Tile-size redraws from the bottle photos, on the same 24-unit grid and baseline as the traced outlines. */
const TILE_DETAIL: Record<string, { paths: string[]; x0: number; x1: number; top: number }> = {
    // Threaded neck, collar, shoulder disc, fluted urn body, waist ring, scalloped foot.
    Diva: {
        paths: [
            "M10.30 2.00 L13.70 2.00 L13.80 2.40 L13.80 5.30 L14.30 5.50 L14.30 5.90 L15.50 6.10 L15.60 6.60 L16.70 7.60 L17.30 9.00 L17.44 10.20 L17.20 12.00 L16.50 14.20 L15.60 16.20 L14.90 17.60 L14.90 18.20 L15.10 18.50 L15.00 19.10 L15.90 19.90 L16.40 20.70 L16.30 21.50 L15.60 22.00 L8.40 22.00 L7.70 21.50 L7.60 20.70 L8.10 19.90 L9.00 19.10 L8.90 18.50 L9.10 18.20 L9.10 17.60 L8.40 16.20 L7.50 14.20 L6.80 12.00 L6.56 10.20 L6.70 9.00 L7.30 7.60 L8.40 6.60 L8.50 6.10 L9.70 5.90 L9.70 5.50 L10.20 5.30 L10.20 2.40 Z",
            "M10.20 3.70 L13.80 3.70 M8.40 6.60 L15.60 6.60 M9.10 18.20 L14.90 18.20 M9.00 19.10 L15.00 19.10",
            "M10.60 6.80 L9.95 8.60 L9.70 10.40 L9.85 12.60 L10.35 14.80 L11.00 17.90 M13.40 6.80 L14.05 8.60 L14.30 10.40 L14.15 12.60 L13.65 14.80 L13.00 17.90",
            "M12.00 19.30 L12.00 21.80",
        ],
        x0: 6.56, x1: 17.44, top: 2,
    },
    // Threaded neck, a flask that widens at the waist, and the diamond cut across its face.
    Diamond: {
        paths: [
            "M10.40 2.00 L13.60 2.00 L13.80 2.40 L13.80 5.30 L16.00 5.60 L16.40 5.95 L16.75 14.00 L16.30 20.60 L15.80 21.10 L12.00 22.00 L8.20 21.10 L7.70 20.60 L7.25 14.00 L7.60 5.95 L8.00 5.60 L10.20 5.30 L10.20 2.40 Z",
            "M10.20 3.20 L13.80 3.20 M10.20 4.30 L13.80 4.30",
            "M12.00 5.90 L16.75 14.00 L12.00 21.70 L7.25 14.00 Z M12.00 7.70 L15.65 14.00 L12.00 20.00 L8.35 14.00 Z",
        ],
        x0: 7.25, x1: 16.75, top: 2,
    },
};

/** The outline a family's tile draws: its tile redraw if it has one, otherwise the menus' plain outline. */
export function familyTileOutline(family: string) {
    return TILE_DETAIL[family] ?? familyShapeOutline(family);
}

// The group's frame, on a 100-unit grid: outlines stand on the shelf, the tallest reaching `TALLEST` units,
// the whole group kept within `WIDTH` units across with `GAP` between neighbours.
const SHELF = 78, TALLEST = 56, WIDTH = 86, GAP = 7;

export type FamilyShapePlacement = { x: number; y: number; scale: number };

/** Where each outline sits: one per height (a share of the tallest, 1 = tallest), left to right, on one shelf. */
export function placeFamilyShapes(outline: { x0: number; x1: number; top: number }, heights: number[]): FamilyShapePlacement[] {
    if (!heights.length) return [];
    const w = outline.x1 - outline.x0, h = FAMILY_SHAPE_BASELINE - outline.top;
    const gaps = GAP * (heights.length - 1);
    const sum = heights.reduce((total, share) => total + w * share, 0);
    const k = Math.min(TALLEST / h, (WIDTH - gaps) / sum);
    let left = 50 - (sum * k + gaps) / 2;
    return heights.map(share => {
        const scale = k * share;
        const placement = { x: left - outline.x0 * scale, y: SHELF - FAMILY_SHAPE_BASELINE * scale, scale };
        left += w * scale + GAP;
        return placement;
    });
}

type Props = { family: string; heights: number[]; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, "children">;

/** `strokeWidth` is in units of the 100-unit frame, the same for every outline whatever its size. */
export default function FamilyShapeGroup({ family, heights, strokeWidth = .8, viewBox = "0 12 100 76", ...rest }: Props) {
    const outline = familyTileOutline(family);
    return (
        <svg viewBox={viewBox} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true" focusable="false" {...rest}>
            {placeFamilyShapes(outline, heights).map(({ x, y, scale }, index) => (
                <g key={index} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(4)})`} strokeWidth={strokeWidth / scale}>
                    {outline.paths.map(d => <path key={d} d={d} />)}
                </g>
            ))}
        </svg>
    );
}
