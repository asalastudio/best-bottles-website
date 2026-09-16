/**
 * Server-side PostHog, for facts only Convex knows.
 *
 * Use this for outcomes the browser cannot honestly report: an order that
 * actually reached Shopify, a certificate that was actually approved, a draft
 * that was actually submitted. Client events describe intent; these describe
 * what happened.
 *
 * Two rules:
 *
 *  1. **Never capture here what the browser already captures.** Double-counting
 *     a funnel step is worse than missing one, because it looks like success.
 *  2. **Never put a raw SKU or slug in a property.** The browser adapter hashes
 *     those deliberately (`src/lib/analytics.ts`); sending them from the server
 *     would walk straight around that boundary.
 */

import { PostHog } from "@posthog/convex";
import { components } from "./_generated/api";
import type { GenericMutationCtx, GenericDataModel } from "convex/server";

export const posthog = new PostHog(components.posthog);

/**
 * Capture a server-side event without ever letting it break the caller.
 *
 * Analytics is not part of the operation it observes. A submitted purchase
 * order that reached Shopify has succeeded whether or not PostHog heard about
 * it, so a missing token, a network hiccup, or a PostHog outage must not turn
 * that success into a failed mutation. This mirrors `reportError` on the Next
 * side, which wraps the Sentry call for the same reason.
 *
 * `POSTHOG_PROJECT_TOKEN` is genuinely absent on deployments that have not been
 * configured yet, which is the common case rather than the exceptional one.
 */
export async function captureServerEvent(
    ctx: GenericMutationCtx<GenericDataModel>,
    args: {
        distinctId: string | null;
        event: string;
        properties?: Record<string, string | number | boolean | null>;
    },
): Promise<void> {
    // An event with no actor cannot be attributed to a funnel, and PostHog
    // would invent an anonymous identity for it. Drop it instead.
    if (!args.distinctId) return;

    try {
        await posthog.capture(ctx, {
            distinctId: args.distinctId,
            event: args.event,
            properties: args.properties,
        });
    } catch (error) {
        console.warn(`[posthog] capture failed for ${args.event}:`, error);
    }
}

/**
 * The identity a server event is attributed to.
 *
 * Portal work is org-scoped, so the organization is the useful actor for
 * wholesale funnels — one buyer's colleague continuing their draft is the same
 * account, not a new visitor. Falls back to the user when no org is active.
 */
export function distinctIdFor(args: {
    clerkOrgId?: string | null;
    clerkUserId?: string | null;
}): string | null {
    return args.clerkOrgId ?? args.clerkUserId ?? null;
}
