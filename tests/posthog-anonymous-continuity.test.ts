// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { PostHog } from "posthog-js/lib/src/posthog-core";

const instances: PostHog[] = [];
function syntheticSdk() {
    const sdk = new PostHog();
    // No live token, transport or external recorder. Reuse browser storage to
    // model a hard reload with the actual pinned SDK's persisted state.
    vi.spyOn(sdk, "capture").mockReturnValue(undefined);
    sdk.init("synthetic-test-only", {
        autocapture: false, capture_pageview: false, capture_pageleave: false,
        capture_heatmaps: false, capture_dead_clicks: false, capture_exceptions: false,
        disable_session_recording: true,
        advanced_disable_flags: true, disable_external_dependency_loading: true,
        disable_surveys: true, disable_product_tours: true,
        persistence: "localStorage", persistence_name: "synthetic-continuity",
    });
    instances.push(sdk);
    return sdk;
}
beforeEach(() => { vi.resetModules(); localStorage.clear(); sessionStorage.clear(); });
afterEach(() => {
    for (const sdk of instances.splice(0)) {
        // Stop SDK housekeeping without sending queued requests.
        const queue = Reflect.get(sdk, "_requestQueue");
        if (queue) Reflect.get(queue, "_clearFlushTimeout").call(queue);
        sdk.sessionManager?.destroy();
    }
    localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks();
});

describe("pinned SDK anonymous reload and consent continuity", () => {
    it("preserves anonymous distinct and session IDs across a synthetic hard reload", async () => {
        const original = syntheticSdk();
        const originalId = original.get_distinct_id();
        const originalSession = original.sessionManager!.checkAndGetSessionAndWindowId().sessionId;
        const reloaded = syntheticSdk();
        expect(reloaded.get_distinct_id()).toBe(originalId);
        const reset = vi.spyOn(reloaded, "reset");
        const { setCaptureIdentity, reconcileCaptureIdentity } = await import("@/lib/analytics/captureIdentity");
        setCaptureIdentity({ userId: null, organizationId: null });
        reconcileCaptureIdentity(reloaded, true);
        expect(reset).not.toHaveBeenCalled();
        expect(reloaded.get_distinct_id()).toBe(originalId);
        expect(reloaded.sessionManager!.checkAndGetSessionAndWindowId().sessionId).toBe(originalSession);
    });

    it.each(["granted", "denied", "pending"] as const)("clears stale identified state while preserving %s consent exactly", async (consent) => {
        const original = syntheticSdk();
        original.identify("synthetic-old-user");
        if (consent !== "pending") original.consent.optInOut(consent === "granted");
        const reloaded = syntheticSdk();
        expect(reloaded.get_property("$user_state")).toBe("identified");
        expect(reloaded.get_explicit_consent_status()).toBe(consent);
        const originalResetConsent = reloaded.consent.reset;
        const { setCaptureIdentity, reconcileCaptureIdentity } = await import("@/lib/analytics/captureIdentity");
        setCaptureIdentity({ userId: null, organizationId: null });
        reconcileCaptureIdentity(reloaded, false);
        expect(reloaded.get_distinct_id()).not.toBe("synthetic-old-user");
        expect(reloaded.get_property("$user_state")).toBe("anonymous");
        expect(reloaded.get_explicit_consent_status()).toBe(consent);
        expect(reloaded.consent.reset).toBe(originalResetConsent);
        expect(reloaded.capture).not.toHaveBeenCalled();
    });

    it("restores the SDK consent method and fails closed if identity cleanup throws", async () => {
        const sdk = syntheticSdk();
        sdk.identify("synthetic-old-user");
        const method = sdk.consent.reset;
        vi.spyOn(sdk, "reset").mockImplementation(() => { throw new Error("synthetic failure"); });
        const { setCaptureIdentity, reconcileCaptureIdentity, identityCaptureReady } = await import("@/lib/analytics/captureIdentity");
        setCaptureIdentity({ userId: null, organizationId: null });
        expect(() => reconcileCaptureIdentity(sdk, false)).toThrow("synthetic failure");
        expect(sdk.consent.reset).toBe(method);
        expect(identityCaptureReady()).toBe(false);
    });
});
