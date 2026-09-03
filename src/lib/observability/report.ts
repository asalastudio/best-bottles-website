/**
 * The one way application code reports a caught error.
 *
 * Keeps the existing `console.error("[area]", error)` convention (Vercel logs
 * still show it) and forwards the same error to Sentry with an `area` tag so
 * the Platform Health panel can group by subsystem. Never throws: telemetry
 * must not turn a degraded experience into a broken one.
 *
 * Use it where code deliberately swallows an error (fail-open rate limiter,
 * React boundaries, tool fallbacks). Unhandled errors are captured by the SDK
 * automatically — do not wrap those.
 */
import * as Sentry from "@sentry/nextjs";

export type ReportErrorContext = {
    /** Subsystem label, e.g. "grace-rate-limit", "catalog-search", "viewer-3d". */
    area: string;
    level?: "fatal" | "error" | "warning";
    tags?: Record<string, string | number | boolean | null | undefined>;
    /** Small, non-PII details. Never pass request bodies or customer data. */
    extra?: Record<string, unknown>;
};

export function reportError(error: unknown, context: ReportErrorContext): void {
    const label = `[${context.area}]`;
    if (context.level === "warning") {
        console.warn(label, error);
    } else {
        console.error(label, error);
    }

    try {
        Sentry.withScope((scope) => {
            scope.setTag("area", context.area);
            for (const [key, value] of Object.entries(context.tags ?? {})) {
                if (value !== undefined && value !== null) scope.setTag(key, String(value));
            }
            if (context.extra) scope.setContext("details", context.extra);
            if (context.level) scope.setLevel(context.level);
            Sentry.captureException(error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error)));
        });
    } catch {
        // Telemetry is best-effort by design.
    }
}
