import { defineApp } from "convex/server";
import { v } from "convex/values";
import agent from "@convex-dev/agent/convex.config";
import posthog from "@posthog/convex/convex.config.js";

/**
 * PostHog runs on both sides of the app on purpose.
 *
 * The browser adapter in `src/lib/analytics.ts` sees what a visitor does. It
 * cannot see what actually happened: whether the draft order reached Shopify,
 * whether the resale certificate was approved, whether the plate the customer
 * was shown is the one on the order. Those facts live in Convex mutations, and
 * a funnel built only on client events will happily report a conversion that
 * the server rejected.
 *
 * The token is read from the deployment's own environment rather than the
 * Next.js build, so a preview backend can point at a different project or at
 * none. `POSTHOG_PROJECT_TOKEN` is the same `phc_` key the browser uses; it is
 * a write key, not a secret.
 */
const app = defineApp({
    env: {
        POSTHOG_PROJECT_TOKEN: v.string(),
        POSTHOG_HOST: v.optional(v.string()),
        // Only needed for local feature-flag evaluation. Absent means flags are
        // evaluated remotely, which is the safer default while nothing uses them.
        POSTHOG_PERSONAL_API_KEY: v.optional(v.string()),
        POSTHOG_FLAGS_POLLING_INTERVAL_SECONDS: v.optional(v.string()),
    },
});

app.use(agent);
app.use(posthog, {
    env: {
        POSTHOG_PROJECT_TOKEN: app.env.POSTHOG_PROJECT_TOKEN,
        POSTHOG_HOST: app.env.POSTHOG_HOST,
        POSTHOG_PERSONAL_API_KEY: app.env.POSTHOG_PERSONAL_API_KEY,
        POSTHOG_FLAGS_POLLING_INTERVAL_SECONDS: app.env.POSTHOG_FLAGS_POLLING_INTERVAL_SECONDS,
    },
});

export default app;
