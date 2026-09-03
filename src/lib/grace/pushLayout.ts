export const GRACE_DESKTOP_DRAWER_WIDTH = "clamp(400px, 30vw, 480px)";
export const GRACE_MINIMUM_CONTENT_WIDTH_PX = 920;

/** Mirrors the drawer's CSS clamp so layout decisions use its resolved pixel width. */
export function resolveGraceDrawerWidth(viewportWidth: number): number {
    return Math.min(480, Math.max(400, viewportWidth * 0.3));
}

export type GraceSurfaceMode = "closed" | "push" | "overlay" | "owned";

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
}) {
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
    } as const;
}

export function gracePushEligiblePathname(pathname: string): boolean {
    return pathname.startsWith("/catalog") || pathname.startsWith("/products/");
}

export function graceConversationDisposition(
    action: "close" | "navigate" | "new-chat",
): "preserve" | "reset" {
    return action === "new-chat" ? "reset" : "preserve";
}
