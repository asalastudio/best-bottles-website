/**
 * Geometry for the expanded product viewer's pinch-to-zoom. The content is a
 * box the size of its container transformed with `translate(tx, ty) scale(s)`
 * about the origin, so a container point p maps to content point
 * (p - t) / s. Pure so the anchoring and clamping can be unit-tested.
 */
export const PINCH_MIN_SCALE = 1;
export const PINCH_MAX_SCALE = 4;
/** Scale a double-tap jumps to from rest. */
export const DOUBLE_TAP_SCALE = 2.5;

export type ZoomTransform = { scale: number; tx: number; ty: number };
export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

export const IDENTITY_TRANSFORM: ZoomTransform = { scale: 1, tx: 0, ty: 0 };

export function clampScale(scale: number): number {
    if (!Number.isFinite(scale)) return PINCH_MIN_SCALE;
    return Math.min(PINCH_MAX_SCALE, Math.max(PINCH_MIN_SCALE, scale));
}

/** Keep the scaled content covering the container so no empty edge is exposed. */
export function clampTranslate(transform: ZoomTransform, container: Size): ZoomTransform {
    const scale = clampScale(transform.scale);
    if (scale === 1) return { scale: 1, tx: 0, ty: 0 };
    const minX = container.width - container.width * scale;
    const minY = container.height - container.height * scale;
    return {
        scale,
        tx: Math.min(0, Math.max(minX, transform.tx)),
        ty: Math.min(0, Math.max(minY, transform.ty)),
    };
}

/**
 * Zoom to `nextScale` keeping the content under `anchor` (container
 * coordinates) fixed, so a pinch or double-tap grows around the fingers.
 */
export function zoomAround(current: ZoomTransform, nextScale: number, anchor: Point, container: Size): ZoomTransform {
    const scale = clampScale(nextScale);
    const contentX = (anchor.x - current.tx) / current.scale;
    const contentY = (anchor.y - current.ty) / current.scale;
    return clampTranslate({ scale, tx: anchor.x - contentX * scale, ty: anchor.y - contentY * scale }, container);
}

export function panBy(current: ZoomTransform, delta: Point, container: Size): ZoomTransform {
    return clampTranslate({ scale: current.scale, tx: current.tx + delta.x, ty: current.ty + delta.y }, container);
}

export function distance(a: Point, b: Point): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Point, b: Point): Point {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Double-tap toggles between rest and a comfortable inspection zoom. */
export function toggleDoubleTap(current: ZoomTransform, anchor: Point, container: Size): ZoomTransform {
    if (current.scale > 1.05) return { ...IDENTITY_TRANSFORM };
    return zoomAround(current, DOUBLE_TAP_SCALE, anchor, container);
}

export function transformToCss(transform: ZoomTransform): string {
    return `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`;
}
