"use client";

/**
 * The one picker shell every mobile configuration property uses. Built on the
 * repository's accessible dialog primitive (@radix-ui/react-dialog, the same
 * one behind ui/sheet): modal focus trap, Escape, body scroll lock, focus
 * restoration. What is specific here is the geometry — the sheet rises from
 * the viewport bottom and stops at the hero's bottom edge, so the product stays
 * visible above it as a live preview while everything else is covered.
 *
 * Dismissal without confirming is a cancel: the caller restores the committed
 * configuration. Tapping the hero does not dismiss — the customer is looking
 * at the preview, not asking to leave it.
 */
import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useEffect, useId, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { X } from "@/components/icons";

const sheetCss = `
@keyframes bb-option-sheet-in{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes bb-option-sheet-out{from{transform:translateY(0)}to{transform:translateY(100%)}}
[data-mobile-option-sheet][data-state="open"]{animation:bb-option-sheet-in 260ms cubic-bezier(.4,0,.2,1)}
[data-mobile-option-sheet][data-state="closed"]{animation:bb-option-sheet-out 200ms cubic-bezier(.4,0,.2,1) forwards}
@media (prefers-reduced-motion: reduce){[data-mobile-option-sheet][data-state="open"],[data-mobile-option-sheet][data-state="closed"]{animation-duration:1ms}}
`;

const SWIPE_DISMISS_PX = 96;

export type ProductOptionSheetProps = {
    open: boolean;
    /** Viewport y (px) where the sheet's top edge sits — the hero's bottom edge. */
    top: number;
    title: string;
    hint?: string;
    confirmLabel: string;
    confirmDisabled?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    /** Called after the sheet has closed so focus can return to the row that opened it. */
    onRestoreFocus: () => void;
    testId?: string;
    children: ReactNode;
};

export default function ProductOptionSheet({
    open, top, title, hint, confirmLabel, confirmDisabled, onConfirm, onCancel, onRestoreFocus, testId, children,
}: ProductOptionSheetProps) {
    const contentRef = useRef<HTMLDivElement>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const drag = useRef<{ startY: number; pointerId: number } | null>(null);
    const hintId = useId();

    const focusInitial = useCallback((event: Event) => {
        event.preventDefault();
        const root = contentRef.current;
        const selected = root?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
            ?? root?.querySelector<HTMLElement>('[role="radio"]');
        (selected ?? headingRef.current)?.focus({ preventScroll: true });
        // Long finish grids scroll horizontally: bring the current choice into view.
        selected?.scrollIntoView({ block: "nearest", inline: "center" });
    }, []);

    const restoreFocus = useCallback((event: Event) => {
        event.preventDefault();
        onRestoreFocus();
    }, [onRestoreFocus]);

    // Swipe down on the header to cancel. The options region keeps its own
    // scrolling, so only the handle/title area is a drag surface.
    const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        drag.current = { startY: event.clientY, pointerId: event.pointerId };
        event.currentTarget.setPointerCapture(event.pointerId);
        if (contentRef.current) contentRef.current.style.transition = "none";
    };
    const onHandlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!drag.current || !contentRef.current) return;
        const dy = Math.max(0, event.clientY - drag.current.startY);
        contentRef.current.style.transform = `translateY(${dy}px)`;
    };
    const endDrag = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
        if (!drag.current) return;
        const dy = Math.max(0, event.clientY - drag.current.startY);
        drag.current = null;
        try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
        const el = contentRef.current;
        if (!el) return;
        if (!cancelled && dy > SWIPE_DISMISS_PX) {
            onCancel();
            return;
        }
        el.style.transition = "transform 180ms cubic-bezier(.4,0,.2,1)";
        el.style.transform = "translateY(0)";
        const clear = () => { el.style.transition = ""; el.style.transform = ""; };
        el.addEventListener("transitionend", clear, { once: true });
        window.setTimeout(clear, 240);
    };

    // If the sheet closes mid-drag (Escape while holding), drop any inline offset.
    useEffect(() => {
        if (open) return;
        drag.current = null;
        const el = contentRef.current;
        if (el) { el.style.transition = ""; el.style.transform = ""; }
    }, [open]);

    return (
        <>
            {/* Outside the portal: Radix wraps each portal child in its own
                Presence, so a style element there would unmount the moment the
                dialog closes and take the exit animation with it. */}
            <style dangerouslySetInnerHTML={{ __html: sheetCss }} />
        <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
            <Dialog.Portal>
                {/* Transparent: the hero above the sheet must stay fully legible. */}
                <Dialog.Overlay className="fixed inset-0 z-[69] bg-transparent" data-testid="mobile-pdp-sheet-overlay" />
                <Dialog.Content
                    ref={contentRef}
                    data-mobile-option-sheet=""
                    data-testid={testId ?? "mobile-pdp-option-sheet"}
                    aria-describedby={hint ? hintId : undefined}
                    onOpenAutoFocus={focusInitial}
                    onCloseAutoFocus={restoreFocus}
                    onEscapeKeyDown={() => onCancel()}
                    onPointerDownOutside={(event) => event.preventDefault()}
                    onInteractOutside={(event) => event.preventDefault()}
                    className="fixed inset-x-0 bottom-0 z-[70] flex flex-col overflow-hidden rounded-t-[10px] border-t border-champagne bg-bone shadow-[0_-8px_32px_rgba(29,29,31,.18)] focus:outline-none"
                    style={{ top: `${Math.max(0, Math.round(top))}px` }}
                >
                    <div
                        className="shrink-0 touch-none select-none px-4 pb-2 pt-2"
                        onPointerDown={onHandlePointerDown}
                        onPointerMove={onHandlePointerMove}
                        onPointerUp={(event) => endDrag(event, false)}
                        onPointerCancel={(event) => endDrag(event, true)}
                    >
                        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-ash/60" aria-hidden />
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <Dialog.Title ref={headingRef} tabIndex={-1} className="font-serif text-xl leading-tight text-obsidian outline-none">
                                    {title}
                                </Dialog.Title>
                                {hint ? (
                                    <Dialog.Description id={hintId} className="mt-1 text-xs text-slate">
                                        {hint}
                                    </Dialog.Description>
                                ) : null}
                            </div>
                            <Dialog.Close asChild>
                                <button
                                    type="button"
                                    aria-label="Cancel and close"
                                    data-testid="mobile-pdp-sheet-close"
                                    className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate transition-colors hover:text-obsidian focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold"
                                >
                                    <X className="h-5 w-5" aria-hidden />
                                </button>
                            </Dialog.Close>
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3 pt-1">
                        {children}
                    </div>

                    <div
                        className="shrink-0 border-t border-champagne/70 bg-bone px-4 pt-2.5"
                        style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom, 0px))" }}
                    >
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={confirmDisabled}
                            data-testid="mobile-pdp-sheet-confirm"
                            className="flex min-h-12 w-full items-center justify-center rounded-[3px] bg-obsidian px-4 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-muted-gold disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold"
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
        </>
    );
}
