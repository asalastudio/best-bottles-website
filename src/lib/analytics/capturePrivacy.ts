import type { CaptureResult, PostHogConfig } from "posthog-js";
import { mayRecordSession, publicCapturePath, PUBLIC_CAPTURE_URL_PATTERNS } from "./sessionReplayScope";

// Both the SDK's autocapture class and replay's blockSelector are required.
export const PRIVATE_CAPTURE_SELECTOR = '[data-ph-private], [data-ph-mask], .ph-no-capture, .cl-rootBox, .cl-userButtonPopoverCard, .cl-modalContent, input[type="hidden"], input[type="file"]';

export function mayCaptureNow(): boolean {
    return typeof window !== "undefined" && mayRecordSession(window.location.pathname);
}

export function safeCaptureUrl(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const path = publicCapturePath(value);
    if (!path) return undefined;
    // Preserve the origin for PostHog page grouping; never retain search/hash.
    try { return /^https?:\/\//.test(value) ? `${new URL(value).origin}${path}` : path; }
    catch { return undefined; }
}

// Free text, model outputs and customer identifiers are not CRO dimensions.
const PRIVATE_KEYS = /^(?:\$?name|\$?email|signUpDate|searchTerm|query|suggestedQueries|messageId|orderId|error|reason|\$elements|\$elements_chain|\$element_selectors|\$selected_content|\$event_target|\$title|\$set|\$set_once|\$initial_.*|utm_.*|\$search_.*)$/i;
const URL_KEYS = /(?:url|href|pathname|destination|referrer)$/i;
export function minimizeProperties(properties: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties)) {
        if (PRIVATE_KEYS.test(key)) continue;
        if (URL_KEYS.test(key)) {
            const url = safeCaptureUrl(value);
            if (url) result[key] = url;
        } else if (value && typeof value === "object" && !Array.isArray(value)) {
            result[key] = minimizeProperties(value as Record<string, unknown>);
        } else result[key] = value;
    }
    return result;
}

export function beforeSendPublicEvent(event: CaptureResult | null): CaptureResult | null {
    if (!event || !mayCaptureNow()) return null;
    // Heatmaps buffer across routes and have no subtree exclusion in our pinned SDK.
    if (event.event === "$$heatmap" || event.event === "$dead_click") return null;
    const eventUrl = event.properties?.$current_url;
    if (eventUrl && !safeCaptureUrl(eventUrl)) return null;
    // Replay is already masked/blocked before serialization. Do not alter rrweb data.
    if (event.event === "$snapshot") return event;
    return { ...event, properties: minimizeProperties(event.properties), $set: undefined, $set_once: undefined };
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
    disable_capture_url_hashes: true,
    before_send: beforeSendPublicEvent,
    session_recording: {
        maskAllInputs: true,
        maskTextSelector: "*",
        maskAllElementAttributes: true,
        blockSelector: PRIVATE_CAPTURE_SELECTOR,
        recordCrossOriginIframes: false,
        captureJsonLd: false,
        // Also handles replay metadata URLs; drop all network payloads.
        maskCapturedNetworkRequestFn: (request) => {
            if (Object.keys(request).some((key) => key !== "name")) return null;
            const name = safeCaptureUrl(request.name);
            return name ? { ...request, name } : null;
        },
    },
};
