/**
 * One answer to "which environment is this?" for every Sentry init file.
 * Vercel exposes VERCEL_ENV on the server; the NEXT_PUBLIC_ twin only exists
 * when "Automatically expose System Environment Variables" is on, so we read
 * both and fall back to NODE_ENV for local work.
 */
export function resolveSentryEnvironment(): string {
    const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
    if (vercelEnv === "production" || vercelEnv === "preview" || vercelEnv === "development") return vercelEnv;
    return process.env.NODE_ENV === "production" ? "production" : "development";
}

export function resolveSentryDsn(): string | undefined {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
    return dsn ? dsn : undefined;
}

/** Sample rates: enough tracing to see slow routes in prod without burning quota. */
export function resolveTracesSampleRate(): number {
    const configured = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE);
    if (Number.isFinite(configured) && configured >= 0 && configured <= 1) return configured;
    return resolveSentryEnvironment() === "production" ? 0.05 : 0;
}

/** Browser noise that is never actionable for Best Bottles. */
export const SENTRY_IGNORE_ERRORS: Array<string | RegExp> = [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    /^Non-Error promise rejection captured/,
    /Loading chunk [\d]+ failed/,
    /Failed to fetch dynamically imported module/,
    "AbortError: The operation was aborted",
    "The user aborted a request",
    /^NotAllowedError: play\(\)/,
];

/** Which part of the site an event came from — the tag the Platform Health panel groups by. */
export function surfaceForPathname(pathname: string): string {
    if (pathname.startsWith("/portal")) return "customer-portal";
    if (pathname.startsWith("/team")) return "team-hub";
    if (pathname.startsWith("/executive")) return "executive-hub";
    if (pathname.startsWith("/grace-workspace")) return "grace-workspace";
    if (pathname.startsWith("/studio")) return "sanity-studio";
    if (pathname.startsWith("/products/")) return "pdp";
    if (pathname.startsWith("/catalog")) return "catalog";
    if (pathname.startsWith("/cart")) return "cart";
    if (pathname.startsWith("/api/")) return "api";
    return "storefront";
}
