// @vitest-environment jsdom
import { BrowserAutocapture } from "posthog-js/lib/src/browser-autocapture";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { record, EventType, type eventWithTime } from "posthog-js/rrweb";
import GraceChatMessage, { StreamingMessage } from "@/components/grace/GraceChatMessage";
import GraceLayoutShell from "@/components/grace/GraceLayoutShell";
import { CAPTURE_PRIVACY_CONFIG, PRIVATE_CAPTURE_SELECTOR } from "@/lib/analytics/capturePrivacy";

const state = vi.hoisted(() => ({ pathname: "/catalog" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("@/components/useGrace", () => ({ useGrace: () => ({ surface: { contentIsInset: false, mode: "overlay" } }) }));
vi.mock("@/components/grace/redesignCopy", () => ({ useGraceRedesignCopy: () => ({}) }));
vi.mock("@/components/grace/GraceActionRenderer", () => ({ default: () => <a href="/private-certificate.pdf">private-certificate</a> }));

afterEach(() => { document.body.innerHTML = ""; state.pathname = "/catalog"; window.history.replaceState({}, "", "/"); });

describe("replay serialization of sensitive UI", () => {
    it("blocks rendered Grace messages, uploads, actions, streams and Clerk content", () => {
        document.body.innerHTML = renderToStaticMarkup(<>
            <GraceChatMessage message={{ id: "synthetic", role: "user", content: "private-user-message" } as never} />
            <GraceChatMessage message={{ id: "synthetic-2", role: "assistant", content: "private-assistant-message", action: { type: "anything" } } as never} />
            <StreamingMessage text="private-stream" />
            <div className="cl-rootBox">private-auth-address{React.createElement("img", { src: "https://example.com/private-certificate.png", alt: "private certificate" })}</div>
            <input type="hidden" value="private-token" />
            <h1>private-search-result-heading</h1>
        </>);
        const snapshots: eventWithTime[] = [];
        const privacy = CAPTURE_PRIVACY_CONFIG.session_recording!;
        const stop = record({
            maskAllInputs: privacy.maskAllInputs,
            maskTextSelector: privacy.maskTextSelector ?? undefined,
            maskAllElementAttributes: privacy.maskAllElementAttributes,
            blockSelector: privacy.blockSelector ?? undefined,
            emit: e => { snapshots.push(e); },
        });
        try {
            record.takeFullSnapshot();
            const full = snapshots.filter(e => e.type === EventType.FullSnapshot);
            expect(full.length).toBeGreaterThan(0);
            expect(JSON.stringify(full)).not.toContain("private-");
        } finally { stop?.(); }
    });

    it("the pinned SDK excludes Grace/auth subtrees and private routes from autocapture", () => {
        window.history.replaceState({}, "", "/catalog");
        document.body.innerHTML = '<button>Public product</button><aside data-ph-private class="ph-no-capture"><button>private order</button></aside><div class="cl-rootBox"><button>private account</button></div>';
        const capture = vi.fn().mockResolvedValue(undefined);
        const autocapture = new BrowserAutocapture({ config: CAPTURE_PRIVACY_CONFIG, _shouldDisableFlags: () => true } as never);
        Object.assign(autocapture, { _client: { kv: { get: () => false }, capture } });
        const captureEvent = (target: Element) => {
            // Exercise the pinned SDK's DOM policy without initializing any network transport.
            Reflect.get(autocapture, "_captureEvent").call(autocapture, new MouseEvent("click"), "$autocapture", target);
        };
        const buttons = document.querySelectorAll("button");
        captureEvent(buttons[0]);
        expect(capture).toHaveBeenCalledOnce();
        captureEvent(buttons[1]);
        captureEvent(buttons[2]);
        expect(capture).toHaveBeenCalledOnce();
        window.history.replaceState({}, "", "/portal/orders");
        captureEvent(buttons[0]);
        expect(capture).toHaveBeenCalledOnce();
        window.history.replaceState({}, "", "/unreviewed");
        captureEvent(buttons[0]);
        expect(capture).toHaveBeenCalledOnce();
    });

    it("blocks the entire private route at render time, before navigation effects run", () => {
        state.pathname = "/portal/tax-exemption";
        document.body.innerHTML = renderToStaticMarkup(<GraceLayoutShell><p>synthetic permit and address</p></GraceLayoutShell>);
        expect(document.querySelector("p")?.closest(PRIVATE_CAPTURE_SELECTOR)).not.toBeNull();
        state.pathname = "/catalog";
        document.body.innerHTML = renderToStaticMarkup(<GraceLayoutShell><p>Public catalog</p></GraceLayoutShell>);
        expect(document.querySelector("p")?.closest(PRIVATE_CAPTURE_SELECTOR)).toBeNull();
    });
});
