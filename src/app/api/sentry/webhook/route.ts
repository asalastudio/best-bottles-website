import { NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { verifySentryWebhook } from "@/lib/sentry-webhooks";
import { normalizeSentryWebhook } from "@/lib/observability/sentryIssues";

// Lazily constructed so a missing NEXT_PUBLIC_CONVEX_URL surfaces as a 500 at
// request time instead of crashing `next build` during page-data collection.
let convexClient: ConvexHttpClient | null = null;
function getConvex(): ConvexHttpClient | null {
    if (convexClient) return convexClient;
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) return null;
    convexClient = new ConvexHttpClient(url);
    return convexClient;
}

function json(body: Record<string, unknown>, status = 200) {
    return Response.json(body, { status });
}

/**
 * POST /api/sentry/webhook
 *
 * Receives Sentry Internal Integration webhooks (issue lifecycle, issue-alert
 * rules, optional error events), verifies the signature, and mirrors the
 * headline into Convex so the Team and Executive hubs can show what is
 * breaking. Sentry expects a 2xx within one second; anything we do not mirror
 * is acknowledged with 200 so Sentry never marks the endpoint unhealthy.
 */
export async function POST(req: NextRequest) {
    const rawBody = Buffer.from(await req.arrayBuffer());
    const resource = req.headers.get("sentry-hook-resource");
    const signature = req.headers.get("sentry-hook-signature");
    const requestId = req.headers.get("request-id");

    if (!verifySentryWebhook(rawBody, signature)) {
        console.error("[Sentry Webhook] signature verification failed", { resource, requestId });
        return new Response("Unauthorized", { status: 401 });
    }

    const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!writeToken) {
        console.error("[Sentry Webhook] BEST_BOTTLES_CONVEX_WRITE_TOKEN is not configured");
        return new Response("Server not configured", { status: 500 });
    }

    const convex = getConvex();
    if (!convex) {
        console.error("[Sentry Webhook] NEXT_PUBLIC_CONVEX_URL is not configured");
        return new Response("Server not configured", { status: 500 });
    }

    let body: unknown;
    try {
        body = JSON.parse(rawBody.toString("utf8"));
    } catch {
        return new Response("Bad Request", { status: 400 });
    }

    if (resource === "installation") {
        // Sentry pings this when the integration is installed or removed.
        return json({ ok: true, resource });
    }

    const delivery = normalizeSentryWebhook(resource, body, Date.now());
    if (!delivery) {
        return json({ ok: true, ignored: true, resource });
    }

    try {
        const result = await convex.mutation(api.observability.recordSentryDelivery, {
            token: writeToken,
            requestId,
            delivery,
        });
        return json({ ok: true, resource, action: delivery.action, ...result });
    } catch (error) {
        console.error("[Sentry Webhook] failed to mirror delivery into Convex", { resource, requestId, error });
        return new Response("Mirror failed", { status: 500 });
    }
}
