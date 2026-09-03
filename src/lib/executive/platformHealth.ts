import "server-only";

import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";

export type PlatformHealthData = FunctionReturnType<typeof api.observability.getPlatformHealth>;

export type PlatformHealthSnapshot = {
    status: "source-backed" | "not-connected";
    asOf: string | null;
    data: PlatformHealthData | null;
    /**
     * True when Convex answered but has never received a Sentry delivery. The
     * counts are all zero in that case, which must NOT be shown as a green
     * "all healthy" — zero issues found and zero issues reported look
     * identical in the numbers and mean opposite things.
     */
    awaitingFirstDelivery: boolean;
    message: string | null;
    /** Deep link to the Sentry org issue stream, when the org slug is public. */
    sentryIssuesUrl: string | null;
};

let convexClient: ConvexHttpClient | null = null;

function getConfiguration() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    const token = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    if (!token) throw new Error("BEST_BOTTLES_CONVEX_WRITE_TOKEN is not set");
    convexClient ??= new ConvexHttpClient(url);
    return { client: convexClient, token };
}

function sentryIssuesUrl(): string | null {
    const org = process.env.NEXT_PUBLIC_SENTRY_ORG_SLUG?.trim() || process.env.SENTRY_ORG?.trim();
    return org ? `https://${org}.sentry.io/issues/` : null;
}

const notConnected = (message: string): PlatformHealthSnapshot => ({
    status: "not-connected",
    asOf: null,
    data: null,
    awaitingFirstDelivery: true,
    message,
    sentryIssuesUrl: sentryIssuesUrl(),
});

/**
 * Server-side load for the Platform Health panel. Mirrors
 * getGraceOperationsSnapshot: the token never reaches the browser, and any
 * failure degrades to "not connected" instead of breaking the hub.
 */
export async function getPlatformHealthSnapshot(options: { issueLimit?: number; activityLimit?: number } = {}): Promise<PlatformHealthSnapshot> {
    try {
        const { client, token } = getConfiguration();
        const data = await client.query(api.observability.getPlatformHealth, {
            token,
            issueLimit: options.issueLimit ?? 25,
            activityLimit: options.activityLimit ?? 12,
        });
        const neverFed = data.totalTracked === 0 && !data.lastSync && data.lastWebhookAt === null;
        return {
            status: "source-backed",
            asOf: new Date(data.generatedAt).toISOString(),
            data,
            awaitingFirstDelivery: neverFed,
            message: neverFed
                ? "Connected to Convex, but no Sentry deliveries have arrived yet. Finish the Sentry setup in docs/observability/SENTRY_RUNBOOK.md."
                : null,
            sentryIssuesUrl: sentryIssuesUrl(),
        };
    } catch (error) {
        console.error("[executive/platform-health] snapshot unavailable", {
            error: error instanceof Error ? error.message : "unknown",
        });
        return notConnected("Platform Health data is not connected.");
    }
}
