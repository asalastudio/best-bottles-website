import type { StageLayout } from './pdp-redesign/stage';
import { pdpReviewedGlassFrame, pdpStageTransformCss } from './pdp-stage-frame';

/** Exact source exception: one complete Tola, not an interchangeable pour kit. */
export const TOLA6_SKU = 'GB6TPlGl';
export const TOLA6_GRACE_SKU = 'GB-DEC-CLR-6ML-T';
const TOLA_ASSEMBLIES = new Map([
    ['GB3TPlGl', { ml: 3, cappedHeight: 53, finish: 'Gold', bead: 'red' }],
    [TOLA6_SKU, { ml: 6, cappedHeight: 59, finish: 'Gold', bead: 'red' }],
    ['GB12TPlGl', { ml: 12, cappedHeight: 77.3, finish: 'Gold', bead: 'red' }],
    ['GB12TPlSl', { ml: 12, cappedHeight: 77.3, finish: 'Silver', bead: 'blue' }],
]);

export function tolaAssembly(websiteSku?: string | null) {
    const sku = websiteSku ?? '';
    const assembly = TOLA_ASSEMBLIES.get(sku);
    return assembly ? { ...assembly, sku, url: `/images/catalog/tola-psd/${sku}.webp` } : null;
}

export function isTolaApplicator(websiteSku?: string | null): boolean {
    return tolaAssembly(websiteSku) !== null;
}

export function tolaApplicatorSku(variant: { websiteSku?: string | null; graceSku?: string | null }): string | null {
    return tolaAssembly(variant.websiteSku)?.sku ?? (variant.graceSku === TOLA6_GRACE_SKU ? TOLA6_SKU : null);
}

// The capped PSD exports share a 1000 × 1100 canvas and 1019 px of
// centered artwork ending at y=1060. Use one physical scale for the set.
export function tolaAssemblyLayout(sku: string = TOLA6_SKU): StageLayout {
    const assembly = tolaAssembly(sku)!;
    const canvas = { width: 1000, height: 1100 };
    const frame = pdpReviewedGlassFrame({ left: 384.58, right: 615.42, top: 536, bottom: 1061 }, 500,
        { heightPct: 34.24, baselinePct: 91, landmarkY: 657.3184215328467 }, 1000, 1100)!;
    const scale = assembly.cappedHeight * 10.49 / (1060 - 41);
    const x = 500 - 500 * scale, y = 1061 - 1060 * scale;
    return { canvas, frame, frameCss: pdpStageTransformCss(frame),
        parts: [{ key: assembly.sku, slot: 'assembly', url: assembly.url,
            dxPct: 0, dyPct: 0, zIndex: 1, blendMode: 'multiply',
            box: { leftPct: x / 10, topPct: y / 11, widthPct: scale * 100, heightPct: scale * 100 } }],
        anchors: {}, baseline: false, baselinePct: 91, grid: false, backdrop: null, floorShadows: [] };
}
