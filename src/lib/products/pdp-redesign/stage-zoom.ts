/**
 * The canvas magnifier (Jordan 2026-09-29: "add a magnifying glass or a
 * zoom-in feature on the actual canvas"). The whole stage (studio, glass and
 * every closure layer) scales as one, so the parts stay in register; the point
 * under the pointer stays under the pointer, so moving it pans.
 */

/** How far the canvas magnifies. The register layers are drawn from 25 px/mm masters, sharp well past this. */
export const STAGE_ZOOM = 2.5;

/** A pointer that travels further than this between press and release was panning, not tapping. */
export const STAGE_ZOOM_TAP_SLOP_PX = 6;

export type ZoomOrigin = { xPct: number; yPct: number };

type Box = { left: number; top: number; width: number; height: number };

/** The pointer's place in the stage box as a transform origin, in percent, kept inside the box. */
export function zoomOriginAt(clientX: number, clientY: number, box: Box): ZoomOrigin {
    const clamp = (value: number) => Math.min(100, Math.max(0, value));
    return {
        xPct: box.width > 0 ? clamp(((clientX - box.left) / box.width) * 100) : 50,
        yPct: box.height > 0 ? clamp(((clientY - box.top) / box.height) * 100) : 50,
    };
}

/** Where the magnifier button zooms to when there is no pointer: the middle, a little high, where the neck and closure sit. */
export const DEFAULT_ZOOM_ORIGIN: ZoomOrigin = { xPct: 50, yPct: 42 };
