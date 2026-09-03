export const GRACE_MINIMUM_CONTENT_WIDTH_PX = 920;

/** Mirrors the drawer's CSS clamp so layout decisions use its resolved pixel width. */
export function resolveGraceDrawerWidth(viewportWidth: number): number {
    return Math.min(480, Math.max(400, viewportWidth * 0.3));
}

/** Use the layout viewport consistently; `innerWidth` includes the scrollbar. */
export function resolveGraceViewportWidth({
    innerWidth,
    clientWidth,
}: {
    innerWidth: number;
    clientWidth: number;
}): number {
    return clientWidth > 0 ? clientWidth : innerWidth;
}

export type GraceSurfaceMode = "closed" | "push" | "overlay" | "owned";

export type GraceSurface = {
    mode: GraceSurfaceMode;
    showBackdrop: boolean;
    contentIsInset: boolean;
    availableContentWidth: number;
    drawerWidth: number;
    viewportWidth: number;
};

export function resolveGraceSurface({
    isOpen,
    viewportWidth,
    drawerWidth,
    minimumContentWidth = GRACE_MINIMUM_CONTENT_WIDTH_PX,
    ownsViewport,
    pushEligible = true,
}: {
    isOpen: boolean;
    viewportWidth: number;
    drawerWidth: number;
    minimumContentWidth?: number;
    ownsViewport: boolean;
    pushEligible?: boolean;
}): GraceSurface {
    const availableContentWidth = Math.max(0, viewportWidth - drawerWidth);
    const mode: GraceSurfaceMode = ownsViewport
        ? "owned"
        : !isOpen
            ? "closed"
            : pushEligible && availableContentWidth >= minimumContentWidth
                ? "push"
                : "overlay";

    return {
        mode,
        showBackdrop: mode === "overlay",
        contentIsInset: mode === "push",
        availableContentWidth,
        drawerWidth,
        viewportWidth,
    };
}

export function gracePushEligiblePathname(pathname: string): boolean {
    return pathname.startsWith("/catalog") || pathname.startsWith("/products/");
}

export function graceConversationDisposition(
    action: "close" | "navigate" | "new-chat",
): "preserve" | "reset" {
    return action === "new-chat" ? "reset" : "preserve";
}
