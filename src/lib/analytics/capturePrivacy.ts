import { identityCaptureReady } from "./captureIdentity";
import type { CaptureResult, PostHogConfig } from "posthog-js";
import { cartCapturePath, mayRecordSession, publicCapturePath, PUBLIC_CAPTURE_URL_PATTERNS } from "./sessionReplayScope";

// Both the SDK's autocapture class and replay's blockSelector are required.
export const PRIVATE_CAPTURE_SELECTOR = '[data-ph-private], [data-ph-mask], .ph-no-capture, .cl-rootBox, .cl-userButtonPopoverCard, .cl-modalContent, input[type="hidden"], input[type="file"], style, script, canvas, iframe, object, embed, audio, video';

export function mayCaptureNow(): boolean {
    return typeof window !== "undefined" && mayRecordSession(window.location.pathname);
}

/** The purchase funnel. Their payloads carry counts, totals, SKUs and the checkout host only. */
export const CART_EVENTS: ReadonlySet<string> = new Set([
    "Cart Item Added", "Cart Item Removed", "Checkout Started", "Checkout Redirected", "Checkout Failed",
]);

/** True on a reviewed public route, or for a named cart event on the cart page. */
export function mayCaptureEventNow(eventName: string | undefined): boolean {
    if (mayCaptureNow()) return true;
    return typeof window !== "undefined" && eventName !== undefined && CART_EVENTS.has(eventName)
        && cartCapturePath(window.location.pathname) !== null;
}

export function safeCaptureUrl(value: unknown, allowCart = false): string | undefined {
    if (typeof value !== "string") return undefined;
    const path = publicCapturePath(value) ?? (allowCart ? cartCapturePath(value) : null);
    if (!path) return undefined;
    // Preserve the origin for PostHog page grouping; never retain search/hash.
    try { return /^https?:\/\//.test(value) ? `${new URL(value).origin}${path}` : path; }
    catch { return undefined; }
}

// Free text, model outputs and customer identifiers are not CRO dimensions.
const PRIVATE_KEYS = /^(?:\$?name|\$?email|signUpDate|searchTerm|query|suggestedQueries|messageId|orderId|error|reason|\$elements|\$elements_chain|\$element_selectors|\$selected_content|\$exception.*|\$event_target|\$title|\$set|\$set_once|\$initial_.*|utm_.*|\$search_.*)$/i;
const URL_KEYS = /(?:url|href|pathname|destination|referrer)$/i;
export function minimizeProperties(properties: Record<string, unknown>, allowCart = false): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties)) {
        if (PRIVATE_KEYS.test(key)) continue;
        if (URL_KEYS.test(key)) {
            const url = safeCaptureUrl(value, allowCart);
            if (url) result[key] = url;
        } else if (Array.isArray(value)) {
            // No application event schema in this adapter accepts arrays.
            continue;
        } else if (value && typeof value === "object") {
            result[key] = minimizeProperties(value as Record<string, unknown>, allowCart);
        } else result[key] = value;
    }
    return result;
}

export function beforeSendPublicEvent(event: CaptureResult | null): CaptureResult | null {
    if (!event || !identityCaptureReady()) return null;
    // A named cart event on the cart page; everything else there stays private.
    const cartOnly = !mayCaptureNow();
    if (cartOnly && !mayCaptureEventNow(event.event)) return null;
    // Heatmaps buffer across routes and have no subtree exclusion in our pinned SDK.
    if (event.event === "$$heatmap" || event.event === "$dead_click" || event.event === "$exception") return null;
    const allowCart = CART_EVENTS.has(event.event);
    const eventUrl = event.properties?.$current_url;
    if (eventUrl && !safeCaptureUrl(eventUrl, allowCart)) return null;
    // Replay is already masked/blocked before serialization. Do not alter rrweb data.
    if (event.event === "$snapshot") return event;
    return { ...event, properties: minimizeProperties(event.properties, allowCart), $set: undefined, $set_once: undefined };
}

/** Local safety constraints cannot be weakened by init options or remote defaults. */
export const CAPTURE_PRIVACY_CONFIG: Partial<PostHogConfig> = {
    autocapture: {
        url_allowlist: PUBLIC_CAPTURE_URL_PATTERNS,
        css_selector_ignorelist: [PRIVATE_CAPTURE_SELECTOR, ".ph-no-autocapture", "[data-ph-no-autocapture]"],
        element_attribute_ignorelist: ["href", "title", "aria-label", "data-value"],
        capture_copied_text: false,
    },
    mask_all_text: true,
    mask_all_element_attributes: true,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_pageview: false, // Explicit, scoped SPA pageviews below.
    capture_pageleave: false,
    enable_recording_console_log: false,
    capture_performance: false,
    capture_exceptions: false,
    disable_capture_url_hashes: true,
    before_send: beforeSendPublicEvent,
    session_recording: {
        maskAllInputs: true,
        maskTextSelector: "*",
        maskAllElementAttributes: true,
        blockSelector: PRIVATE_CAPTURE_SELECTOR,
        recordCrossOriginIframes: false,
        captureJsonLd: false,
        collectFonts: false,
        inlineStylesheet: false,
        captureCanvas: { recordCanvas: false },
        canvasCapture: { maskRegionsFn: () => null },
        // Also handles replay metadata URLs; drop all network payloads.
        maskCapturedNetworkRequestFn: (request) => {
            if (Object.keys(request).some((key) => key !== "name")) return null;
            const name = safeCaptureUrl(request.name);
            return name ? { ...request, name } : null;
        },
    },
};
