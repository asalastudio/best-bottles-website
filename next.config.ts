import type { NextConfig } from "next";
// The /config subpath is the supported import for build-time wiring; importing
// withSentryConfig from the package root is deprecated and breaks in v11.
import { withSentryConfig } from "@sentry/nextjs/config";

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

const nextConfig: NextConfig = {
    reactStrictMode: false,
    outputFileTracingRoot: projectRoot,
    experimental: {
        // Sentry adds a custom Webpack hook, disabling Next's default worker.
        // Isolate compilation so its memory is released before TypeScript runs.
        webpackBuildWorker: true,
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
                hostname: "www.bestbottles.com",
            },
        ],
    },

    async redirects() {
        return [
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
// src/instrumentation*.ts). withSentryConfig only adds build-time work — and
// only uploads source maps when SENTRY_AUTH_TOKEN is present, so local and
// preview builds stay exactly as fast as before.
export default withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: !process.env.CI,
    telemetry: false,
    widenClientFileUpload: true,
    sourcemaps: {
        disable: !process.env.SENTRY_AUTH_TOKEN,
        deleteSourcemapsAfterUpload: true,
    },
    // Route browser events through our own origin so ad blockers cannot hide
    // storefront errors from us. Excluded from the Clerk proxy in src/proxy.ts.
    tunnelRoute: "/monitoring-tunnel",
});
