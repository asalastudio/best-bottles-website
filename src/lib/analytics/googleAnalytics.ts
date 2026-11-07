import { publicCapturePath } from "@/lib/analytics/sessionReplayScope";

/** The GA4 measurement ID, or null when it is unset or not one. */
export function gaMeasurementId(raw: string | undefined): string | null {
    const id = raw?.trim();
    return id && /^G-[A-Z0-9]{4,20}$/.test(id) ? id : null;
}

/** The query parameters GA reads to attribute a visit. */
const CAMPAIGN_PARAMS = [
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
    "gclid", "gbraid", "wbraid",
];

/**
 * The page_location sent to GA for this URL, or null when the page is not counted.
 *
 * Same scope as PostHog (sessionReplayScope): reviewed public routes only, so
 * the portal, team tools, cart and forms send nothing. The query keeps campaign
 * parameters, which GA needs for attribution, and drops the rest.
 */
export function gaPageLocation(href: string): string | null {
    let url: URL;
    try {
        url = new URL(href);
    } catch {
        return null;
    }
    if (publicCapturePath(url.pathname) === null) return null;
    const kept = new URLSearchParams();
    for (const key of CAMPAIGN_PARAMS) {
        const value = url.searchParams.get(key);
        if (value !== null) kept.set(key, value);
    }
    const query = kept.toString();
    return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
}
