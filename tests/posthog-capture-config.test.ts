/**
 * The PostHog browser configuration.
 *
 * Three of these settings are the kind that regress silently: nothing breaks,
 * no test fails, and the only symptom is a dashboard that is quietly wrong —
 * which is worse than an empty one, because people act on it.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const analytics = readFileSync(resolve(process.cwd(), "src/lib/analytics.ts"), "utf8");
const nextConfig = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");

describe("PostHog capture configuration", () => {
    it("captures heatmaps, which autocapture does not cover", () => {
        // Autocapture records click EVENTS. Heatmaps are a separate stream —
        // pointer position, scroll depth, rageclicks — and are off unless asked
        // for. Pinned in code rather than left to the project's remote toggle.
        expect(analytics).toContain("capture_heatmaps: true");
    });

    it("captures dead clicks", () => {
        expect(analytics).toContain("capture_dead_clicks: true");
    });

    it("keeps session recording off until masking has been decided", () => {
        // Replay captures the raw DOM, which carries the SKUs and slugs the
        // privacy layer in analytics.ts deliberately hashes out of event
        // properties. Turning it on is a decision about masking, not a flag.
        expect(analytics).toContain("disable_session_recording: true");
    });
});

describe("PostHog ingestion proxy", () => {
    it("sends ingestion through our own origin by default", () => {
        // Ad-blockers block us.i.posthog.com by name. A heatmap built only on
        // people who do not run blockers looks complete while being
        // systematically biased, so the default must be same-origin.
        expect(analytics).toContain('process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "/ingest"');
    });

    it("points PostHog's own UI links at the real app, not the proxy path", () => {
        expect(analytics).toContain('ui_host: "https://us.posthog.com"');
    });

    it("rewrites both the ingestion and the static asset paths", () => {
        // The SDK loads its own bundles from us-assets; proxying only the
        // ingestion path leaves those blocked and the SDK never initialises.
        expect(nextConfig).toContain('source: "/ingest/static/:path*"');
        expect(nextConfig).toContain("https://us-assets.i.posthog.com/static/:path*");
        expect(nextConfig).toContain('source: "/ingest/:path*"');
        expect(nextConfig).toContain("https://us.i.posthog.com/:path*");
    });

    it("orders the static rewrite before the catch-all", () => {
        // /ingest/:path* would otherwise swallow /ingest/static/* and send
        // asset requests to the ingestion host, which 404s them.
        expect(nextConfig.indexOf('source: "/ingest/static/:path*"'))
            .toBeLessThan(nextConfig.indexOf('source: "/ingest/:path*"'));
    });

    it("skips the trailing-slash redirect the proxy would otherwise trip", () => {
        // Without this Next 308s PostHog's trailing-slash paths and the
        // requests fail — with no error anywhere in our own code.
        expect(nextConfig).toContain("skipTrailingSlashRedirect: true");
    });
});
