// @vitest-environment jsdom
import React, { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GraceContextValue } from "@/components/GraceContext";

const state = vi.hoisted(() => ({
    pathname: "/catalog",
    engineMounts: 0,
    openPanel: vi.fn(),
    appendInlineMessage: vi.fn(),
    failEngine: false,
}));

vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ userId: null }) }));
vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));
// next/dynamic: load the module after mount and render it once ready, as ssr:false does. A failed
// import throws during render, as React.lazy does, so it reaches the nearest error boundary.
vi.mock("next/dynamic", () => ({
    default: (loader: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => function Dynamic(props: Record<string, unknown>) {
        const [Loaded, setLoaded] = React.useState<React.ComponentType<Record<string, unknown>> | null>(null);
        const [failure, setFailure] = React.useState<unknown>(null);
        useEffect(() => {
            const load = state.failEngine ? Promise.reject(new Error("ChunkLoadError: Loading chunk 5811 failed.")) : loader();
            void load.then((module) => setLoaded(() => module.default), (error) => setFailure(() => error));
        }, []);
        if (failure) throw failure;
        return Loaded ? <Loaded {...props} /> : null;
    },
}));
// The engine: publishes a value whose functions are spies.
vi.mock("@/components/grace/GraceProvider", async () => {
    const { GRACE_NOOP } = await vi.importActual<typeof import("@/components/GraceContext")>("@/components/GraceContext");
    return {
        default: function FakeEngine({ onValue }: { onValue: (value: GraceContextValue) => void }) {
            useEffect(() => {
                state.engineMounts++;
                onValue({ ...GRACE_NOOP, panelMode: "open", isOpen: true, openPanel: state.openPanel, appendInlineMessage: state.appendInlineMessage, ownerKey: "engine" });
            }, [onValue]);
            return null;
        },
    };
});

import GraceProviderShell from "@/components/grace/GraceProviderShell";
import { useGrace } from "@/components/GraceContext";

let seen: GraceContextValue | null = null;
let pageMounts = 0;
function Page() {
    seen = useGrace();
    useEffect(() => { pageMounts++; }, []);
    return <p>page</p>;
}

/** Let the dynamic import resolve and its effects commit. */
async function settle() {
    for (let i = 0; i < 5; i++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

async function mount() {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<GraceProviderShell><Page /></GraceProviderShell>));
    return { container, root };
}

describe("Grace provider shell", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        state.engineMounts = 0;
        state.openPanel.mockReset();
        state.appendInlineMessage.mockReset();
        seen = null;
        pageMounts = 0;
        state.pathname = "/catalog";
        state.failEngine = false;
        vi.restoreAllMocks();
    });

    it("keeps the page up and Grace closed when the engine fails to load", async () => {
        vi.stubGlobal("requestIdleCallback", () => 1);
        vi.stubGlobal("cancelIdleCallback", () => undefined);
        // React logs errors caught by a boundary; this one is expected.
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const { reportError } = await import("@/lib/observability/report");
        state.failEngine = true;
        const { container, root } = await mount();
        let opened: unknown = "pending";
        await act(async () => {
            void Promise.resolve(seen!.openPanel({ source: "header" } as never)).then((result) => { opened = result; });
        });
        await settle();
        // The page is still rendered, Grace is still closed, and the queued call settled with nothing.
        expect(container.textContent).toBe("page");
        expect(pageMounts).toBe(1);
        expect(seen?.panelMode).toBe("closed");
        expect(opened).toBeUndefined();
        expect(state.openPanel).not.toHaveBeenCalled();
        expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "grace-engine" });
        // Later calls do nothing and do not throw.
        await act(async () => { expect(seen!.openPanel()).toBeUndefined(); });
        expect(state.engineMounts).toBe(0);
        await act(async () => root.unmount());
    });

    it("serves closed Grace without loading the engine until the page is idle", async () => {
        vi.stubGlobal("requestIdleCallback", () => 1);
        vi.stubGlobal("cancelIdleCallback", () => undefined);
        const { container, root } = await mount();
        expect(container.textContent).toBe("page");
        expect(seen?.panelMode).toBe("closed");
        expect(seen?.surface.mode).toBe("closed");
        expect(state.engineMounts).toBe(0);
        await act(async () => root.unmount());
    });

    it("loads the engine on first use and replays the call once, without remounting the page", async () => {
        vi.stubGlobal("requestIdleCallback", () => 1);
        vi.stubGlobal("cancelIdleCallback", () => undefined);
        const { root } = await mount();
        expect(pageMounts).toBe(1);
        await act(async () => {
            seen!.openPanel({ source: "header" } as never);
            seen!.appendInlineMessage({ role: "grace", content: "hello" });
        });
        await settle();
        expect(state.engineMounts).toBe(1);
        expect(state.openPanel).toHaveBeenCalledTimes(1);
        expect(state.openPanel).toHaveBeenCalledWith({ source: "header" });
        expect(state.appendInlineMessage).toHaveBeenCalledWith({ role: "grace", content: "hello" });
        expect(seen?.panelMode).toBe("open");
        expect(seen?.ownerKey).toBe("engine");
        expect(pageMounts).toBe(1);
        // Once loaded, calls go straight to the engine.
        await act(async () => seen!.openPanel());
        expect(state.openPanel).toHaveBeenCalledTimes(2);
        await act(async () => root.unmount());
    });

    it("loads the engine after idle, and at once on Grace's own pages", async () => {
        let idle: (() => void) | null = null;
        vi.stubGlobal("requestIdleCallback", (callback: () => void) => { idle = callback; return 1; });
        vi.stubGlobal("cancelIdleCallback", () => undefined);
        const first = await mount();
        expect(state.engineMounts).toBe(0);
        await act(async () => idle?.());
        await settle();
        expect(state.engineMounts).toBe(1);
        await act(async () => first.root.unmount());

        state.engineMounts = 0;
        state.pathname = "/grace-workspace";
        vi.stubGlobal("requestIdleCallback", () => 1);
        const second = await mount();
        await settle();
        expect(state.engineMounts).toBe(1);
        await act(async () => second.root.unmount());
    });
});

describe("Grace engine stays out of the first load", () => {
    const sourceFiles = (dir: string): string[] => readdirSync(dir).flatMap(name => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
    });

    it("only the shell loads GraceProvider, and only dynamically", () => {
        const importers = sourceFiles("src").filter(path => /from\s+["'][^"']*\/grace\/GraceProvider["']/.test(readFileSync(path, "utf8")));
        expect(importers).toEqual([]);
        const shell = readFileSync("src/components/grace/GraceProviderShell.tsx", "utf8");
        expect(shell).toContain('dynamic(() => import("./GraceProvider"), { ssr: false })');
        expect(readFileSync("src/components/AppProviders.tsx", "utf8")).toContain('from "@/components/grace/GraceProviderShell"');
    });
});
