// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ init: vi.fn(), consent: { reset: vi.fn() }, reset: vi.fn(), identify: vi.fn(), capture: vi.fn() }));
vi.mock("posthog-js", () => ({ default: sdk }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); window.history.replaceState({}, "", "/catalog"); });
const identity = (userId: string | null, organizationId: string | null = null) => ({ userId, organizationId });

describe("privacy-scoped auth lifecycle", () => {
    it("resets stale persisted identity on a blocked login and binds on public return", async () => {
        const { analytics } = await import("@/lib/analytics");
        window.history.replaceState({}, "", "/sign-in");
        analytics.syncIdentity(identity("new-user"));
        await analytics.init("synthetic");
        expect(sdk.reset).toHaveBeenCalledOnce();
        expect(sdk.identify).not.toHaveBeenCalled();
        analytics.pageViewed();
        expect(sdk.capture).not.toHaveBeenCalled();
        window.history.replaceState({}, "", "/catalog");
        analytics.syncIdentity(identity("new-user"));
        analytics.pageViewed();
        expect(sdk.identify).toHaveBeenCalledExactlyOnceWith("new-user");
        expect(sdk.identify.mock.invocationCallOrder[0]).toBeLessThan(sdk.capture.mock.invocationCallOrder[0]);
        analytics.syncIdentity(identity("new-user"));
        expect(sdk.reset).toHaveBeenCalledOnce();
        expect(sdk.identify).toHaveBeenCalledOnce();
    });

    it("resets on blocked logout, user switch and organization switch without private events", async () => {
        const { analytics } = await import("@/lib/analytics");
        analytics.syncIdentity(identity("user-a", "org-a"));
        await analytics.init("synthetic");
        window.history.replaceState({}, "", "/portal/account");
        analytics.syncIdentity(identity(null));
        analytics.syncIdentity(identity("user-b", "org-a"));
        analytics.syncIdentity(identity("user-b", "org-b"));
        expect(sdk.reset).toHaveBeenCalledTimes(4);
        expect(sdk.identify.mock.calls).toEqual([["user-a"]]);
        expect(sdk.capture).not.toHaveBeenCalled();
        window.history.replaceState({}, "", "/catalog");
        analytics.syncIdentity(identity("user-b", "org-b"));
        expect(sdk.identify.mock.calls).toEqual([["user-a"], ["user-b"]]);
        expect(JSON.stringify(sdk.identify.mock.calls)).not.toContain("org-");
    });

    it("uses only the latest auth context when the SDK resolves on a private route", async () => {
        const { analytics } = await import("@/lib/analytics");
        analytics.syncIdentity(identity("old-user"));
        analytics.pageViewed();
        const ready = analytics.init("synthetic");
        window.history.replaceState({}, "", "/portal");
        analytics.syncIdentity(identity("new-user", "org-b"));
        await ready;
        expect(sdk.reset).toHaveBeenCalledOnce();
        expect(sdk.identify).not.toHaveBeenCalled();
        expect(sdk.capture).not.toHaveBeenCalled();
        window.history.replaceState({}, "", "/catalog");
        analytics.syncIdentity(identity("new-user", "org-b"));
        expect(sdk.identify.mock.calls).toEqual([["new-user"]]);
    });

    it("drops queued events from a previous identity even if SDK resolves on a public route", async () => {
        const { analytics } = await import("@/lib/analytics");
        analytics.syncIdentity(identity("old-user"));
        analytics.catalogFiltered({ resultCount: 123 });
        const ready = analytics.init("synthetic");
        analytics.syncIdentity(identity("new-user"));
        await ready;
        expect(sdk.capture).not.toHaveBeenCalled();
        expect(sdk.identify.mock.calls).toEqual([["new-user"]]);
    });

    it("suppresses capture while auth is unresolved and clears persisted IDs for signed-out visitors", async () => {
        const { analytics } = await import("@/lib/analytics");
        analytics.syncIdentity(null);
        await analytics.init("synthetic");
        analytics.pageViewed();
        const beforeSend = sdk.init.mock.calls[0][1].before_send;
        expect(beforeSend({ event: "$autocapture", properties: {} })).toBeNull();
        expect(sdk.capture).not.toHaveBeenCalled();
        analytics.syncIdentity(identity(null));
        analytics.pageViewed();
        expect(sdk.reset).toHaveBeenCalledTimes(2);
        expect(sdk.identify).not.toHaveBeenCalled();
        expect(sdk.capture).toHaveBeenCalledOnce();
    });
});
