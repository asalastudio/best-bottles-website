export const GRACE_DESKTOP_DRAWER_WIDTH = "clamp(400px, 30vw, 480px)";
export const GRACE_PUSH_BREAKPOINT_PX = 1100;

export type GraceSurfaceMode = "closed" | "push" | "overlay" | "owned";

export function resolveGraceSurface({
    isOpen,
    viewportWidth,
    ownsViewport,
    pushEligible = true,
}: {
    isOpen: boolean;
    viewportWidth: number;
    ownsViewport: boolean;
    pushEligible?: boolean;
}) {
    const mode: GraceSurfaceMode = ownsViewport
        ? "owned"
        : !isOpen
            ? "closed"
            : pushEligible && viewportWidth >= GRACE_PUSH_BREAKPOINT_PX
                ? "push"
                : "overlay";

    return {
        mode,
        showBackdrop: mode === "overlay",
        contentIsInset: mode === "push",
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
