"use client";
import { useEffect, useRef, type PointerEvent } from "react";

// Long enough that a pointer crossing the grid does not prefetch every tile it
// passes over; short against the half second or more a hover lasts before a click.
const HOVER_DWELL_MS = 80;

/** Handlers that call `onIntent` when a tile is about to be picked: a mouse
 * hover that settles, keyboard focus, or a press (touch has no hover; a press
 * still starts ~100 ms before the click lands). */
export function useTileIntent(onIntent?: () => void) {
    const timer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(timer.current), []);
    if (!onIntent) return {};
    return {
        onPointerEnter: (event: PointerEvent) => {
            if (event.pointerType !== "mouse") return;
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(onIntent, HOVER_DWELL_MS);
        },
        onPointerLeave: () => window.clearTimeout(timer.current),
        onPointerDown: onIntent,
        onFocus: onIntent,
    };
}
