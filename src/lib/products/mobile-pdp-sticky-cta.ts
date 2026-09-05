/**
 * The sticky purchase bar appears as the gap after the final configuration
 * row enters the visible viewport. Geometry follows Safari's visual viewport,
 * including browser chrome changes, rather than a fixed scroll distance.
 */

/** Default bar height: 68 px of content plus its 1 px border. */
export const STICKY_CTA_TRIGGER_OFFSET_PX = 69;

/** Slide + fade duration; the PRD asks for 150–220 ms with no spring. */
export const STICKY_CTA_ANIMATION_MS = 180;

/** Shrink the observed viewport at the bottom to match the exposed-gap trigger. */
export function stickyCtaRootMargin(triggerOffset: number = STICKY_CTA_TRIGGER_OFFSET_PX): string {
    return `0px 0px -${Math.max(0, Math.round(triggerOffset))}px 0px`;
}

export type StickyCtaInput = {
    /** Sentinel top edge relative to the viewport (boundingClientRect.top). */
    sentinelTop: number;
    /** visualViewport.offsetTop + height, in the same coordinates as the sentinel. */
    viewportBottom: number;
    /** A picker sheet or the expanded viewer is open; the bar never competes with those. */
    overlayOpen?: boolean;
    triggerOffset?: number;
};

/** Show as soon as the gap fits the bar, without covering the last component. */
export function stickyCtaVisible({
    sentinelTop,
    viewportBottom,
    overlayOpen = false,
    triggerOffset = STICKY_CTA_TRIGGER_OFFSET_PX,
}: StickyCtaInput): boolean {
    if (overlayOpen) return false;
    if (!Number.isFinite(sentinelTop)) return false;
    if (!Number.isFinite(viewportBottom) || viewportBottom <= 0) return false;
    return sentinelTop <= viewportBottom - triggerOffset;
}

/** Secondary line of the compact bar: "$0.73/ea · 724/case · Qty 12". */
export function stickyCtaFacts({
    priceEach,
    caseQuantity,
    qty,
}: {
    priceEach: number | null | undefined;
    caseQuantity: number | null | undefined;
    qty: number;
}): string {
    const parts: string[] = [];
    parts.push(priceEach == null ? "Price on request" : `$${priceEach.toFixed(2)}/ea`);
    if (caseQuantity && caseQuantity > 1) parts.push(`${caseQuantity.toLocaleString("en-US")}/case`);
    if (qty > 1) parts.push(`Qty ${qty.toLocaleString("en-US")}`);
    return parts.join(" · ");
}
