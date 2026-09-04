/**
 * Mobile PDP chrome: keep the bottle and in-flow toolbar in the visual
 * viewport, not under iOS Safari's overlay URL bar.
 *
 * `env(safe-area-inset-top)` is 0 without `viewport-fit: cover`, and even with
 * it the URL bar can still overlay the layout viewport. `visualViewport.offsetTop`
 * is the extra overlap; CSS `max()` then takes the larger of safe-area, a
 * minimum pad, and that overlay.
 */

export function visualViewportOverlayTop(offsetTop: number | null | undefined): number {
    if (typeof offsetTop !== "number" || !Number.isFinite(offsetTop) || offsetTop < 0) return 0;
    return Math.round(offsetTop);
}

/** Inline `padding-top` for the back/cart row above the plate. */
export function mobilePdpToolbarPaddingTop(overlayOffsetPx: number): string {
    const overlay = visualViewportOverlayTop(overlayOffsetPx);
    return `max(0.75rem, env(safe-area-inset-top, 0px), ${overlay}px)`;
}
