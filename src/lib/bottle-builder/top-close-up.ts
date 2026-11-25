/*
 * A top photographed on its bottle, cropped to the neck: what the Top step's tiles show in Build Your Bottle.
 *
 * The tile draws the same seated layers as the large preview (BuilderImage at the fitment stage) and moves that
 * drawing so a square window around the top fills the tile. The window runs from the top of the mechanism to just
 * under the shoulder, so a 3 ml vial and a 100 ml bottle both show their top at a readable size.
 */
import type { BuilderConfiguration, BuilderPart } from "./model";
import { previewFrame } from "./preview-frame";
import { builderBodyFrame, builderPreviewLayout } from "./preview-layout";

type Box = { left: number; right: number; top: number; bottom: number };
type View = { x: number; y: number; width: number; height: number };

/** The square around a top and the neck it sits on, in the kit's canvas units. */
export function topWindow(body: Box, tops: readonly Box[], axisX: number): View {
    const bodyWidth = body.right - body.left;
    const top = Math.min(body.top, ...tops.map(box => box.top));
    // Just under the shoulder. A dropper's pipette or a tall pump reaches further down; the window does not follow it.
    const bottom = Math.min(body.bottom, body.top + bodyWidth * .55);
    const reach = Math.max(bodyWidth / 2, ...tops.map(box => Math.max(axisX - box.left, box.right - axisX)));
    const size = Math.max((bottom - top) * 1.14, reach * 2 * 1.1);
    return { x: axisX - size / 2, y: (top + bottom - size) / 2, width: size, height: size };
}

/** How to place a drawing of `view` inside a square tile so that `window` fills the tile. */
export function closeUpStyle(view: View, window: View) {
    const percent = (value: number) => `${+(value * 100).toFixed(3)}%`;
    return {
        width: percent(view.width / window.width),
        aspectRatio: `${+view.width.toFixed(2)} / ${+view.height.toFixed(2)}`,
        left: percent((view.x - window.x) / window.width),
        // A percentage here is of the drawing's own height.
        transform: `translateY(${percent((view.y - window.y) / view.height)})`,
    };
}

/**
 * The close-up for one configuration, or null when there is no photographed top to show (no kit, or a kit with
 * the glass only): the caller draws its line illustration instead.
 */
export function topCloseUp(config: BuilderConfiguration | null, parts: BuilderPart[], bodyReference?: BuilderConfiguration,
    frameConfigurations?: readonly BuilderConfiguration[]) {
    if (!config) return null;
    const layout = builderPreviewLayout(config, parts, { stage: "fitment", showCover: false, bodyReference });
    const body = layout?.layers.find(layer => layer.part.slot === "body")?.bounds;
    const tops = layout?.layers.filter(layer => !["body", "diptube", "overcap"].includes(layer.part.slot)).map(layer => layer.bounds) ?? [];
    if (!layout || !body || !tops.length || body.right <= body.left) return null;
    // The same camera BuilderImage uses for these layers, so the tile's drawing and this arithmetic agree.
    const view = layout.glassSizing || frameConfigurations?.length
        ? builderBodyFrame(config, frameConfigurations ?? [], bodyReference, layout)
        : previewFrame(layout.anchors, layout.layers.map(layer => layer.bounds));
    return closeUpStyle(view, topWindow(body, tops, layout.anchors.axisX));
}
