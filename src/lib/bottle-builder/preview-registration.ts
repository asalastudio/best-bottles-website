import type { BuilderConfiguration, BuilderPart } from "./model";

/** A vintage finish changes the top, not the glass or the camera. Keep the
 * selected bottle's bare layer and register the exact top assembly uniformly
 * using its photographed body center and baseline. This affects display only. */
export function registerVintagePreview(
    config: BuilderConfiguration,
    parts: BuilderPart[],
    reference?: BuilderConfiguration,
) {
    const referenceKit = reference?.previewKit ?? reference?.kit;
    if (!reference || !/Vintage|Antique/.test(config.fitment)
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
            ? { part: fixedBody, transform: undefined }
            : { part, transform: `translate(${x} ${y}) scale(${scale})` }),
    };
}
