import { partBoxTransform, type PartBox } from "@/lib/register/stage-kit";

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
        // Scale < 1 adds padding so a 5 ml tile stays smaller than 100 ml.
        // Scale > 1 is ignored: the bottle already fills the square, and a CSS
        // zoom from the baseline clipped the neck on 50/100 ml Cylinder.
        const fit = Math.min(1, Math.max(0.2, scale));
        const edge = size * 1.22 / fit;
        return { x: (left + right - edge) / 2, y: (top + bottom - edge) / 2, width: edge, height: edge };
    }
    const pad = size * .06;
    if (expanded) {
        const contentLeft = left - pad;
        const contentRight = right + pad;
        const half = Math.max(anchors.axisX - contentLeft, contentRight - anchors.axisX);
        return { x: anchors.axisX - half, y: top - pad, width: half * 2, height: bottom - top + pad * 2 };
    }
    const x = Math.min(anchors.axisX - bodyHeight * .55 / scale, left - pad);
    const y = Math.min(anchors.baselineY - bodyHeight * 1.43 / scale, top - pad);
    return { x, y, width: Math.max(anchors.axisX + bodyHeight * .55 / scale, right + pad) - x,
        height: Math.max(anchors.baselineY + bodyHeight * .10 / scale, bottom + pad) - y };
}

type BoxedPart = { image: { width: number; height: number }; box?: PartBox | null };

/** The SVG transform that draws one layer: its registration (if any) applied
 * to the canvas, after a register part's own placement in its box. A full-canvas
 * kit layer has no box and keeps its registration transform alone. */
export function layerTransform(transform: string | undefined, part: BoxedPart): string | undefined {
    const box = partBoxTransform(part);
    if (!box) return transform;
    return transform ? `${transform} ${box}` : box;
}

/** `layerCropStyle` for a part: a register part's image is its box on the
 * canvas, a kit layer's image is the whole canvas. */
export function layerCropStyleForPart(part: BoxedPart, frame: { x: number; y: number; width: number; height: number }) {
    if (!part.box) return layerCropStyle(part.image, frame);
    if (!(frame.width > 0 && frame.height > 0 && part.box.width > 0 && part.box.height > 0)) {
        return { position: "absolute" as const, inset: 0, width: "100%", height: "100%", objectFit: "contain" as const };
    }
    return {
        position: "absolute" as const,
        left: `${((part.box.x - frame.x) / frame.width) * 100}%`,
        top: `${((part.box.y - frame.y) / frame.height) * 100}%`,
        width: `${(part.box.width / frame.width) * 100}%`,
        height: `${(part.box.height / frame.height) * 100}%`,
        maxWidth: "none",
        maxHeight: "none",
    };
}

/** CSS crop that matches an SVG viewBox over a registered full-canvas layer.
 * Chooser tiles use this so a real <img> can fetch with preload/priority. */
export function layerCropStyle(image: { width: number; height: number }, frame: { x: number; y: number; width: number; height: number }) {
    if (!(frame.width > 0 && frame.height > 0 && image.width > 0 && image.height > 0)) {
        return { position: "absolute" as const, inset: 0, width: "100%", height: "100%", objectFit: "contain" as const };
    }
    return {
        position: "absolute" as const,
        left: `${(-frame.x / frame.width) * 100}%`,
        top: `${(-frame.y / frame.height) * 100}%`,
        width: `${(image.width / frame.width) * 100}%`,
        height: `${(image.height / frame.height) * 100}%`,
        maxWidth: "none",
        maxHeight: "none",
    };
}
