import * as Sentry from "@sentry/nextjs";

/**
 * Next.js instrumentation entry. Loads the runtime-specific Sentry init and
 * exports the hook that captures errors thrown in Server Components, Route
 * Handlers, Server Actions and the proxy (middleware).
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        await import("./sentry.server.config");
    }

    if (process.env.NEXT_RUNTIME === "edge") {
        await import("./sentry.edge.config");
    }
}

export const onRequestError = Sentry.captureRequestError;
