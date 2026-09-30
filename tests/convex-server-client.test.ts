import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import {
    classifyConvexNetworkError,
    createResilientConvexHttpClient,
    isRetryableConvexServerError,
    withConvexRetry,
} from "../src/lib/convexServerClient";

// The bodies Convex answered with on production (Vercel runtime errors, 2026-09-29).
const SERVICE_UNAVAILABLE = '{"code":"ServiceUnavailable","message":"Service temporarily unavailable (Code: 04)"}';
const INTERNAL_SERVER_ERROR = '{"code":"InternalServerError","message":"Your request couldn\'t be completed. Try again later."}';

function fetchFailed(code: string, message = "fetch failed"): Error {
    const cause = Object.assign(new Error(code === "UND_ERR_SOCKET" ? "other side closed" : code), { code });
    return Object.assign(new TypeError(message), { cause });
}

describe("resilient server-side Convex client", () => {
    it("classifies the failures seen in production and on developer machines", () => {
        // Vercel, 2026-09-15 → 09-25: Convex closed an idle keep-alive socket.
        expect(classifyConvexNetworkError(fetchFailed("UND_ERR_SOCKET"))).toBe("mid-flight");
        // Jordan's machine, 2026-09-25: connect timeout across IPv6 and IPv4, then a DNS miss.
        expect(classifyConvexNetworkError(fetchFailed("UND_ERR_CONNECT_TIMEOUT"))).toBe("connect");
        expect(classifyConvexNetworkError(fetchFailed("ENOTFOUND"))).toBe("connect");
        expect(classifyConvexNetworkError(fetchFailed("ECONNRESET"))).toBe("mid-flight");
        // A plain "fetch failed" with no cause code is treated as a connect-phase failure.
        expect(classifyConvexNetworkError(new TypeError("fetch failed"))).toBe("connect");
        // Application errors are never retried.
        expect(classifyConvexNetworkError(new Error("ArgumentValidationError: Value does not match validator"))).toBeNull();
        expect(classifyConvexNetworkError(new Error("[Request ID: abc] Server Error"))).toBeNull();
        expect(classifyConvexNetworkError("string")).toBeNull();
    });

    it("repeats a query once after a transient failure and then succeeds", async () => {
        const operation = vi.fn<() => Promise<string>>()
            .mockRejectedValueOnce(fetchFailed("UND_ERR_SOCKET"))
            .mockResolvedValueOnce("ok");
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        await expect(withConvexRetry(operation, { retryMidFlight: true, delayMs: 0, label: "products:searchCatalog" })).resolves.toBe("ok");
        expect(operation).toHaveBeenCalledTimes(2);
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });

    it("gives up after the second transient failure and rethrows the original error", async () => {
        const error = fetchFailed("ENOTFOUND");
        const operation = vi.fn<() => Promise<string>>().mockRejectedValue(error);
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        await expect(withConvexRetry(operation, { retryMidFlight: true, delayMs: 0 })).rejects.toBe(error);
        expect(operation).toHaveBeenCalledTimes(2);
        vi.restoreAllMocks();
    });

    it("does not repeat a mutation whose socket died mid-flight, but does repeat one that never connected", async () => {
        const midFlight = vi.fn<() => Promise<string>>().mockRejectedValue(fetchFailed("UND_ERR_SOCKET"));
        await expect(withConvexRetry(midFlight, { retryMidFlight: false, delayMs: 0 })).rejects.toBeInstanceOf(TypeError);
        expect(midFlight).toHaveBeenCalledTimes(1);

        const neverConnected = vi.fn<() => Promise<string>>()
            .mockRejectedValueOnce(fetchFailed("UND_ERR_CONNECT_TIMEOUT"))
            .mockResolvedValueOnce("committed once");
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        await expect(withConvexRetry(neverConnected, { retryMidFlight: false, delayMs: 0 })).resolves.toBe("committed once");
        expect(neverConnected).toHaveBeenCalledTimes(2);
        vi.restoreAllMocks();
    });

    it("never retries an application error", async () => {
        const validation = new Error("ArgumentValidationError: Object is missing the required field `searchTerm`");
        const operation = vi.fn<() => Promise<string>>().mockRejectedValue(validation);
        await expect(withConvexRetry(operation, { retryMidFlight: true, delayMs: 0 })).rejects.toBe(validation);
        expect(operation).toHaveBeenCalledTimes(1);
    });

    it("recognises Convex's own try-again answers, and nothing else, as server errors", () => {
        expect(isRetryableConvexServerError(new Error(SERVICE_UNAVAILABLE))).toBe(true);
        expect(isRetryableConvexServerError(new Error(INTERNAL_SERVER_ERROR))).toBe(true);
        // A function's own failure, a 4xx body and plain text are never repeated.
        expect(isRetryableConvexServerError(new Error("[Request ID: abc] Server Error"))).toBe(false);
        expect(isRetryableConvexServerError(new Error('{"code":"BadRequest","message":"Invalid argument"}'))).toBe(false);
        expect(isRetryableConvexServerError(new Error("{not json"))).toBe(false);
        expect(isRetryableConvexServerError("string")).toBe(false);
        // They are not network failures: that classification is unchanged.
        expect(classifyConvexNetworkError(new Error(SERVICE_UNAVAILABLE))).toBeNull();
    });

    it("repeats a query through two server errors, but never a mutation", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const query = vi.fn<() => Promise<string>>()
            .mockRejectedValueOnce(new Error(SERVICE_UNAVAILABLE))
            .mockRejectedValueOnce(new Error(INTERNAL_SERVER_ERROR))
            .mockResolvedValueOnce("ok");
        await expect(withConvexRetry(query, { retryMidFlight: true, retryServerErrors: true, attempts: 3, delayMs: 0 })).resolves.toBe("ok");
        expect(query).toHaveBeenCalledTimes(3);
        expect(warn).toHaveBeenCalledTimes(2);

        const unavailable = new Error(SERVICE_UNAVAILABLE);
        const mutation = vi.fn<() => Promise<string>>().mockRejectedValue(unavailable);
        await expect(withConvexRetry(mutation, { retryMidFlight: false, delayMs: 0 })).rejects.toBe(unavailable);
        expect(mutation).toHaveBeenCalledTimes(1);
        vi.restoreAllMocks();
    });

    it("the client's queries survive a 503 from Convex", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const fetcher = vi.fn()
            .mockResolvedValueOnce(new Response(SERVICE_UNAVAILABLE, { status: 503 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: "success", value: "drawn", logLines: [] }), { status: 200 }));
        vi.stubGlobal("fetch", fetcher);
        try {
            const client = createResilientConvexHttpClient("https://precise-raccoon-123.convex.cloud");
            await expect(client.query(makeFunctionReference<"query", Record<string, never>, string>("registerStage:forSkus"))).resolves.toBe("drawn");
            expect(fetcher).toHaveBeenCalledTimes(2);
        } finally {
            vi.unstubAllGlobals();
            vi.restoreAllMocks();
        }
    });

    it("is a drop-in ConvexHttpClient", () => {
        const client = createResilientConvexHttpClient("https://helpful-elephant-638.convex.cloud");
        expect(client).toBeInstanceOf(ConvexHttpClient);
        expect(typeof client.query).toBe("function");
        expect(typeof client.mutation).toBe("function");
    });
});
