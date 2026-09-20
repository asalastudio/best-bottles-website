/**
 * PDP stage framing — capacity scale + fit-to-canvas for plates and kits.
 *
 * Published Circle 15 ml plates occupy the same ~61% mid-body width as Circle
 * 30 ml on the 1000×1100 canvas (audit 2026-09-20). CAP OFF kit/plate layouts
 * place a full-size bottle plus a detached cap and clip the 10:11 stage.
 *
 * Circle 15 ml hero framing was approved at scale 0.775 vs 30 ml at 1.0
 * (`docs/reviews/circle-family-final-manifest-2026-09-06.json`). Apply that
 * scale at paint time so 15 ml is clearly smaller and both CAP ON and CAP OFF
 * keep safe margins. Kit part bounds, when present, also shrink-to-fit.
 *
 * Baking the scale into pixels still needs a plate republish. Until a Circle
 * glass standard is locked in `data/asset-ledger/bottle-standards.json`:
 *
 *   python3 scripts/paperdoll/family_batch.py --family circle --catalog SNAPSHOT --out BATCH --stage plates
 *   python3 scripts/paperdoll/build_master_kits.py --batch BATCH
 *
 * Target: 15 ml mid-body width materially below 30 ml; fillH ≤ 88%; any
 * margin ≥ 4% on the 10:11 stage.
 */

type PartBounds = { bounds: { left: number; top: number; right: number; bottom: number } };

export const PDP_PLATE_CANVAS = { width: 1000, height: 1100 } as const;
/** Audit gate: fail publish if fillH > 88% or any margin < 4%. */
export const PDP_SAFE_MARGIN_RATIO = 0.04;
export const PDP_MAX_FILL_RATIO = 0.88;

/**
 * Approved Circle 15 ml hero scale (Jordan, 2026-09-06). Other Circle
 * capacities stay at 1 and rely on fit-to-stage when the composition overflows.
 */
const CIRCLE_CAPACITY_SCALE: Record<number, number> = {
    15: 0.775,
};

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
): number {
    if ((family ?? "").trim().toLowerCase() !== "circle") return 1;
    if (capacityMl == null || !Number.isFinite(capacityMl)) return 1;
    return CIRCLE_CAPACITY_SCALE[capacityMl] ?? 1;
}

function unionBounds(parts: readonly PartBounds[]) {
    return {
        left: Math.min(...parts.map((part) => part.bounds.left)),
        right: Math.max(...parts.map((part) => part.bounds.right)),
        top: Math.min(...parts.map((part) => part.bounds.top)),
        bottom: Math.max(...parts.map((part) => part.bounds.bottom)),
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
 */
export function pdpStageFrame(input: {
    family?: string | null;
    capacityMl?: number | null;
    view: Exclude<PdpStageView, "exploded">;
    parts?: readonly PartBounds[] | null;
    width?: number;
    height?: number;
}): PdpStageFrame {
    const width = input.width ?? PDP_PLATE_CANVAS.width;
    const height = input.height ?? PDP_PLATE_CANVAS.height;
    const capacityScale = pdpCapacityScale(input.family, input.capacityMl);
    let scale = capacityScale;
    // Circle 15 ml CAP OFF plates include a beside-cap on an already-large
    // bake. Other families keep scale 1 unless kit bounds overflow.
    if (input.view === "capOff" && capacityScale < 1 && !input.parts?.length) {
        scale = capacityScale * 0.92;
    }

    const canvasBounds = { left: 0, top: 0, right: width, bottom: height };
    if (input.parts?.length) {
        const bounds = unionBounds(input.parts);
        scale = Math.min(scale, fitScale(bounds, width, height));
        if (input.view === "capOff" && capacityScale < 1) {
            scale = Math.min(scale, capacityScale * 0.92);
        }
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
