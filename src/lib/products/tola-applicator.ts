import type { StageLayout } from './pdp-redesign/stage';
import { pdpReviewedGlassFrame, pdpStageTransformCss } from './pdp-stage-frame';

/** Exact source exception: one complete Tola, not an interchangeable pour kit. */
export const TOLA6_SKU = 'GB6TPlGl';
export const TOLA6_GRACE_SKU = 'GB-DEC-CLR-6ML-T';
export const TOLA6_ASSEMBLED_IMAGE = 'https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/plates/decorative-6ml-clear-14-3mm/GB6TPlGl/d82ca4bb5b8e3d7a18427ba74d5e39bbdf972fb010cc00f76bb425f9a9ef3bf1.front-on-1000x1100.webp';
export function isTolaApplicator(websiteSku?: string | null): boolean { return websiteSku === TOLA6_SKU; }
export function tolaApplicatorSku(variant: { websiteSku?: string | null; graceSku?: string | null }): string | null {
    return isTolaApplicator(variant.websiteSku) || variant.graceSku === TOLA6_GRACE_SKU ? TOLA6_SKU : null;
}

/** Whole source photograph, with its own physical height and the approved body frame.
 * No independent wand artwork is registered, so it must not be advertised as a kit.
 * Source ink: x 334..704, y 41..1060 on the native 1000 x 1100 plate.
 */
export function tolaAssemblyLayout(): StageLayout {
    const canvas = { width: 1000, height: 1100 };
    const frame = pdpReviewedGlassFrame({ left: 384.58, right: 615.42, top: 536, bottom: 1061 }, 500,
        { heightPct: 34.24, baselinePct: 91, landmarkY: 657.3184215328467 }, 1000, 1100)!;
    const scale = 59 * 10.49 / (1060 - 41);
    const x = 500 - (334 + 704) / 2 * scale, y = 1061 - 1060 * scale;
    return { canvas, frame, frameCss: pdpStageTransformCss(frame),
        parts: [{ key: 'tola6-complete-photo', slot: 'assembly', url: TOLA6_ASSEMBLED_IMAGE,
            dxPct: 0, dyPct: 0, zIndex: 1, blendMode: 'multiply',
            box: { leftPct: x / 10, topPct: y / 11, widthPct: scale * 100, heightPct: scale * 100 } }],
        anchors: {}, baseline: false, baselinePct: 91, grid: false, backdrop: null, floorShadows: [] };
}
