import * as Sentry from "@sentry/nextjs";

/**
 * Next.js instrumentation entry. Loads the runtime-specific Sentry init and
 * exports the hook that captures errors thrown in Server Components, Route
 * Handlers, Server Actions and the proxy (middleware).
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        // Resolve outbound hosts (Convex, OpenAI) IPv4-first. With Node's default
        // "verbatim" order, a network with broken IPv6 made every cold Convex call
        // wait out a 10 s IPv6 connect timeout before trying IPv4 (Grace audit,
        // 2026-09-25). Vercel's runtime is unaffected either way.
        try {
            const dns = await import("node:dns");
            dns.setDefaultResultOrder("ipv4first");
        } catch {
            // Not a Node runtime with dns configuration; nothing to do.
        }
        await import("./sentry.server.config");
    }

    if (process.env.NEXT_RUNTIME === "edge") {
        await import("./sentry.edge.config");
    }
}

export const onRequestError = Sentry.captureRequestError;
