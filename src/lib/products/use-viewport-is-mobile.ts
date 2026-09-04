"use client";

import { useCallback, useSyncExternalStore } from "react";

/** The mobile PDP breakpoint: below this the redesigned PDP renders, at or above it the existing PDP. */
export const MOBILE_PDP_MAX_WIDTH = 767;
export const MOBILE_PDP_MEDIA_QUERY = `(max-width: ${MOBILE_PDP_MAX_WIDTH}px)`;

/** True below the mobile PDP breakpoint; false on the server or where matchMedia is unavailable. */
export function viewportIsMobile(): boolean {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
        && window.matchMedia(MOBILE_PDP_MEDIA_QUERY).matches;
}

/**
 * Hydration-safe viewport flag. The server (and the first client render)
 * report `false`; CSS gates what is visible, this only gates work — queries
 * and asset warming that would be wasted for the tree the customer cannot see.
 */
export function useViewportIsMobile(): boolean {
    const subscribe = useCallback((onChange: () => void) => {
        if (typeof window.matchMedia !== "function") return () => {};
        const media = window.matchMedia(MOBILE_PDP_MEDIA_QUERY);
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, []);
    return useSyncExternalStore(subscribe, viewportIsMobile, () => false);
}
