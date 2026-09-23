/**
 * PDP stage framing — capacity standard + fit-to-canvas for plates and kits.
 *
 * Circle (and the inversion families) lock mid-body width and glass height in
 * `data/asset-ledger/pdp-capacity-standards.json`, the PDP counterpart of
 * Boston Round's hero `bottle-standards.json`. Paint-time scale enforces the
 * lock on published plates until those plates are re-exported.
 *
 * CAP OFF never grows the bottle past the locked glass size. A beside-cap
 * composition may shrink further to keep a 4% margin.
 */

import { REMOVABLE_KIT_SLOTS, detachedCapOffset } from "./kit-frame";

import {
    PDP_CAP_OFF_FIT_SCALE,
    PDP_MAX_FILL_RATIO,
    PDP_SAFE_MARGIN_RATIO,
    PDP_STANDARD_CANVAS,
    pdpPublishedPlateScale,
} from "./pdp-capacity-standards";

type PartBounds = {
    slot?: string;
    bounds: { left: number; top: number; right: number; bottom: number };
    exploded?: { dx: number; dy: number };
};

export const PDP_PLATE_CANVAS = PDP_STANDARD_CANVAS;
export { PDP_SAFE_MARGIN_RATIO, PDP_MAX_FILL_RATIO };

export type PdpStageView = "assembled" | "capOff" | "exploded";

export type PdpStageFrame = {
    scale: number;
    /** percent of the stage box (same contract as explodedKitFrame) */
    x: number;
    y: number;
};

export function pdpCapacityScale(
    family: string | null | undefined,
    capacityMl: number | null | undefined,
    color?: string | null,
): number {
    return pdpPublishedPlateScale(family, capacityMl, color);
}

function unionBounds(parts: readonly PartBounds[]) {
    const body = parts.find(p => p.slot === "body")?.bounds ?? null;
    const boxes = parts.flatMap(part => {
        if (!part.slot || !REMOVABLE_KIT_SLOTS.has(part.slot) || !body) return [part.bounds];
        const offset = detachedCapOffset({ ...part, exploded: part.exploded ?? { dx: 0, dy: 0 } }, body);
        // Reserve both cap states, keeping scale and bottle position unchanged.
        // Other parts' exploded offsets are never painted in the photo view.
        return [part.bounds, {
            left: part.bounds.left + offset.dx, right: part.bounds.right + offset.dx,
            top: part.bounds.top + offset.dy, bottom: part.bounds.bottom + offset.dy,
        }];
    });
    return {
        left: Math.min(...boxes.map(box => box.left)), right: Math.max(...boxes.map(box => box.right)),
        top: Math.min(...boxes.map(box => box.top)), bottom: Math.max(...boxes.map(box => box.bottom)),
    };
}

function fitScale(
    bounds: { left: number; right: number; top: number; bottom: number },
    width: number,
    height: number,
): number {
    const marginX = width * PDP_SAFE_MARGIN_RATIO;
    const marginY = height * PDP_SAFE_MARGIN_RATIO;
    const spanW = Math.max(1, bounds.right - bounds.left);
    const spanH = Math.max(1, bounds.bottom - bounds.top);
    return Math.min(1, (width - 2 * marginX) / spanW, (height - 2 * marginY) / spanH);
}

function centerFrame(
    bounds: { left: number; right: number; top: number; bottom: number },
    scale: number,
    width: number,
    height: number,
): PdpStageFrame {
    const spanW = (bounds.right - bounds.left) * scale;
    const spanH = (bounds.bottom - bounds.top) * scale;
    return {
        scale,
        x: ((width - spanW) / 2 - bounds.left * scale) / width * 100,
        y: ((height - spanH) / 2 - bounds.top * scale) / height * 100,
    };
}

/**
 * Transform that keeps the bottle inside the 10:11 stage.
 * Exploded view is handled separately by `explodedKitFrame`.
 *
 * Scale is min(locked glass size, fit-to-margin). CAP OFF may apply an extra
 * fit factor when the detached cap is baked into a plate (no kit bounds).
 * The bottle never grows past the capacity lock.
 */
export function pdpStageFrame(input: {
    family?: string | null;
    capacityMl?: number | null;
    color?: string | null;
    view: Exclude<PdpStageView, "exploded">;
    parts?: readonly PartBounds[] | null;
    /** Apply the same canvas scale to both members of a cap-on/off plate pair. */
    hasCapOffPlate?: boolean;
    width?: number;
    height?: number;
}): PdpStageFrame {
    const width = input.width ?? PDP_PLATE_CANVAS.width;
    const height = input.height ?? PDP_PLATE_CANVAS.height;
    const capacityScale = pdpCapacityScale(input.family, input.capacityMl, input.color);
    let scale = capacityScale;
    const detachCap = input.view === "capOff";

    if ((detachCap || input.hasCapOffPlate) && !input.parts?.length) {
        // Baked CAP OFF plates include a beside-cap on an already-large bottle.
        // Shrink the composition; never raise the bottle above the glass lock.
        scale = Math.min(scale, capacityScale * PDP_CAP_OFF_FIT_SCALE);
    }

    const canvasBounds = { left: 0, top: 0, right: width, bottom: height };
    if (input.parts?.length) {
        const bounds = unionBounds(input.parts);
        scale = Math.min(scale, fitScale(bounds, width, height));
        return centerFrame(bounds, scale, width, height);
    }

    return centerFrame(canvasBounds, scale, width, height);
}

export function pdpStageTransformCss(frame: PdpStageFrame): string {
    if (frame.scale === 1 && frame.x === 0 && frame.y === 0) return "none";
    return `translate(${frame.x}%, ${frame.y}%) scale(${frame.scale})`;
}

/** Predicted occupancy after framing — used by tests as the CAP OFF clip gate. */
export function framedOccupancyPercent(
    fillRatio: { width: number; height: number },
    frame: PdpStageFrame,
): { midW: number; fillH: number } {
    return {
        midW: fillRatio.width * frame.scale * 100,
        fillH: fillRatio.height * frame.scale * 100,
    };
}
