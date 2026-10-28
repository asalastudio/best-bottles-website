"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { gaMeasurementId, gaPageLocation } from "@/lib/analytics/googleAnalytics";
import { publicCapturePath } from "@/lib/analytics/sessionReplayScope";

const GA_ID = gaMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);

declare global {
    interface Window {
        dataLayer?: unknown[];
    }
}

let configured = false;

// gtag.js reads Arguments objects from the queue; a plain array is ignored.
function gtag(...args: unknown[]): void;
function gtag() {
    // eslint-disable-next-line prefer-rest-params
    (window.dataLayer ??= []).push(arguments);
}

/**
 * Google Analytics 4 page views, for Best Bottles' own GA property, so their
 * reporting carries on across the move from the legacy site. PostHog stays the
 * conversion surface (src/lib/analytics.ts).
 *
 * Off unless NEXT_PUBLIC_GA_MEASUREMENT_ID is set. Page views are sent here on
 * each navigation, never automatically, and only where gaPageLocation allows;
 * gtag.js is only requested from a counted page, so a visit that stays on
 * private routes never fetches it. Google signals and ad personalisation are
 * off: there are no Google Ads to feed.
 */
export function GoogleAnalytics() {
    const pathname = usePathname();

    useEffect(() => {
        if (!GA_ID) return;
        const location = gaPageLocation(window.location.href);
        if (!location) return;
        if (!configured) {
            gtag("js", new Date());
            gtag("config", GA_ID, {
                send_page_view: false,
                allow_google_signals: false,
                allow_ad_personalization_signals: false,
            });
            configured = true;
        }
        gtag("event", "page_view", { page_location: location });
    }, [pathname]);

    if (!GA_ID || publicCapturePath(pathname) === null) return null;
    return <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />;
}
