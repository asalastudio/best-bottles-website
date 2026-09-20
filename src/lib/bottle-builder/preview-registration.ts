import type { BuilderConfiguration, BuilderPart } from "./model";

type Bounds = { left: number; top: number; right: number; bottom: number };
export type PreviewLayer = { part: BuilderPart; bounds: Bounds; transform?: string };

const FITTED_SLOTS = new Set(["sprayer", "pump", "overcap"]);
/** Vintage bulb/hose and tassel tops are wider than the glass; leave them. */
const MAX_FITTED_WIDTH_RATIO = 1.25;
/** Shoulder-seated fused ferrules sit in this band below seatY. */
const NECK_ZONE_RATIO = 0.28;
/** seatY is body.bounds.top (soft halo). 8% reaches the first threads so the
 * ferrule covers the lip instead of floating or sitting on the shoulder. */
const SEAT_INSET_RATIO = 0.08;

export function neckSeatY(anchors: { seatY: number; baselineY: number }) {
    const bodyHeight = Math.max(0, anchors.baselineY - anchors.seatY);
    return anchors.seatY + bodyHeight * SEAT_INSET_RATIO;
}

function translateLayer(layer: PreviewLayer, dx: number, dy: number): PreviewLayer {
    if (dx === 0 && dy === 0) return layer;
    return {
        ...layer,
        bounds: {
            left: layer.bounds.left + dx,
            right: layer.bounds.right + dx,
            top: layer.bounds.top + dy,
            bottom: layer.bounds.bottom + dy,
        },
        transform: `translate(${dx} ${dy})${layer.transform ? ` ${layer.transform}` : ""}`,
    };
}

/** Lift a fused sprayer/pump/overcap whose bottom sits on the shoulder so it
 * registers to the neck finish. 9 ml kits already seat the actuator on seatY
 * and keep a separate collar — those are left alone. Display only. */
export function seatPreviewLayers(layers: PreviewLayer[], anchors: { seatY: number; baselineY: number }): PreviewLayer[] {
    const body = layers.find(layer => layer.part.slot === "body");
    if (!body) return layers;
    const bodyWidth = body.bounds.right - body.bounds.left;
    const bodyHeight = Math.max(0, anchors.baselineY - anchors.seatY);
    if (bodyWidth <= 0 || bodyHeight <= 0) return layers;
    const seat = neckSeatY(anchors);
    const neckFloor = anchors.seatY + bodyHeight * NECK_ZONE_RATIO;
    return layers.map(layer => {
        if (!FITTED_SLOTS.has(layer.part.slot)) return layer;
        const width = layer.bounds.right - layer.bounds.left;
        if (width > bodyWidth * MAX_FITTED_WIDTH_RATIO) return layer;
        if (layer.bounds.bottom <= seat || layer.bounds.bottom > neckFloor) return layer;
        return translateLayer(layer, 0, seat - layer.bounds.bottom);
    });
}

/** A finish changes the top, not the glass or the camera. Keep the selected
 * bottle's bare layer and register the exact top assembly uniformly using its
 * photographed body center and baseline. This affects display only.
 * 2026-09-16: every fitment, not only the vintage sprayers — Jordan: swapping a
 * top must not swap the whole image (Boston Round kits). */
export function registerVintagePreview(
    config: BuilderConfiguration,
    parts: BuilderPart[],
    reference?: BuilderConfiguration,
) {
    const referenceKit = reference?.previewKit ?? reference?.kit;
    if (!reference || config.id === reference.id
        || config.bodyId !== reference.bodyId || config.family !== reference.family
        || config.capacityMl !== reference.capacityMl || config.color !== reference.color
        || config.neck !== reference.neck || config.kit?.completeness !== "full"
        || referenceKit?.completeness !== "full") return null;
    const body = parts.find(part => part.slot === "body");
    const fixedBody = referenceKit.parts.find(part => part.slot === "body");
    if (!body || !fixedBody) return null;
    const source = body.bounds;
    const target = fixedBody.bounds;
    const sourceWidth = source.right - source.left;
    const targetWidth = target.right - target.left;
    if (sourceWidth <= 0 || targetWidth <= 0) return null;
    // Neck pixels can be cropped differently beneath each photographed collar.
    // Glass diameter and baseline stay physical landmarks across those crops.
    const scale = targetWidth / sourceWidth;
    const x = (target.left + target.right - (source.left + source.right) * scale) / 2;
    const y = target.bottom - source.bottom * scale;
    return {
        anchors: { ...referenceKit.anchors, axisX: (target.left + target.right) / 2 },
        layers: parts.map(part => part.slot === "body"
            ? { part: fixedBody, bounds: fixedBody.bounds, transform: undefined }
            : { part, bounds: { left: part.bounds.left * scale + x, top: part.bounds.top * scale + y,
                right: part.bounds.right * scale + x, bottom: part.bounds.bottom * scale + y },
                transform: `translate(${x} ${y}) scale(${scale})` }),
    };
}
