/**
 * Which of a component's layers a body draws, and what a write may replace. Pure, shared by convex/register.ts
 * (the writers) and convex/registerStage.ts (the approval a stage gates on), and mirrored by
 * src/lib/register/stage-kit.ts layersFor.
 *
 * A layer with `bodyId` belongs to that body only; a layer without it is generic, drawn by every body that has no
 * layers of its own for the component.
 */
type Scoped = { bodyId?: string | null; glass?: string | null };
type Rated = { anchorStatus: "unmeasured" | "measured" | "approved" };

const STATUS_RANK = { unmeasured: 0, measured: 1, approved: 2 } as const;
export const weakest = (statuses: Rated["anchorStatus"][]): Rated["anchorStatus"] =>
    statuses.length === 0 ? "unmeasured" : statuses.reduce((a, b) => (STATUS_RANK[a] <= STATUS_RANK[b] ? a : b));

/** The layers one body draws: its own when it has any, otherwise the generic set. */
export function layersForBody<L extends Scoped>(layers: L[], bodyId: string): L[] {
    const own = layers.filter((layer) => layer.bodyId === bodyId);
    return own.length ? own : layers.filter((layer) => !layer.bodyId);
}

/**
 * The component-wide status: the weakest generic layer. Body-scoped layers are rated per body (see layersForBody),
 * so loading one body never changes what another body may draw. A component with only body layers rates them all.
 */
export function componentLayersStatus<L extends Scoped & Rated>(layers: L[]): Rated["anchorStatus"] {
    const generic = layers.filter((layer) => !layer.bodyId);
    return weakest((generic.length ? generic : layers).map((layer) => layer.anchorStatus));
}

/** One body's layers replaced; the generic set and other bodies' layers kept. */
export function withBodyLayers<L extends Scoped>(existing: L[], bodyId: string, layers: L[]): L[] {
    return [...existing.filter((layer) => layer.bodyId !== bodyId), ...layers];
}

/** The generic set replaced; every body-scoped layer kept (a Phase 3 or component push never erases a body's own layers). */
export function withGenericLayers<L extends Scoped>(existing: L[], layers: L[]): L[] {
    const bodies = new Set(layers.map((layer) => layer.bodyId).filter(Boolean));
    return [...layers, ...existing.filter((layer) => layer.bodyId && !bodies.has(layer.bodyId))];
}
