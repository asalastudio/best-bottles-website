/**
 * Mobile Grace companion: product Q&A can stay in chat for options, but an
 * explicit "take me there" must move the page. A product-link tap or a voice
 * navigation to another PDP hides the drawer and unlocks agentic follow-along.
 * Voice is approved when Grace opens from the mobile PDP.
 *
 * Cap / roller plate swaps stay on the current PDP. Glass color and applicator
 * (roller vs sprayer vs pump) are different product URLs — those are navigation.
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

export function isExplicitStayInChat(value: boolean | string | null | undefined): boolean {
    return value === false || value === "false";
}

export function parseGraceDestination(href: string): { pathname: string; sku: string | null } {
    const [path = "", query = ""] = href.split("?");
    const sku = new URLSearchParams(query).get("sku")?.trim() || null;
    return { pathname: path.split("#")[0] ?? "", sku };
}

export function isDifferentGraceDestination(currentPageUrl: string | undefined, destination: string): boolean {
    const current = parseGraceDestination(currentPageUrl ?? "");
    const next = parseGraceDestination(destination);
    if (!next.pathname) return false;
    if (current.pathname !== next.pathname) return true;
    if (next.sku && current.sku && next.sku !== current.sku) return true;
    return false;
}

export function shouldAutoNavigateFromGraceTool(args: {
    mode: GraceCompanionMode;
    pageType: string | undefined;
    autoNavigate?: boolean | string | null;
    currentPageUrl?: string;
    destination?: string;
}): boolean {
    if (isExplicitStayInChat(args.autoNavigate)) return false;
    if (isExplicitAutoNavigate(args.autoNavigate)) return true;
    if (args.mode === "agentic" || args.mode === "assist") return true;
    if (
        shouldKeepPdpAnswersInChat(args.mode, args.pageType)
        && args.destination
        && isDifferentGraceDestination(args.currentPageUrl, args.destination)
    ) {
        return true;
    }
    return !shouldKeepPdpAnswersInChat(args.mode, args.pageType);
}

/** Product-mode showProducts may leave the PDP only for a different product URL. */
export function shouldAutoNavigateShowProducts(args: {
    mode: GraceCompanionMode;
    pageType: string | undefined;
    currentPageUrl?: string;
    destination: string;
}): boolean {
    if (args.mode === "agentic" || args.mode === "assist") return true;
    return isGraceProductPageHref(args.destination)
        && isDifferentGraceDestination(args.currentPageUrl, args.destination);
}

export function shouldEnterAgenticOnProductLink(args: {
    href: string;
    viewportWidth: number;
}): boolean {
    return isGraceProductPageHref(args.href) && isGraceMobileViewport(args.viewportWidth);
}

export function shouldEnterAgenticOnVoiceNavigation(args: {
    href: string;
    viewportWidth: number;
}): boolean {
    return shouldEnterAgenticOnProductLink(args);
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
