type Bounds = { left: number; top: number; right: number; bottom: number };

/** Fit actual registered product bounds, including tall sprayers and bulb hoses.
 * Viewport changes never change a part's proportions or assembly registration. */
export function previewFrame(anchors: { axisX: number; seatY: number; baselineY: number }, bounds: Bounds[],
    { scale = 1, thumbnail = false, expanded = false } = {}) {
    const bodyHeight = anchors.baselineY - anchors.seatY;
    const left = Math.min(...bounds.map(b => b.left));
    const right = Math.max(...bounds.map(b => b.right));
    const top = Math.min(...bounds.map(b => b.top));
    const bottom = Math.max(...bounds.map(b => b.bottom));
    const size = Math.max(right - left, bottom - top);
    if (thumbnail) {
        const edge = size * 1.22;
        return { x: (left + right - edge) / 2, y: (top + bottom - edge) / 2, width: edge, height: edge };
    }
    const pad = size * .06;
    if (expanded) return { x: left - pad, y: top - pad, width: right - left + pad * 2, height: bottom - top + pad * 2 };
    const x = Math.min(anchors.axisX - bodyHeight * .55 / scale, left - pad);
    const y = Math.min(anchors.baselineY - bodyHeight * 1.43 / scale, top - pad);
    return { x, y, width: Math.max(anchors.axisX + bodyHeight * .55 / scale, right + pad) - x,
        height: Math.max(anchors.baselineY + bodyHeight * .10 / scale, bottom + pad) - y };
}
