/**
 * Studio backdrops for the product page stage (Jordan 2026-09-28: "the same beautiful studio background ... the warm,
 * pale gray ... that we've been building v1.3 on"). A body rendered in a Blender studio carries its studio: the wall,
 * the floor and the glass's own contact shadow, rendered through the register camera with the bottle hidden from the
 * camera (outputs/tallcyl-13415-v40-2026-09-28, export_v13.py backdrop + build_backdrops.py). It is drawn under the
 * kit, scaled by the kit's px/mm and pinned so its floor point under the axis sits on the kit's baseline, so what the
 * glass shows through it and the wall around it are the same studio. Bodies without an entry keep the flat canvas.
 */
import manifest from "./stage-backdrops.generated.json";

export type StageBackdrop = {
    url: string;
    width: number;
    height: number;
    pxPerMm: number;
    /** The floor point under the bottle axis, in the image's pixels. */
    axisX: number;
    baselineY: number;
    /** The wall colour, for any stage area the image does not reach. */
    wall: string;
};

export type StageBackdropPlacement = {
    url: string;
    wall: string;
    /** The image's box in percent of the stage canvas (before the frame transform). */
    box: { leftPct: number; topPct: number; widthPct: number; heightPct: number };
};

const BACKDROPS = manifest as Record<string, StageBackdrop>;

export function stageBackdropFor(bodyId: string, glass: string): StageBackdrop | null {
    return BACKDROPS[`${bodyId}|${glass}`] ?? null;
}

/** Where the backdrop sits on a kit's canvas: same px/mm as the kit, its floor point on the kit's baseline under the axis. */
export function placeStageBackdrop(
    backdrop: StageBackdrop,
    kit: { canvas: { width: number; height: number }; anchors: { axisX: number; baselineY: number }; pxPerMm: number },
): StageBackdropPlacement {
    const k = kit.pxPerMm / backdrop.pxPerMm;
    const x = kit.anchors.axisX - backdrop.axisX * k;
    const y = kit.anchors.baselineY - backdrop.baselineY * k;
    return {
        url: backdrop.url,
        wall: backdrop.wall,
        box: {
            leftPct: (x / kit.canvas.width) * 100,
            topPct: (y / kit.canvas.height) * 100,
            widthPct: ((backdrop.width * k) / kit.canvas.width) * 100,
            heightPct: ((backdrop.height * k) / kit.canvas.height) * 100,
        },
    };
}
