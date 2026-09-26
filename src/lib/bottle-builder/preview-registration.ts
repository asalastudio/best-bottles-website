import type { BuilderConfiguration, BuilderPart } from "./model";
import canonicalBodies from "./canonical-bodies.generated.json";

type CanonicalBody = { part: Pick<BuilderPart, "slot" | "zOrder" | "bounds"> & { image: { url: string; width: number; height: number; sha256: string } };
    anchors: { axisX: number; seatY: number; baselineY: number }; groundY: number };

/** One fixed bare-glass body for a physical bottle, when one has been made. Every Empire master
 * photographs the glass with the orifice reducer in its neck, so every kit body shows a plug in
 * an "empty" bottle; Jordan's retouched glass (2026-09-20) replaces it for the 100 ml. It stands
 * exactly where the builder's reference body stood, so fitments register as they did. Display only. */
export function canonicalBody(config: Pick<BuilderConfiguration, "family" | "capacityMl" | "color" | "neck">): CanonicalBody | null {
    return (canonicalBodies as Record<string, CanonicalBody>)[`${config.family}|${config.capacityMl}|${config.color}|${config.neck}`] ?? null;
}

type Bounds = { left: number; top: number; right: number; bottom: number };
export type PreviewLayer = { part: BuilderPart; bounds: Bounds; transform?: string };

/** A replacement bare body includes neck pixels hidden in the source photo.
 * Paint that glass before external hardware. Preserve other relative orders:
 * old kits can contain a combined pump in a generically named diptube layer.
 */
function orderRegisteredLayers(layers: PreviewLayer[]): PreviewLayer[] {
    const hardware = new Set(["sprayer", "pump", "cap", "overcap", "collar", "bulb", "tassel", "roller", "fitment", "reducer"]);
    const bodyIndex = layers.findIndex(layer => layer.part.slot === "body");
    const hardwareIndex = layers.findIndex(layer => hardware.has(layer.part.slot));
    if (bodyIndex < 0 || hardwareIndex < 0 || bodyIndex < hardwareIndex) return layers;
    const reordered = [...layers];
    const [body] = reordered.splice(bodyIndex, 1);
    reordered.splice(hardwareIndex, 0, body);
    return reordered;
}

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
        // Native PSD layers already record the seated assembly. Their ferrule
        // deliberately overlaps the glass neck. Lifting its bottom toward an
        // estimated lip exposes threads and makes the pump float (25 ml).
        if (layer.part.derivation === "psd-layer") return layer;
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
    const canonical = canonicalBody(config);
    if (canonical) {
        const own = parts.find(part => part.slot === "body");
        if (!own || (config.kit ?? config.previewKit ?? config.chooserKit)?.completeness !== "full") return null;
        const fixed = canonical.part as BuilderPart;
        const width = own.bounds.right - own.bounds.left;
        if (width <= 0) return null;
        const scale = (fixed.bounds.right - fixed.bounds.left) / width;
        const x = (fixed.bounds.left + fixed.bounds.right - (own.bounds.left + own.bounds.right) * scale) / 2;
        const y = fixed.bounds.bottom - own.bounds.bottom * scale;
        return {
            anchors: { ...canonical.anchors, axisX: (fixed.bounds.left + fixed.bounds.right) / 2 },
            groundY: canonical.groundY,                      // measured on the glass itself
            layers: orderRegisteredLayers(parts.map(part => part.slot === "body"
                ? { part: fixed, bounds: fixed.bounds, transform: undefined }
                : { part, bounds: { left: part.bounds.left * scale + x, top: part.bounds.top * scale + y,
                    right: part.bounds.right * scale + x, bottom: part.bounds.bottom * scale + y },
                    transform: `translate(${x} ${y}) scale(${scale})` })),
        };
    }
    const referenceKit = reference?.previewKit ?? reference?.kit;
    // A register kit already stands on its body's datum; never re-register it to a
    // published kit's photographed body, nor a published kit to a register plate.
    if (config.kit && referenceKit && Boolean(config.kit.register) !== Boolean(referenceKit.register)) return null;
    if (!reference || config.id === reference.id
        || config.bodyId !== reference.bodyId || config.family !== reference.family
        || config.capacityMl !== reference.capacityMl || config.color !== reference.color
        || config.neck !== reference.neck || !config.kit
        || !referenceKit) return null;
    const body = parts.find(part => part.slot === "body");
    const fixedBody = referenceKit.parts.find(part => part.slot === "body");
    if (!body || !fixedBody) return null;
    const source = body.bounds;
    const target = fixedBody.bounds;
    const sourceWidth = source.right - source.left;
    const targetWidth = target.right - target.left;
    if (sourceWidth <= 0 || targetWidth <= 0) return null;
    // Cap-split kits keep their photographed glass and receive only the same
    // uniform transform as the hardware. Never replace a partial body with a
    // bare layer that could expose pixels its source closure covered.
    // Neck pixels can be cropped differently beneath each photographed collar.
    // Glass diameter and baseline stay physical landmarks across those crops.
    const scale = targetWidth / sourceWidth;
    const x = (target.left + target.right - (source.left + source.right) * scale) / 2;
    const y = target.bottom - source.bottom * scale;
    return {
        anchors: { ...referenceKit.anchors, axisX: (target.left + target.right) / 2 },
        // Where the glass stands, read from the SELECTED kit and carried through the
        // same registration as its parts. The reference kit's own baselineY is not
        // trustworthy for this: the 2026-09-16 Empire kits all record 979 while their
        // glass ends at 1060, which stood a sidecar overcap 80 px above the ground.
        groundY: config.kit.anchors.baselineY * scale + y,
        layers: orderRegisteredLayers(parts.map(part => part.slot === "body" && config.kit!.completeness === "full" && referenceKit.completeness === "full"
            ? { part: fixedBody, bounds: fixedBody.bounds, transform: undefined }
            : { part, bounds: { left: part.bounds.left * scale + x, top: part.bounds.top * scale + y,
                right: part.bounds.right * scale + x, bottom: part.bounds.bottom * scale + y },
                transform: `translate(${x} ${y}) scale(${scale})` })),
    };
}
