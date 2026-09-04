"use client";

/**
 * Full-screen expanded product viewer (PRD §4). Opened from the stage's View
 * Larger control; paints the same configured bottle the PDP shows (the plate or
 * the kit stack), with a Cap On | Cap Off segmented control when the
 * configuration has a cap-off asset. The image fits the viewport at rest and
 * supports pinch-to-zoom, drag-to-pan while zoomed, and double-tap.
 *
 * Non-modal on purpose, like the option sheet: the page is never repositioned,
 * so closing lands the customer exactly where they were. `touch-action: none`
 * on the content keeps touches from scrolling the page underneath.
 */
import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { X } from "@/components/icons";
import PaperDollLayers, { type KitPart } from "@/components/products/PaperDollLayers";
import type { MobileViewModeOption, ProductViewMode } from "@/lib/products/mobile-pdp-view-modes";
import {
    IDENTITY_TRANSFORM,
    distance,
    midpoint,
    panBy,
    toggleDoubleTap,
    transformToCss,
    zoomAround,
    type Point,
    type ZoomTransform,
} from "@/lib/products/pinch-zoom-math";

const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 24;
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

type PointerRecord = { x: number; y: number };

function usePinchZoom() {
    const surfaceRef = useRef<HTMLDivElement>(null);
    const [transform, setTransform] = useState<ZoomTransform>(IDENTITY_TRANSFORM);
    // Gesture math reads the latest transform synchronously between renders;
    // `apply` keeps the ref and the state in step.
    const transformRef = useRef<ZoomTransform>(IDENTITY_TRANSFORM);
    const pointers = useRef(new Map<number, PointerRecord>());
    const pinch = useRef<{ startDist: number; startScale: number } | null>(null);
    const lastTap = useRef<{ time: number; point: Point } | null>(null);
    const moved = useRef(false);

    const containerSize = () => {
        const el = surfaceRef.current;
        return { width: el?.clientWidth ?? 1, height: el?.clientHeight ?? 1 };
    };
    const localPoint = (event: { clientX: number; clientY: number }): Point => {
        const rect = surfaceRef.current?.getBoundingClientRect();
        return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
    };
    const apply = (next: ZoomTransform) => {
        transformRef.current = next;
        setTransform(next);
    };

    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        moved.current = false;
        if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            pinch.current = { startDist: Math.max(1, distance(a!, b!)), startScale: transformRef.current.scale };
        }
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const previous = pointers.current.get(event.pointerId);
        if (!previous) return;
        const current = { x: event.clientX, y: event.clientY };
        pointers.current.set(event.pointerId, current);
        if (Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y) > 2) moved.current = true;

        if (pointers.current.size >= 2 && pinch.current) {
            const [a, b] = [...pointers.current.values()];
            const nextScale = pinch.current.startScale * (distance(a!, b!) / pinch.current.startDist);
            const rect = surfaceRef.current?.getBoundingClientRect();
            const mid = midpoint(a!, b!);
            const anchor = { x: mid.x - (rect?.left ?? 0), y: mid.y - (rect?.top ?? 0) };
            apply(zoomAround(transformRef.current, nextScale, anchor, containerSize()));
            return;
        }
        if (pointers.current.size === 1 && transformRef.current.scale > 1) {
            apply(panBy(transformRef.current, { x: current.x - previous.x, y: current.y - previous.y }, containerSize()));
        }
    };

    const endPointer = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
        const wasTracked = pointers.current.delete(event.pointerId);
        try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
        if (pointers.current.size < 2) pinch.current = null;
        if (!wasTracked || cancelled || moved.current || pointers.current.size > 0) return;
        const now = Date.now();
        const point = localPoint(event);
        const last = lastTap.current;
        if (last && now - last.time < DOUBLE_TAP_MS && distance(last.point, point) < DOUBLE_TAP_SLOP_PX) {
            lastTap.current = null;
            apply(toggleDoubleTap(transformRef.current, point, containerSize()));
            return;
        }
        lastTap.current = { time: now, point };
    };

    const reset = useCallback(() => {
        pointers.current.clear();
        pinch.current = null;
        lastTap.current = null;
        apply(IDENTITY_TRANSFORM);
    }, []);

    return {
        surfaceRef,
        transform,
        reset,
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => endPointer(event, false),
            onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => endPointer(event, true),
        },
    };
}

export type MobileProductViewerProps = {
    open: boolean;
    onClose: () => void;
    /** Product/family name shown in the viewer header. */
    title: string;
    eyebrow?: string | null;
    viewMode: ProductViewMode;
    viewModes: MobileViewModeOption[];
    onViewModeChange: (mode: ProductViewMode) => void;
    plateUrl: string | null;
    kitParts: KitPart[] | null;
    fallbackImageUrl: string | null;
    alt: string;
    onPlateError?: (url: string) => void;
    /** Where focus returns after closing — the View Larger control. */
    onRestoreFocus: () => void;
};

export default function MobileProductViewer({
    open, onClose, title, eyebrow, viewMode, viewModes, onViewModeChange, plateUrl, kitParts, fallbackImageUrl, alt, onPlateError, onRestoreFocus,
}: MobileProductViewerProps) {
    const { surfaceRef, transform, reset, handlers } = usePinchZoom();
    const closeRef = useRef<HTMLButtonElement>(null);
    const hintId = useId();
    const hasStack = Boolean(plateUrl || kitParts?.length);
    const zoomed = transform.scale > 1.01;

    // Every open starts at rest, fit to the viewport; so does a cap toggle.
    const changeView = (mode: ProductViewMode) => {
        if (mode === viewMode) return;
        reset();
        onViewModeChange(mode);
    };

    const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (SCROLL_KEYS.has(event.key) && event.target === event.currentTarget) event.preventDefault();
    };

    const surfaceStyle = useMemo(() => ({
        transform: transformToCss(transform),
        transformOrigin: "0 0",
        transition: zoomed ? "none" : "transform 160ms cubic-bezier(.4,0,.2,1)",
    }), [transform, zoomed]);

    return (
        <Dialog.Root open={open} modal={false} onOpenChange={(next) => { if (!next) onClose(); }}>
            <Dialog.Portal>
                <Dialog.Content
                    data-testid="mobile-pdp-viewer"
                    data-zoomed={zoomed ? "" : undefined}
                    aria-modal="true"
                    aria-describedby={hintId}
                    onKeyDown={onKeyDown}
                    onOpenAutoFocus={(event) => { event.preventDefault(); reset(); closeRef.current?.focus({ preventScroll: true }); }}
                    onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus(); }}
                    onEscapeKeyDown={() => onClose()}
                    onPointerDownOutside={(event) => event.preventDefault()}
                    onInteractOutside={(event) => event.preventDefault()}
                    className="fixed inset-0 z-[80] flex touch-none flex-col bg-white text-obsidian focus:outline-none"
                    style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
                >
                    <header className="flex shrink-0 items-start justify-between gap-3 px-3 pb-2 pt-2">
                        <div className="min-w-0 pl-1 pt-2">
                            {eyebrow ? <p className="truncate text-2xs font-semibold uppercase tracking-label text-muted-gold">{eyebrow}</p> : null}
                            <Dialog.Title className="truncate font-serif text-lg leading-tight text-obsidian">{title}</Dialog.Title>
                        </div>
                        <Dialog.Close asChild>
                            <button
                                ref={closeRef}
                                type="button"
                                aria-label="Close expanded view"
                                data-testid="mobile-pdp-viewer-close"
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bone text-obsidian transition-colors hover:bg-linen focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold"
                            >
                                <X className="h-5 w-5" aria-hidden />
                            </button>
                        </Dialog.Close>
                    </header>

                    {viewModes.length > 1 ? (
                        <div
                            role="radiogroup"
                            aria-label="Cap state"
                            data-testid="mobile-pdp-viewer-cap-toggle"
                            className="mx-auto mt-1 grid shrink-0 auto-cols-fr grid-flow-col rounded-full border border-champagne bg-bone p-1"
                        >
                            {viewModes.map((mode) => {
                                const selected = mode.id === viewMode;
                                return (
                                    <button
                                        key={mode.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        onClick={() => changeView(mode.id)}
                                        data-testid={`mobile-pdp-viewer-${mode.id}`}
                                        className={`min-h-10 min-w-[6.5rem] rounded-full px-4 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold ${
                                            selected ? "bg-obsidian text-white" : "text-slate hover:text-obsidian"
                                        }`}
                                    >
                                        {mode.label}
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}

                    <div
                        ref={surfaceRef}
                        data-testid="mobile-pdp-viewer-surface"
                        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
                        {...handlers}
                    >
                        <div className="absolute inset-0 will-change-transform" style={surfaceStyle}>
                            {hasStack ? (
                                <PaperDollLayers plateUrl={plateUrl} kitParts={kitParts} alt={alt} onPlateError={onPlateError} className="[&_img]:pointer-events-none" />
                            ) : fallbackImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={fallbackImageUrl} alt={alt} draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-contain object-center" />
                            ) : (
                                <div className="absolute inset-0 bg-linen" aria-hidden />
                            )}
                        </div>
                    </div>

                    <Dialog.Description id={hintId} className="shrink-0 px-4 pb-3 pt-2 text-center text-2xs text-slate">
                        {zoomed ? "Drag to pan · double-tap to reset" : "Pinch or double-tap to zoom"}
                    </Dialog.Description>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
