import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getFunctionName } from "convex/server";
import {
    GRACE_BUSY_NOTICE,
    GRACE_ERROR_NOTICE,
    GRACE_UNAVAILABLE_NOTICE,
} from "../src/lib/grace/openaiFailure";

const mocks = vi.hoisted(() => ({
    action: vi.fn(),
    reportError: vi.fn(),
}));

vi.mock("@/lib/graceRateLimitServer", () => ({ enforceGraceRateLimit: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/convexServerClient", () => ({
    createResilientConvexHttpClient: () => ({ action: mocks.action }),
}));
vi.mock("@/lib/observability/report", () => ({ reportError: mocks.reportError }));

import { POST as chat } from "../src/app/api/grace/chat/route";
import { GET as realtimeToken } from "../src/app/api/openai/realtime-token/route";

const SHOPPER_TEXT = "Do you have a 9ml roll-on for jane@example.com?";
const API_KEY = "sk-test-not-a-real-key";

const chatRequest = () => chat(new NextRequest("http://localhost/api/grace/chat", {
    method: "POST",
    body: JSON.stringify({ messages: [{ role: "user", content: SHOPPER_TEXT }] }),
}));
const tokenRequest = () => realtimeToken(new NextRequest("http://localhost/api/openai/realtime-token"));

const QUOTA_FAILURE = {
    code: "grace_unavailable",
    reason: "quota",
    status: 429,
    openaiCode: "insufficient_quota",
    type: "insufficient_quota",
    model: "gpt-5",
    attempts: 1,
};

function reported() {
    expect(mocks.reportError).toHaveBeenCalledTimes(1);
    const [error, context] = mocks.reportError.mock.calls[0];
    return { error: error as Error, context };
}

describe("/api/grace/chat when Grace's text turn fails", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
    });
    afterEach(() => vi.unstubAllEnvs());

    it("asks askGraceReply, the action that says why a turn failed", async () => {
        mocks.action.mockResolvedValue({ message: "Hello" });
        await chatRequest();
        expect(getFunctionName(mocks.action.mock.calls[0][0])).toBe("grace:askGraceReply");
    });

    it("an out-of-credit account answers 503 with the honest notice and reports the outage", async () => {
        mocks.action.mockResolvedValue({ message: GRACE_UNAVAILABLE_NOTICE, failure: QUOTA_FAILURE });

        const response = await chatRequest();

        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({ error: GRACE_UNAVAILABLE_NOTICE, code: "grace_unavailable", reason: "quota" });
        const { error, context } = reported();
        expect(error.message).toContain("grace:openai_unavailable");
        expect(error.message).toContain("reason=quota");
        expect(error.message).toContain("code=insufficient_quota");
        expect(context).toMatchObject({
            area: "grace-openai",
            tags: { route: "grace-chat", reason: "quota", status: 429, code: "insufficient_quota" },
        });
        expect(JSON.stringify(mocks.reportError.mock.calls)).not.toContain("jane@example.com");
    });

    it("a busy spell answers 503 with the busy line and a Retry-After", async () => {
        mocks.action.mockResolvedValue({
            message: GRACE_BUSY_NOTICE,
            failure: { ...QUOTA_FAILURE, code: "grace_busy", reason: "rate_limit", openaiCode: "rate_limit_exceeded", type: "requests", attempts: 3 },
        });

        const response = await chatRequest();

        expect(response.status).toBe(503);
        expect(response.headers.get("Retry-After")).toBe("5");
        expect(await response.json()).toEqual({ error: GRACE_BUSY_NOTICE, code: "grace_busy", reason: "rate_limit" });
        expect(reported().context.tags).toMatchObject({ reason: "rate_limit" });
    });

    it("success is unchanged, including the plain string an older Convex deployment returns", async () => {
        mocks.action.mockResolvedValueOnce({ message: "Here are three options." });
        const structured = await chatRequest();
        expect(structured.status).toBe(200);
        expect(await structured.json()).toEqual({ message: "Here are three options." });

        mocks.action.mockResolvedValueOnce("Here are three options.");
        const legacy = await chatRequest();
        expect(legacy.status).toBe(200);
        expect(await legacy.json()).toEqual({ message: "Here are three options." });

        expect(mocks.reportError).not.toHaveBeenCalled();
    });
});

describe("/api/openai/realtime-token when OpenAI refuses", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("OPENAI_API_KEY", API_KEY);
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    const openAIError = (status: number, error: Record<string, unknown>) =>
        new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });

    it("an out-of-credit account keeps the 502 but names the outage and shows the honest notice", async () => {
        fetchMock.mockResolvedValue(openAIError(429, {
            message: "You exceeded your current quota, please check your plan and billing details.",
            type: "insufficient_quota",
            code: "insufficient_quota",
        }));

        const response = await tokenRequest();

        expect(response.status).toBe(502);
        const body = await response.json();
        expect(body).toEqual({ error: GRACE_UNAVAILABLE_NOTICE, code: "grace_unavailable", reason: "quota" });
        expect(JSON.stringify(body)).not.toContain("billing details");
        const { error, context } = reported();
        expect(error.message).toContain("grace:openai_unavailable");
        expect(context).toMatchObject({
            area: "grace-openai",
            tags: { route: "realtime-token", reason: "quota", status: 429, code: "insufficient_quota" },
            extra: expect.objectContaining({ model: "gpt-realtime-2.1" }),
        });
        expect(JSON.stringify(mocks.reportError.mock.calls)).not.toContain(API_KEY);
    });

    it("a rejected key is reported as auth with the honest notice", async () => {
        fetchMock.mockResolvedValue(openAIError(401, { message: "Incorrect API key provided.", code: "invalid_api_key", type: "invalid_request_error" }));

        const response = await tokenRequest();

        expect(response.status).toBe(502);
        expect(await response.json()).toEqual({ error: GRACE_UNAVAILABLE_NOTICE, code: "grace_unavailable", reason: "auth" });
        expect(reported().context.tags).toMatchObject({ reason: "auth", status: 401 });
    });

    it("a missing key keeps its 503 and is reported", async () => {
        vi.stubEnv("OPENAI_API_KEY", "");

        const response = await tokenRequest();

        expect(fetchMock).not.toHaveBeenCalled();
        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({ error: GRACE_UNAVAILABLE_NOTICE, code: "grace_unavailable", reason: "auth" });
        expect(reported().context.tags).toMatchObject({ reason: "auth", code: "missing_api_key" });
    });

    it("a rate limit says busy, and a 5xx says try again", async () => {
        fetchMock.mockResolvedValueOnce(openAIError(429, { message: "Rate limit reached.", code: "rate_limit_exceeded", type: "requests" }));
        const busy = await tokenRequest();
        expect(busy.status).toBe(502);
        expect(await busy.json()).toEqual({ error: GRACE_BUSY_NOTICE, code: "grace_busy", reason: "rate_limit" });

        fetchMock.mockResolvedValueOnce(new Response("secret provider detail", { status: 500 }));
        const down = await tokenRequest();
        expect(down.status).toBe(502);
        const body = await down.json();
        expect(body).toEqual({ error: GRACE_ERROR_NOTICE, code: "grace_error", reason: "upstream" });
        expect(JSON.stringify(body)).not.toContain("secret provider detail");
        expect(mocks.reportError).toHaveBeenCalledTimes(2);
    });

    it("a working key still returns the client secret", async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ value: "ek_test", expires_at: 1_786_000_000 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        }));

        const response = await tokenRequest();

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ clientSecret: "ek_test", model: "gpt-realtime-2.1" });
        expect(mocks.reportError).not.toHaveBeenCalled();
    });
});

describe("the Grace panel shows a failed turn as a notice", () => {
    it("uses the route's honest line instead of a Grace reply or the generic line", () => {
        const provider = readFileSync("src/components/grace/GraceProvider.tsx", "utf8");
        expect(provider).toContain("isGraceFailureCode(response.data?.code)");
        expect(provider).toContain('setErrorMessage(fallback.notice ?? "Grace is temporarily unavailable. Please try again.")');
        // The token route's `error` is what startConversation shows.
        expect(provider).toContain('throw new Error(res.error ?? "Failed to initialize OpenAI Realtime.")');
    });
});
