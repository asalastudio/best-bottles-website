import {
    SENTRY_IGNORE_ERRORS,
    resolveSentryDsn,
    resolveSentryEnvironment,
    resolveTracesSampleRate,
    surfaceForPathname,
} from "@/lib/observability/sentryEnvironment";

const dsn = resolveSentryDsn();

let loading: Promise<void> | null = null;

function loadSentry() {
    loading ??= import("@sentry/nextjs").then((Sentry) => {
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
    });
    return loading;
}

// The SDK is the largest script on the homepage. Wait until the load event and
// then a quiet window, so the download does not compete with the LCP image.
function scheduleSentry() {
    const start = () => {
        window.setTimeout(() => {
            void loadSentry();
        }, 8000);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
}

scheduleSentry();

export function onRouterTransitionStart(href: string, navigationType: string) {
    void loadSentry().then(async () => {
        const Sentry = await import("@sentry/nextjs");
        Sentry.captureRouterTransitionStart(href, navigationType);
    });
}
