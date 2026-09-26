// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { useBuilderFamilies } from "@/components/bottle-builder/useBuilderFamilies";
import type { BuilderFamily } from "@/lib/bottle-builder/entry";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

function Families({ streamed }: { streamed?: Promise<BuilderFamily[] | null> }) {
    const { families, status } = useBuilderFamilies([{ family: "Cylinder", groups: 7 }], streamed);
    return <><span>{status}</span><select>{families.map(f => <option key={f.family}>{f.family}</option>)}</select></>;
}

async function render(node: React.ReactNode) {
    const el = document.createElement("div");
    const root = createRoot(el);
    await act(async () => root.render(node));
    return { el, unmount: () => act(() => root.unmount()) };
}

describe("the family list streamed into /matrix", () => {
    it("uses the streamed list and never asks the families route", async () => {
        const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
        vi.stubGlobal("requestIdleCallback", (cb: () => void) => { cb(); return 1; });
        const { el, unmount } = await render(<Families streamed={Promise.resolve([{ family: "Circle", groups: 4 }, { family: "Cylinder", groups: 7 }])} />);
        try {
            expect(el.textContent).toContain("ready");
            expect([...el.querySelectorAll("option")].map(o => o.textContent)).toEqual(["Circle", "Cylinder"]);
            expect(fetcher).not.toHaveBeenCalled();
        } finally { unmount(); }
    });

    it("falls back to the families route when the stream failed", async () => {
        const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ families: [{ family: "Diva", groups: 3 }] }) }));
        vi.stubGlobal("fetch", fetcher);
        vi.stubGlobal("requestIdleCallback", (cb: () => void) => { cb(); return 1; });
        const { el, unmount } = await render(<Families streamed={Promise.resolve(null)} />);
        try {
            expect(fetcher).toHaveBeenCalledTimes(1);
            expect(el.textContent).toContain("ready");
            expect([...el.querySelectorAll("option")].map(o => o.textContent)).toEqual(["Diva", "Cylinder"]);
        } finally { unmount(); }
    });

    it("is started by the page before anything is awaited, and handed to the client", () => {
        const page = readFileSync("src/app/matrix/page.tsx", "utf8");
        const builder = page.slice(page.indexOf("async function Builder"));
        expect(builder.indexOf("loadBuilderFamilies().catch")).toBeLessThan(builder.indexOf("await headers()"));
        expect(builder).toContain("familyList={familyList}");
    });
});

describe("bottle requests shared by the tile prefetch and the pick", () => {
    it("asks once for a bottle that was hovered and then picked", async () => {
        const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes("/kits") ? { kits: { A: null } } : { configurations: [] } }));
        vi.stubGlobal("fetch", fetcher);
        const { prefetchBody, loadBodyKits, loadBodyConfigurations } = await import("@/components/bottle-builder/builder-requests");
        prefetchBody("Cylinder", "cylinder-9ml|17-415|Glass Bottle", null);
        expect(fetcher).toHaveBeenCalledTimes(2);
        await expect(loadBodyKits("Cylinder", "cylinder-9ml|17-415|Glass Bottle")).resolves.toEqual({ A: null });
        await expect(loadBodyConfigurations("Cylinder", "cylinder-9ml|17-415|Glass Bottle", null)).resolves.toEqual([]);
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
            "/api/bottle-builder/bodies?family=Cylinder&bodyId=cylinder-9ml%7C17-415%7CGlass%20Bottle",
            "/api/bottle-builder/kits?family=Cylinder&bodyId=cylinder-9ml%7C17-415%7CGlass%20Bottle",
        ]);
    });

    it("forgets a failed or malformed response, so trying again makes a new request", async () => {
        const fetcher = vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ configurations: "nope" }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ configurations: [] }) });
        vi.stubGlobal("fetch", fetcher);
        const { loadBodyConfigurations } = await import("@/components/bottle-builder/builder-requests");
        await expect(loadBodyConfigurations("Cylinder", "b", null)).rejects.toThrow();
        await expect(loadBodyConfigurations("Cylinder", "b", null)).rejects.toThrow();
        await expect(loadBodyConfigurations("Cylinder", "b", null)).resolves.toEqual([]);
        expect(fetcher).toHaveBeenCalledTimes(3);
    });
});

describe("lazy PostHog", () => {
    it("queues calls made before the SDK is ready and replays them in order after init", async () => {
        const calls: string[] = [];
        vi.doMock("posthog-js", () => ({ default: {
            init: () => calls.push("init"),
            capture: (event: string) => calls.push(`capture:${event}`),
            identify: (id: string) => calls.push(`identify:${id}`),
            reset: () => calls.push("reset"), setPersonProperties: () => {}, group: () => {},
            startSessionRecording: () => {}, stopSessionRecording: () => {},
        } }));
        const { analytics } = await import("@/lib/analytics");
        analytics.matrixOpened({ source: "nav", family: "Cylinder" });
        expect(calls).toEqual([]);
        const ready = analytics.init("phc_test");
        analytics.identify("user_1");
        await ready;
        expect(calls).toEqual(["init", "capture:Matrix Opened", "identify:user_1"]);
        analytics.reset();
        expect(calls.at(-1)).toBe("reset");
        vi.doUnmock("posthog-js");
    });

    it("keeps posthog-js out of the static import graph", () => {
        const source = readFileSync("src/lib/analytics.ts", "utf8");
        expect(source).not.toMatch(/^import posthog from "posthog-js"/m);
        expect(source).toContain('await import("posthog-js")');
    });
});

describe("builder caching policy", () => {
    it("serves every builder JSON route stale while it revalidates, and caches kit layers server-side", () => {
        const server = readFileSync("src/lib/bottle-builder/server.ts", "utf8");
        expect(server).toMatch(/BUILDER_CDN_CACHE = "public, s-maxage=\d+, stale-while-revalidate=86400"/);
        expect(server).toMatch(/BUILDER_FAMILIES_CDN_CACHE = "public, s-maxage=\d+, stale-while-revalidate=86400"/);
        expect(server).toContain("const cachedBodyKits = unstable_cache(");
        for (const route of ["bodies", "kits"]) expect(readFileSync(`src/app/api/bottle-builder/${route}/route.ts`, "utf8")).toContain("BUILDER_CDN_CACHE");
        expect(readFileSync("src/app/api/bottle-builder/families/route.ts", "utf8")).toContain("BUILDER_FAMILIES_CDN_CACHE");
    });

    it("warms every family and every bottle's kits, without expiring what it is about to write", async () => {
        const revalidateTag = vi.fn();
        const loadBuilderBodyKits = vi.fn(async () => ({}));
        vi.doMock("next/cache", () => ({ revalidateTag, updateTag: revalidateTag, unstable_cache: (fn: unknown) => fn }));
        vi.doMock("@/lib/bottle-builder/server", () => ({
            loadBuilderFamilies: async () => [{ family: "Cylinder", groups: 2 }, { family: "Diva", groups: 1 }],
            loadBuilderFamily: async (family: string) => family === "Cylinder" ? [{ id: "a" }, { id: "b" }] : [{ id: "c" }],
            loadBuilderBodyKits,
        }));
        vi.stubEnv("CRON_SECRET", "s3cret");
        const { GET } = await import("@/app/api/bottle-builder/warm/route");
        expect((await GET(new Request("https://x/api/bottle-builder/warm"))).status).toBe(401);
        const response = await GET(new Request("https://x/api/bottle-builder/warm", { headers: { authorization: "Bearer s3cret" } }));
        expect(response.status).toBe(200);
        expect(loadBuilderBodyKits.mock.calls.map(call => (call as unknown[]).join(":")).sort()).toEqual(["Cylinder:a", "Cylinder:b", "Diva:c"]);
        expect(revalidateTag).not.toHaveBeenCalled();
        vi.unstubAllEnvs();
        vi.doUnmock("next/cache");
        vi.doUnmock("@/lib/bottle-builder/server");
    });
});
