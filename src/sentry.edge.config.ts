import * as Sentry from "@sentry/nextjs";
import {
    SENTRY_IGNORE_ERRORS,
    resolveSentryDsn,
    resolveSentryEnvironment,
    resolveTracesSampleRate,
} from "@/lib/observability/sentryEnvironment";

const dsn = resolveSentryDsn();

Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    environment: resolveSentryEnvironment(),
    tracesSampleRate: resolveTracesSampleRate(),
    sendDefaultPii: false,
    ignoreErrors: SENTRY_IGNORE_ERRORS,
    initialScope: { tags: { runtime: "edge", app: "best-bottles-web" } },
});
