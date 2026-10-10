// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "synthetic-test-only";
    return { pathname: "/sign-in", auth: { isLoaded: false, isSignedIn: true, userId: "user-a", orgId: "org-a" } };
});
const analytics = vi.hoisted(() => ({ syncIdentity: vi.fn(), init: vi.fn().mockResolvedValue(undefined), setSuperProperties: vi.fn(), setSessionRecording: vi.fn(), pageViewed: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ analytics }));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => state.auth }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("@/components/CartProvider", () => ({ useCart: () => ({ itemCount: 0 }) }));
import { AnalyticsProvider } from "@/components/AnalyticsProvider";

it("waits for auth and reconciles on route, user, organization and logout changes", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    const root = createRoot(container);
    const render = async () => {
        await act(async () => { root.render(<AnalyticsProvider withClerk />); });
        // Clerk identity is a separate chunk; wait until that bridge has mounted.
        for (let i = 0; i < 20 && analytics.syncIdentity.mock.calls.length === 0; i++) {
            await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
        }
    };
    try {
        await render();
        expect(analytics.syncIdentity).toHaveBeenLastCalledWith(null);
        expect(analytics.init).not.toHaveBeenCalled();
        state.auth.isLoaded = true;
        await render();
        expect(analytics.syncIdentity).toHaveBeenLastCalledWith({ userId: "user-a", organizationId: "org-a" });
        state.pathname = "/catalog";
        await render();
        expect(analytics.syncIdentity).toHaveBeenCalledTimes(3);
        state.auth.orgId = "org-b";
        await render();
        expect(analytics.syncIdentity).toHaveBeenLastCalledWith({ userId: "user-a", organizationId: "org-b" });
        state.auth.userId = "user-b";
        await render();
        expect(analytics.syncIdentity).toHaveBeenLastCalledWith({ userId: "user-b", organizationId: "org-b" });
        state.auth.isSignedIn = false;
        await render();
        expect(analytics.syncIdentity).toHaveBeenLastCalledWith({ userId: null, organizationId: null });
    } finally {
        await act(async () => root.unmount());
        vi.unstubAllGlobals();
    }
});
