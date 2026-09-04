/**
 * Docked Grace sheet geometry. The overlay drawer is unchanged; this module
 * only answers "where does the sheet sit" when a caller passes an anchor
 * into openPanel (the mobile PDP passes the hero).
 *
 * Two detents:
 *   docked   — top edge is the anchor's bottom, so the bottle stays visible
 *   expanded — top edge drops to a peek; used when the keyboard has shrunk
 *              the visual viewport
 *
 * Keyboard detection is a visualViewport vs layout-viewport delta. The
 * drawer remeasures on visualViewport resize/scroll.
 */

export type GraceDockDetent = "docked" | "expanded";

export const GRACE_DOCK_MIN_CHAT_PX = 360;
export const GRACE_DOCK_MIN_DOCKED_CHAT_PX = 200;
export const GRACE_DOCK_MIN_PEEK_PX = 88;
export const GRACE_DOCK_KEYBOARD_PX = 80;

export type GraceDockedSheetLayout = {
    top: number;
    height: number;
    detent: GraceDockDetent;
};

export function graceDockDetentForKeyboard(
    layoutHeight: number,
    visualHeight: number,
    thresholdPx = GRACE_DOCK_KEYBOARD_PX,
): GraceDockDetent {
    if (!(layoutHeight > 0) || !(visualHeight > 0)) return "docked";
    return layoutHeight - visualHeight > thresholdPx ? "expanded" : "docked";
}

export function resolveGraceDockedSheetLayout(args: {
    heroBottom: number;
    viewportHeight: number;
    viewportOffsetTop?: number;
    detent: GraceDockDetent;
    minChatPx?: number;
    minDockedChatPx?: number;
    minPeekPx?: number;
}): GraceDockedSheetLayout {
    const offset = args.viewportOffsetTop ?? 0;
    const viewportHeight = args.viewportHeight;
    const detent = args.detent;
    if (!(viewportHeight > 0)) return { top: 0, height: 0, detent };

    const minPeek = args.minPeekPx ?? GRACE_DOCK_MIN_PEEK_PX;
    const minDockedChat = args.minDockedChatPx ?? GRACE_DOCK_MIN_DOCKED_CHAT_PX;
    const minExpandedChat = args.minChatPx ?? GRACE_DOCK_MIN_CHAT_PX;
    const viewBottom = offset + viewportHeight;
    const peekTop = offset + minPeek;

    const preferred = detent === "expanded"
        ? peekTop
        : Math.max(offset, args.heroBottom);

    const maxTop = viewBottom - (detent === "expanded" ? minExpandedChat : minDockedChat);
    const top = Math.round(Math.max(offset, Math.min(preferred, Math.max(peekTop, maxTop))));
    const height = Math.round(Math.max(0, viewBottom - top));
    return { top, height, detent };
}

export function measureGraceDockedSheet(
    anchor: { getBoundingClientRect: () => { bottom: number } } | null,
    view: { layoutHeight: number; visualHeight: number; visualOffsetTop: number },
): GraceDockedSheetLayout {
    const detent = graceDockDetentForKeyboard(view.layoutHeight, view.visualHeight);
    return resolveGraceDockedSheetLayout({
        heroBottom: anchor?.getBoundingClientRect().bottom ?? view.visualOffsetTop,
        viewportHeight: view.visualHeight,
        viewportOffsetTop: view.visualOffsetTop,
        detent,
    });
}
