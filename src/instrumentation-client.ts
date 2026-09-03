import * as Sentry from "@sentry/nextjs";
import {
    SENTRY_IGNORE_ERRORS,
    resolveSentryDsn,
    resolveSentryEnvironment,
    resolveTracesSampleRate,
    surfaceForPathname,
} from "@/lib/observability/sentryEnvironment";

const dsn = resolveSentryDsn();

Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    environment: resolveSentryEnvironment(),
    tracesSampleRate: resolveTracesSampleRate(),
    // Replay stays off until privacy masking has been reviewed with Jordan.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    ignoreErrors: SENTRY_IGNORE_ERRORS,
    initialScope: { tags: { runtime: "browser", app: "best-bottles-web" } },
    beforeSend(event) {
        // Tag by site surface so the Platform Health panel can say "the PDP
        // is throwing", not just "something is throwing".
        if (typeof window !== "undefined") {
            event.tags = { ...event.tags, surface: surfaceForPathname(window.location.pathname) };
        }
        return event;
    },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
