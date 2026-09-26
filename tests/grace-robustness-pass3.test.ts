import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getFunctionName } from "convex/server";
import { isValidGraceOwnerKey } from "../src/lib/graceOwnerKeyFormat";
import { resolveRememberNoteHref } from "../src/lib/grace/memoryNotes";
import {
    GraceRealtimeConfigError,
    createGraceRealtimeClientSecret,
} from "../src/lib/grace/openaiRealtimeConfig";

const state = vi.hoisted(() => ({
    calls: [] as Array<{ route: string; identifier: string; limit: number }>,
    deny: new Set<string>(),
}));

vi.mock("@/lib/convexServerClient", () => ({
    createResilientConvexHttpClient: () => ({
        async mutation(ref: unknown, args: { route: string; identifier: string; limit: number; windowMs: number }) {
            if (getFunctionName(ref as never) !== "graceRateLimits:check") throw new Error("unexpected mutation");
            state.calls.push({ route: args.route, identifier: args.identifier, limit: args.limit });
            return { allowed: !state.deny.has(args.route), resetAt: Date.now() + 30_000 };
        },
    }),
}));

vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));

const ANON = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

function request(headers: Record<string, string>): NextRequest {
    return new NextRequest("https://best-bottles-website.vercel.app/api/grace/tools", { method: "POST", headers });
}

describe("Grace robustness pass 3", () => {
    it("accepts the three real owner-key shapes and nothing else", () => {
        expect(isValidGraceOwnerKey(ANON)).toBe(true);
        expect(isValidGraceOwnerKey("anon-k3j4h5g6-lq2w")).toBe(true);
        expect(isValidGraceOwnerKey("user:user_2abcDEFghijKLmnop")).toBe(true);
        expect(isValidGraceOwnerKey("")).toBe(false);
        expect(isValidGraceOwnerKey("junk")).toBe(false);
        expect(isValidGraceOwnerKey("user:x")).toBe(false);
        expect(isValidGraceOwnerKey(`user:${"a".repeat(200)}`)).toBe(false);
        expect(isValidGraceOwnerKey(null)).toBe(false);
    });

    it("rate-limits a valid owner per owner with an IP ceiling, and junk headers per IP only", async () => {
        process.env.NEXT_PUBLIC_CONVEX_URL = "https://unit-test.convex.cloud";
        const { enforceGraceRateLimit, resolveGraceRateLimitIdentifiers } = await import("../src/lib/graceRateLimitServer");

        expect(resolveGraceRateLimitIdentifiers(request({ "x-forwarded-for": "203.0.113.9, 10.0.0.1", "x-grace-owner-key": ANON })))
            .toEqual({ owner: ANON, ip: "203.0.113.9" });
        expect(resolveGraceRateLimitIdentifiers(request({ "x-real-ip": "198.51.100.4", "x-grace-owner-key": "not-a-key" })))
            .toEqual({ owner: null, ip: "198.51.100.4" });
        expect(resolveGraceRateLimitIdentifiers(request({}))).toEqual({ owner: null, ip: "unknown" });

        state.calls.length = 0;
        const allowed = await enforceGraceRateLimit(
            request({ "x-forwarded-for": "203.0.113.9", "x-grace-owner-key": ANON }),
            { route: "grace-tools", limit: 60, windowMs: 60_000 },
        );
        expect(allowed).toBeNull();
        expect(state.calls).toEqual([
            { route: "grace-tools", identifier: ANON, limit: 60 },
            { route: "grace-tools:ip", identifier: "203.0.113.9", limit: 300 },
        ]);

        state.calls.length = 0;
        await enforceGraceRateLimit(
            request({ "x-forwarded-for": "203.0.113.9", "x-grace-owner-key": "rotating-junk-1" }),
            { route: "grace-tools", limit: 60, windowMs: 60_000 },
        );
        expect(state.calls).toEqual([{ route: "grace-tools", identifier: "203.0.113.9", limit: 60 }]);

        // The IP ceiling blocks even when the owner bucket still has room.
        state.deny.add("grace-tools:ip");
        const blocked = await enforceGraceRateLimit(
            request({ "x-forwarded-for": "203.0.113.9", "x-grace-owner-key": ANON }),
            { route: "grace-tools", limit: 60, windowMs: 60_000 },
        );
        state.deny.clear();
        expect(blocked?.status).toBe(429);
        expect(blocked?.headers.get("Retry-After")).toMatch(/^\d+$/);
    });

    it("resolves a destination note's path: given path, own-origin URL, current page, else nothing", () => {
        expect(resolveRememberNoteHref({ kind: "destination", href: "/products/cylinder-9ml-amber-17-415-rollon?sku=GBCylAmb9RollBlkDot", currentPath: "/" }))
            .toBe("/products/cylinder-9ml-amber-17-415-rollon?sku=GBCylAmb9RollBlkDot");
        expect(resolveRememberNoteHref({ kind: "destination", href: "https://bestbottles.com/catalog?families=Cylinder", currentPath: "/" }))
            .toBe("/catalog?families=Cylinder");
        expect(resolveRememberNoteHref({ kind: "destination", href: null, currentPath: "/products/elegant-15ml-frosted-13-415-rollon" }))
            .toBe("/products/elegant-15ml-frosted-13-415-rollon");
        expect(resolveRememberNoteHref({ kind: "destination", href: "//evil.example/x", currentPath: null })).toBeNull();
        expect(resolveRememberNoteHref({ kind: "destination", href: "", currentPath: "" })).toBeNull();
        expect(resolveRememberNoteHref({ kind: "profile", href: "/products/x", currentPath: "/" })).toBeNull();
        expect(resolveRememberNoteHref({ kind: "correction", href: null, currentPath: "/catalog" })).toBeNull();
    });

    it("gives up on a hung OpenAI client-secret mint with a 504 and on a network failure with a 502", async () => {
        const hung = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }));
        const started = Date.now();
        const timedOut = createGraceRealtimeClientSecret({ apiKey: "sk-test", fetchImpl: hung as unknown as typeof fetch, timeoutMs: 25 });
        await expect(timedOut).rejects.toBeInstanceOf(GraceRealtimeConfigError);
        await expect(timedOut).rejects.toMatchObject({ statusCode: 504 });
        expect(Date.now() - started).toBeLessThan(2_000);
        expect(hung).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ signal: expect.any(AbortSignal) }));

        const down = vi.fn(async () => { throw new TypeError("fetch failed"); });
        await expect(createGraceRealtimeClientSecret({ apiKey: "sk-test", fetchImpl: down as unknown as typeof fetch }))
            .rejects.toMatchObject({ statusCode: 502, message: expect.stringContaining("could not be reached") });
    });
});
