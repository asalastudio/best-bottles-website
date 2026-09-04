/**
 * Mobile Grace companion: product Q&A stays in chat until the customer taps
 * a product she surfaced. That tap hides the drawer, opens the PDP, and
 * unlocks agentic site navigation. Voice is approved when Grace opens.
 *
 * Grace cannot drive the live PDP pickers (cap, roller, glass). Those commits
 * stay on the page. A same-slug `?sku=` navigation is how a different
 * configuration reaches the customer — the same path the picker already uses.
 */

export type GraceCompanionMode = "assist" | "product" | "agentic";

export type GraceOpenPanelOptions = {
    source?: "pdp" | "site";
    enableVoice?: boolean;
};

export const GRACE_MOBILE_VIEWPORT_MAX_PX = 767;

/** Spoken and shown after they tap a product she surfaced. */
export const GRACE_AGENTIC_HANDOFF_MESSAGE =
    "I can move you around the site now if you'd like — another bottle, a cap, or the catalog.";

export function isGraceMobileViewport(viewportWidth: number): boolean {
    return viewportWidth > 0 && viewportWidth <= GRACE_MOBILE_VIEWPORT_MAX_PX;
}

export function isGraceProductPageHref(href: string): boolean {
    const path = href.split("?")[0]?.split("#")[0] ?? "";
    return path.startsWith("/products/") && path.length > "/products/".length;
}

export function resolveCompanionModeOnOpen(
    current: GraceCompanionMode,
    source: GraceOpenPanelOptions["source"],
): GraceCompanionMode {
    if (current === "agentic") return "agentic";
    return source === "pdp" ? "product" : current;
}

export function shouldKeepPdpAnswersInChat(
    mode: GraceCompanionMode,
    pageType: string | undefined,
): boolean {
    return mode === "product" && pageType === "pdp";
}

export function isExplicitAutoNavigate(value: boolean | string | null | undefined): boolean {
    return value === true || value === "true";
}

export function shouldAutoNavigateFromGraceTool(args: {
    mode: GraceCompanionMode;
    pageType: string | undefined;
    autoNavigate?: boolean | string | null;
}): boolean {
    if (isExplicitAutoNavigate(args.autoNavigate)) return true;
    if (shouldKeepPdpAnswersInChat(args.mode, args.pageType)) return false;
    return true;
}

export function shouldEnterAgenticOnProductLink(args: {
    href: string;
    viewportWidth: number;
}): boolean {
    return isGraceProductPageHref(args.href) && isGraceMobileViewport(args.viewportWidth);
}

/** Agentic Grace stays listening; the overlay hides so the destination is visible. */
export function agenticHandoffHidesChat(): boolean {
    return true;
}

/**
 * The mobile PDP pickers (cap finish, roller, glass) are page-owned.
 * Grace has no tool that confirms a picker or patches that React state.
 * She can talk about fit, show compatible components in chat, or navigate
 * to a verified `?sku=` / sibling URL — she cannot swap a cap in place.
 */
export function graceCanMutatePdpPickers(): false {
    return false;
}
