// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptureResult, PostHogConfig } from "posthog-js";
import { readFileSync } from "node:fs";
import { beforeSendPublicEvent, CAPTURE_PRIVACY_CONFIG, safeCaptureUrl } from "@/lib/analytics/capturePrivacy";
import { mayRecordSession } from "@/lib/analytics/sessionReplayScope";

const sdk = vi.hoisted(() => ({
    init: vi.fn(), capture: vi.fn(), identify: vi.fn(), reset: vi.fn(),
    startSessionRecording: vi.fn(), stopSessionRecording: vi.fn(),
}));
vi.mock("posthog-js", () => ({ default: sdk }));
const event = (name: string, properties = {}): CaptureResult => ({ event: name, properties } as CaptureResult);

beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); window.history.replaceState({}, "", "/catalog"); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("public capture boundary", () => {
    it.each([
        "/new-private-route", "/account/address", "/auth/callback", "/portal/account", "/team/resale-certificates",
        "/executive", "/studio", "/sign-in", "/sign-up", "/grace-workspace", "/cart", "/contact",
        "/request-quote", "/request-sample", "/es/portal/orders", "/es/unknown", "/catalog/../portal", "/%70ortal",
        "//catalog", "/catalog//", "/catalog\\private", "/products/customer%40example.com", "/products/a/private",
    ])("drops every supported capture type on %s", (route) => {
        expect(mayRecordSession(route)).toBe(false);
        vi.stubGlobal("window", { location: { pathname: route } });
        for (const name of ["$autocapture", "$pageview", "$pageleave", "$snapshot", "$$heatmap", "$dead_click", "Grace Tool Called"]) {
            expect(beforeSendPublicEvent(event(name))).toBeNull();
        }
    });

    it("retains reviewed English and Spanish routes, without URL query/hash text", () => {
        for (const route of ["/", "/es", "/es/catalog", "/catalog/cylinder", "/products/cylinder-9ml", "/matrix"]) {
            expect(mayRecordSession(route)).toBe(true);
        }
        expect(safeCaptureUrl("https://www.bestbottles.com/catalog?q=private@example.com#private")).toBe("https://www.bestbottles.com/catalog");
        expect(safeCaptureUrl("/portal/orders/customer-123")).toBeUndefined();
    });

    it("drops private buffered URLs even after returning to the storefront", () => {
        expect(beforeSendPublicEvent(event("$autocapture", { $current_url: "https://www.bestbottles.com/portal/orders/123" }))).toBeNull();
        expect(beforeSendPublicEvent(event("$$heatmap", { $heatmap_data: { "/portal": [] } }))).toBeNull();
    });

    it("removes free text and URL parameters from explicit events and SDK metadata", () => {
        const result = beforeSendPublicEvent(event("Catalog Filtered", {
            resultCount: 2, searchTerm: "private@example.com", query: "private formula", error: "private address",
            $current_url: "https://www.bestbottles.com/catalog?q=private#private", $referrer: "https://example.com/private",
            $set: { email: "private@example.com" }, $initial_current_url: "https://example.com/?private",
            $elements: [{ text: "private chat" }], $elements_chain: "private chat", $title: "private query",
        }));
        expect(result?.properties).toEqual({ resultCount: 2, $current_url: "https://www.bestbottles.com/catalog" });
    });

    it("does not weaken privacy via caller init options", async () => {
        const { analytics } = await import("@/lib/analytics");
        await analytics.init("test-only", { capture_heatmaps: true, before_send: undefined, session_recording: { maskAllInputs: false } });
        const config = sdk.init.mock.calls[0][1] as PostHogConfig;
        expect(config.capture_heatmaps).toBe(false);
        expect(config.disable_session_recording).toBe(true);
        expect(config.before_send).toBeTypeOf("function");
        window.history.replaceState({}, "", "/portal");
        expect((config.before_send as typeof beforeSendPublicEvent)(event("$pageview"))).toBeNull();
        expect(config.session_recording.maskAllInputs).toBe(true);
    });

    it("drops private calls before init and rechecks queued public calls at SDK readiness", async () => {
        const { analytics } = await import("@/lib/analytics");
        window.history.replaceState({}, "", "/portal/account");
        analytics.catalogFiltered({ searchTerm: "private", resultCount: 2 });
        analytics.identify("private-user");
        window.history.replaceState({}, "", "/catalog");
        analytics.catalogFiltered({ searchTerm: "private", resultCount: 3 });
        const ready = analytics.init("test-only");
        window.history.replaceState({}, "", "/portal/orders");
        await ready;
        expect(sdk.capture).not.toHaveBeenCalled();
        expect(sdk.identify).not.toHaveBeenCalled();
        analytics.setSessionRecording(true);
        expect(sdk.startSessionRecording).not.toHaveBeenCalled();
        expect(sdk.stopSessionRecording).toHaveBeenCalled();
        window.history.replaceState({}, "", "/catalog");
        analytics.catalogFiltered({ searchTerm: "private", resultCount: 4 });
        analytics.graceToolCalled({ toolName: "searchCatalog", searchTerm: "private", success: true });
        analytics.graceNavigation({ destination: "/catalog?q=private", triggeredBy: "tool", query: "private" });
        expect(JSON.stringify(sdk.capture.mock.calls)).not.toContain("private");
        expect(sdk.capture.mock.calls[0]).toEqual(["Catalog Filtered", { resultCount: 4 }]);
    });

    it("blocks network bodies while sanitizing replay metadata URLs", () => {
        const mask = CAPTURE_PRIVACY_CONFIG.session_recording!.maskCapturedNetworkRequestFn!;
        expect(mask({ name: "https://www.bestbottles.com/catalog?q=private" } as never)).toEqual({ name: "https://www.bestbottles.com/catalog" });
        expect(mask({ name: "https://www.bestbottles.com/api/grace", requestBody: "private" } as never)).toBeNull();
    });

    it("reports configuration without asserting ingestion or recording health", () => {
        const source = readFileSync("src/components/executive/ExecutiveBoard.tsx", "utf8");
        expect(source).toContain('analyticsConfigured ? "Configured" : null');
        expect(source).toContain("Unverified: a project token is present.");
        expect(source).not.toContain('"Collecting"');
    });
});
