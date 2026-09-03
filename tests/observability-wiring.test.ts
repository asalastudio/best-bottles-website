import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Sentry is wired into every runtime", () => {
    it("next.config.ts is wrapped and tunnels browser events through our origin", () => {
        const source = read("next.config.ts");
        // The /config subpath, not the package root — the root import is deprecated.
        expect(source).toContain('import { withSentryConfig } from "@sentry/nextjs/config"');
        expect(source).toContain("export default withSentryConfig(nextConfig, {");
        expect(source).toContain('tunnelRoute: "/monitoring-tunnel"');
        expect(read("src/proxy.ts")).toContain("monitoring-tunnel");
    });

    it("instrumentation exports the request-error hook and loads per-runtime config", () => {
        const source = read("src/instrumentation.ts");
        expect(source).toContain("export const onRequestError = Sentry.captureRequestError");
        expect(source).toContain('await import("./sentry.server.config")');
        expect(source).toContain('await import("./sentry.edge.config")');
        expect(read("src/instrumentation-client.ts")).toContain("export const onRouterTransitionStart = Sentry.captureRouterTransitionStart");
    });

    it("the SDK is a no-op without a DSN and never sends PII by default", () => {
        for (const file of ["src/instrumentation-client.ts", "src/sentry.server.config.ts", "src/sentry.edge.config.ts"]) {
            const source = read(file);
            expect(source).toContain("enabled: Boolean(dsn)");
            expect(source).toContain("sendDefaultPii: false");
        }
        expect(read("src/instrumentation-client.ts")).toContain("replaysSessionSampleRate: 0");
    });

    it("both error boundaries report to Sentry from an effect", () => {
        expect(read("src/app/error.tsx")).toContain("Sentry.captureException(error)");
        expect(read("src/app/global-error.tsx")).toContain("Sentry.captureException(error)");
        expect(read("src/app/global-error.tsx")).toContain("<html lang=\"en\">");
    });

    it("deliberately swallowed errors now go through reportError", () => {
        for (const file of [
            "src/lib/graceRateLimitServer.ts",
            "src/app/api/catalog/search/route.ts",
            "src/app/api/grace/chat/route.ts",
            "src/components/grace-workspace/WorkspaceShell.tsx",
            "src/components/products/Viewer3DBoundary.tsx",
        ]) {
            expect(read(file)).toContain("reportError(");
        }
    });
});

describe("the Sentry → Convex → dashboard bridge", () => {
    it("the schema keeps only headlines and pins that with a literal", () => {
        const schema = read("convex/schema.ts");
        expect(schema).toContain("errorIssues: defineTable({");
        expect(schema).toContain("rawContentStored: v.literal(false)");
        expect(schema).toContain('.index("by_sentryIssueId", ["sentryIssueId"])');
        expect(schema).toContain("errorIssueEvents: defineTable({");
        expect(schema).toContain("errorSyncRuns: defineTable({");
    });

    it("the webhook route verifies the signature before touching Convex", () => {
        const route = read("src/app/api/sentry/webhook/route.ts");
        expect(route.indexOf("verifySentryWebhook(")).toBeLessThan(route.indexOf("recordSentryDelivery"));
        expect(route).toContain('req.headers.get("sentry-hook-resource")');
        expect(route).toContain('req.headers.get("request-id")');
    });

    it("the cron keeps counts truthful and the hubs render the panel", () => {
        expect(read("convex/crons.ts")).toContain("internal.observability.syncFromSentry");
        expect(read("src/components/executive/ExecutiveDashboard.tsx")).toContain("<PlatformHealthPanel");
        expect(read("src/components/executive/ExecutiveNavigation.tsx")).toContain('{ short: "PL", label: "Platform", href: "#platform", available: true }');
        expect(read("src/app/team/page.tsx")).toContain("<PlatformStatusCard");
        expect(read("src/app/executive/page.tsx")).toContain("getPlatformHealthSnapshot()");
    });

    it("an unfed pipeline reports not-connected, never a green all-clear", () => {
        // Zero open issues and zero deliveries produce identical numbers and
        // mean opposite things; the flag is what separates them.
        const loader = read("src/lib/executive/platformHealth.ts");
        expect(loader).toContain("awaitingFirstDelivery: neverFed");
        for (const file of ["src/components/team/PlatformStatusCard.tsx", "src/components/executive/PlatformHealthPanel.tsx"]) {
            expect(read(file)).toContain("snapshot.awaitingFirstDelivery");
        }
    });

    it("env documentation covers every variable the pipeline reads", () => {
        const env = read(".env.example");
        for (const name of ["NEXT_PUBLIC_SENTRY_DSN", "SENTRY_ORG", "SENTRY_PROJECT", "SENTRY_AUTH_TOKEN", "SENTRY_WEBHOOK_CLIENT_SECRET", "SENTRY_API_TOKEN", "SENTRY_ORG_SLUG"]) {
            expect(env).toContain(name);
        }
    });
});
