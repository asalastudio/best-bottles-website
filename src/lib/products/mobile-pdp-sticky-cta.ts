/**
 * Sticky Add to Cart trigger for the mobile PDP (PRD §6–7). A zero-height
 * sentinel sits immediately after the final configurator row and an
 * IntersectionObserver watches it. Every decision here is relative to that
 * element, never to a document scroll coordinate, so the bar appears the
 * moment the last row starts to slide under the top edge and leaves again the
 * moment the configurator is back in view. Pure so it can be unit-tested.
 */

/**
 * How far (px) the sentinel must be above the viewport top before the bar
 * shows. The last configurator row is ~72px tall, so at 64px the row has just
 * begun leaving; the 8px slack stops the bar flickering on scroll jitter.
 */
export const STICKY_CTA_TRIGGER_OFFSET_PX = 64;

/** Slide + fade duration; the PRD asks for 150–220 ms with no spring. */
export const STICKY_CTA_ANIMATION_MS = 180;

/** rootMargin that shrinks the observed viewport by the trigger offset at the top. */
export function stickyCtaRootMargin(triggerOffset: number = STICKY_CTA_TRIGGER_OFFSET_PX): string {
    return `-${Math.max(0, Math.round(triggerOffset))}px 0px 0px 0px`;
}

export type StickyCtaInput = {
    /** Sentinel top edge relative to the viewport (boundingClientRect.top). */
    sentinelTop: number;
    /** A picker sheet or the expanded viewer is open; the bar never competes with those. */
    overlayOpen?: boolean;
    triggerOffset?: number;
};

/**
 * Show only once the sentinel has passed the trigger band. Short pages never
 * bypass this element-relative trigger because the purchase block carries its
 * own inline Add to Cart action.
 */
export function stickyCtaVisible({
    sentinelTop,
    overlayOpen = false,
    triggerOffset = STICKY_CTA_TRIGGER_OFFSET_PX,
}: StickyCtaInput): boolean {
    if (overlayOpen) return false;
    if (!Number.isFinite(sentinelTop)) return false;
    return sentinelTop <= triggerOffset;
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
