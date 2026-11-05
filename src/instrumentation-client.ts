import {
    SENTRY_IGNORE_ERRORS,
    resolveSentryDsn,
    resolveSentryEnvironment,
    resolveTracesSampleRate,
    surfaceForPathname,
} from "@/lib/observability/sentryEnvironment";

const dsn = resolveSentryDsn();

type SentryModule = typeof import("@sentry/nextjs");

// The browser SDK is ~150 KB gzipped, one of the largest first-load scripts.
// It is downloaded after the page's load event instead of with the page, so it
// never competes with the LCP image. Errors thrown before it arrives are kept
// and sent once it has initialised. Without a DSN (Preview) the SDK would be a
// no-op, so it is not downloaded at all.
let sentry: Promise<SentryModule> | null = null;
const earlyErrors: unknown[] = [];
const keepEarlyError = (event: ErrorEvent) => { earlyErrors.push(event.error ?? event.message); };
const keepEarlyRejection = (event: PromiseRejectionEvent) => { earlyErrors.push(event.reason); };

function loadSentry(): Promise<SentryModule> | null {
    if (!dsn) return null;
    sentry ??= import("@sentry/nextjs").then((Sentry) => {
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
        // The SDK's own handlers take over from here; send what came before.
        window.removeEventListener("error", keepEarlyError);
        window.removeEventListener("unhandledrejection", keepEarlyRejection);
        for (const error of earlyErrors.splice(0)) {
            Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
        }
        return Sentry;
    });
    return sentry;
}

if (dsn && typeof window !== "undefined") {
    window.addEventListener("error", keepEarlyError);
    window.addEventListener("unhandledrejection", keepEarlyRejection);
    const start = () => {
        if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => { void loadSentry(); }, { timeout: 3000 });
        else setTimeout(() => { void loadSentry(); }, 0);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
}

export function onRouterTransitionStart(href: string, navigationType: string) {
    void loadSentry()?.then((Sentry) => Sentry.captureRouterTransitionStart(href, navigationType));
}
