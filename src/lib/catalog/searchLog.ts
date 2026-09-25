/**
 * Storefront search-box log: what shoppers type, how many products came back,
 * and which "closest match" suggestions were offered or tapped.
 *
 * The browser sends events to `/api/catalog/search-log`; the route scrubs the
 * query with `scrubSearchQuery` and forwards it to `convex/catalogSearchLog.ts`.
 * No user, session or IP is stored with the counters.
 */

export const SEARCH_LOG_MAX_QUERY_LENGTH = 120;

export type CatalogSearchLogEvent =
    | { kind: "search"; resultCount: number }
    | { kind: "suggestions_shown"; labels: string[] }
    | { kind: "suggestion_click"; label: string };

export type CatalogSearchLogPayload = {
    query: string;
    locale: string;
    event: CatalogSearchLogEvent;
};

/**
 * Lowercases and trims the query, replaces anything that looks like an email
 * address or a phone/account number, and caps the length. Returns "" when
 * nothing searchable is left.
 */
export function scrubSearchQuery(query: string): string {
    return query
        .replace(/[^\s@]+@[^\s@]+/g, "[email]")
        .replace(/\+?\d[\d\s().-]{6,}\d/g, "[number]")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, SEARCH_LOG_MAX_QUERY_LENGTH);
}

export function parseSearchLogPayload(body: unknown): CatalogSearchLogPayload | null {
    if (!body || typeof body !== "object") return null;
    const { query, locale, event } = body as Record<string, unknown>;
    if (typeof query !== "string" || typeof locale !== "string" || !event || typeof event !== "object") return null;
    const e = event as Record<string, unknown>;
    let parsed: CatalogSearchLogEvent | null = null;
    if (e.kind === "search" && typeof e.resultCount === "number" && Number.isFinite(e.resultCount)) {
        parsed = { kind: "search", resultCount: e.resultCount };
    } else if (e.kind === "suggestions_shown" && Array.isArray(e.labels)) {
        parsed = { kind: "suggestions_shown", labels: e.labels.filter((label): label is string => typeof label === "string").slice(0, 3) };
    } else if (e.kind === "suggestion_click" && typeof e.label === "string") {
        parsed = { kind: "suggestion_click", label: e.label };
    }
    if (!parsed) return null;
    return { query, locale: locale === "es" ? "es" : "en", event: parsed };
}

/** Fire-and-forget from the browser; never throws and never blocks the page. */
export function sendCatalogSearchLog(payload: CatalogSearchLogPayload): void {
    if (typeof window === "undefined") return;
    try {
        const body = JSON.stringify(payload);
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
            const sent = navigator.sendBeacon("/api/catalog/search-log", new Blob([body], { type: "application/json" }));
            if (sent) return;
        }
        void fetch("/api/catalog/search-log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
        }).catch(() => undefined);
    } catch {
        // Logging must never affect shopping.
    }
}
