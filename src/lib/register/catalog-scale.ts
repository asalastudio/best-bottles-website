/** Jordan confirmed 2026-10-31: September 25 curve, with approved family exceptions.
 * Sources and all conflicts are recorded in docs/reviews/catalog-scale-2026-10-31.
 * Registration coordinates stay untouched. Both interactive stages use this
 * glass-only span, so a different cap cannot select a different camera.
 */
import targets from './catalog-scale.generated.json';
import readiness from './catalog-scale-readiness.generated.json';
import type { PlateGeometry } from './compose';
import type { PdpGlassSizing, StageBounds } from '@/lib/products/pdp-stage-frame';

type Target = { targetPct: number; baselinePct: number; landmark: string; source: string };
type BodyPart = { bounds: StageBounds; box: { x: number; y: number; width: number; height: number }; image: { url: string } };
export function registeredGlassSizing(bodyId: string, plate: PlateGeometry & { url: string }, body?: BodyPart): PdpGlassSizing | undefined {
    const target = (targets as Record<string, Target>)[bodyId];
    const review = (readiness as Record<string, { status: string }>)[bodyId];
    // Full-body rollout gate. A bad top must not silently shrink every sibling,
    // and a partially checked family must not acquire a clipping regression.
    if (!target || !body || review?.status !== 'ready') return undefined;
    const rim = target.landmark === 'full-glass' || target.landmark === 'full-product'
        || (target.landmark === 'closure-seat' && /-(Ground|Plug|snap|Snap-On)$/.test(bodyId));
    const sourceY = rim ? plate.anchors.seatY : plate.anchors.shoulderY;
    if (sourceY == null || !Number.isFinite(sourceY)) return undefined;
    // The photographed Elegant replacements are registered by shoulder-to-foot bounds.
    const landmarkY = bodyId.startsWith('elegant-') && body.image.url !== plate.url
        ? body.bounds.top : body.box.y + sourceY * body.box.height / plate.height;
    if (!(body.bounds.bottom > landmarkY)) return undefined;
    return { heightPct: target.targetPct, baselinePct: target.baselinePct, landmarkY, source: target.source };
}
