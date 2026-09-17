import type { NextConfig } from "next";
// The /config subpath is the supported import for build-time wiring; importing
// withSentryConfig from the package root is deprecated and breaks in v11.
import { withSentryConfig } from "@sentry/nextjs/config";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const projectRoot = process.cwd();

// ── Validate required environment variables at build time ────────────────
const requiredEnvVars = [
    "NEXT_PUBLIC_CONVEX_URL",
    "OPENAI_API_KEY",
] as const;

for (const key of requiredEnvVars) {
    if (!process.env[key]) {
        console.warn(`⚠ Missing environment variable: ${key}`);
    }
}

function convexStorageImagePatterns() {
    const raw = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!raw) return [];
    try {
        const host = new URL(raw).hostname;
        const hosts = new Set([host]);
        if (host.endsWith(".convex.site")) hosts.add(host.replace(/\.convex\.site$/, ".convex.cloud"));
        if (host.endsWith(".convex.cloud")) hosts.add(host.replace(/\.convex\.cloud$/, ".convex.site"));
        return [...hosts].map((hostname) => ({
            protocol: "https" as const,
            hostname,
            pathname: "/api/storage/**",
        }));
    } catch {
        return [];
    }
}

const nextConfig: NextConfig = {
    reactStrictMode: false,
    // Required by the /ingest PostHog proxy below — without it Next 308s
    // PostHog's trailing-slash paths and the requests fail.
    skipTrailingSlashRedirect: true,
    outputFileTracingRoot: projectRoot,
    // Cursor's preview browser hits the VM as 127.0.0.1. Without this, Next
    // blocks /_next assets and Team Hub client islands (the tool cards) never paint.
    allowedDevOrigins: ["127.0.0.1", "localhost"],
    experimental: {
        // Sentry adds a custom Webpack hook, disabling Next's default worker.
        // Isolate compilation so its memory is released before TypeScript runs.
        webpackBuildWorker: true,
        // Vercel's standard build container OOM-killed the webpack worker on
        // 2026-09-14; this trades a little build time for a lower peak heap.
        webpackMemoryOptimizations: true,
    },
    turbopack: {
        root: projectRoot,
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "cdn.sanity.io",
            },
            {
                protocol: "https",
                hostname: "cdn.shopify.com",
            },
            {
                protocol: "https",
                // Pinned to our single Supabase project — a wildcard here would let
                // any Supabase bucket on the internet use /_next/image as a proxy.
                hostname: "likkskifwsrvszxdvufw.supabase.co",
                pathname: "/storage/v1/object/public/**",
            },
            {
                protocol: "https",
                // The plate store. Pinned to our own bucket rather than
                // wildcarded: *.public.blob.vercel-storage.com would let any
                // Vercel Blob store on the internet use /_next/image as a
                // proxy, the same reason the Supabase host above is pinned.
                // Product pages render plates through next/image, so without
                // this every PDP throws "Invalid src prop".
                hostname: "yzy7l20k4yt6znzz.public.blob.vercel-storage.com",
            },
            {
                protocol: "https",
                hostname: "www.bestbottles.com",
            },
            ...convexStorageImagePatterns(),
        ],
    },

    async redirects() {
        return [
            {
                source: "/team/new",
                destination: "/team/products/new",
                permanent: false,
            },
            // ── Legacy /product/ → new /products/ (singular → plural) ──────
            {
                source: "/product/:slug",
                destination: "/products/:slug",
                permanent: true,
            },

            // ── Legacy PHP category pages → /catalog with filters ──────────
            {
                source: "/all-bottles/:path*.php",
                destination: "/catalog",
                permanent: true,
            },
            {
                source: "/all-bottles/:path*",
                destination: "/catalog",
                permanent: true,
            },

            // ── Legacy content pages ───────────────────────────────────────
            {
                source: "/product-packaging-ideas.php",
                destination: "/blog",
                permanent: true,
            },
            {
                source: "/about-us.php",
                destination: "/about",
                permanent: true,
            },
            {
                source: "/contact-us.php",
                destination: "/contact",
                permanent: true,
            },
            {
                source: "/contact.php",
                destination: "/contact",
                permanent: true,
            },

            // ── Catch-all for stray .php pages ─────────────────────────────
            {
                source: "/:path*.php",
                destination: "/",
                permanent: true,
            },

            // ── Non-www → www canonicalization (handled at DNS/Vercel level,
            //    but this catches any direct hits) ──────────────────────────
        ];
    },

    // PostHog ingestion, proxied through our own origin.
    //
    // Ad-blockers block us.i.posthog.com by name, which silently drops a
    // meaningful share of traffic. That is worse than collecting nothing,
    // because a heatmap built on the unblocked remainder looks complete while
    // being systematically biased toward people who do not run blockers.
    // Serving ingestion from /ingest on this domain keeps the measurement
    // representative.
    //
    // skipTrailingSlashRedirect below is required: Next would otherwise 308
    // PostHog's own trailing-slash paths and break the requests.
    async rewrites() {
        return [
            {
                source: "/ingest/static/:path*",
                destination: "https://us-assets.i.posthog.com/static/:path*",
            },
            {
                source: "/ingest/:path*",
                destination: "https://us.i.posthog.com/:path*",
            },
        ];
    },

    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "X-Frame-Options", value: "SAMEORIGIN" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
                    { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(self), usb=()" },
                ],
            },
        ];
    },
};

// ── Sentry ─────────────────────────────────────────────────────────────────
// The SDK itself is a no-op until NEXT_PUBLIC_SENTRY_DSN is set (see
// src/instrumentation*.ts). The Vercel integration sets SENTRY_AUTH_TOKEN on
// every environment, including Preview. Source-map upload + widenClientFileUpload
// are production-only so Preview webpack stays inside the 8 GB container.
const sentrySourceMapsEnabled = Boolean(process.env.SENTRY_AUTH_TOKEN)
    && process.env.VERCEL_ENV !== "preview";

export default withSentryConfig(withNextIntl(nextConfig), {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: !process.env.CI,
    telemetry: false,
    widenClientFileUpload: sentrySourceMapsEnabled,
    sourcemaps: {
        disable: !sentrySourceMapsEnabled,
        deleteSourcemapsAfterUpload: true,
    },
    // Route browser events through our own origin so ad blockers cannot hide
    // storefront errors from us. Excluded from the Clerk proxy in src/proxy.ts.
    tunnelRoute: "/monitoring-tunnel",
});
