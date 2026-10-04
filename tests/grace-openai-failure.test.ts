import { describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import {
    GRACE_BUSY_NOTICE,
    GRACE_ERROR_NOTICE,
    GRACE_UNAVAILABLE_NOTICE,
    callOpenAIWithRetry,
    classifyOpenAIFailure,
    classifyOpenAIResponseFailure,
    graceFailureNotice,
    normalizeGraceTextReply,
} from "../src/lib/grace/openaiFailure";

// Real SDK error objects, built the way the SDK builds them from a response.
function sdkError(status: number, error: Record<string, unknown> | undefined, headers: Record<string, string> = {}) {
    return OpenAI.APIError.generate(status, error ? { error } : undefined, undefined, new Headers(headers));
}

const QUOTA_BODY = {
    message: "You exceeded your current quota, please check your plan and billing details.",
    type: "insufficient_quota",
    param: null,
    code: "insufficient_quota",
};
const RATE_LIMIT_BODY = {
    message: "Rate limit reached for gpt-5 on requests per min (RPM): Limit 500. Please try again in 2s.",
    type: "requests",
    param: null,
    code: "rate_limit_exceeded",
};

describe("classifyOpenAIFailure", () => {
    it("reads an exhausted credit balance as quota and never retries it", () => {
        expect(classifyOpenAIFailure(sdkError(429, QUOTA_BODY))).toMatchObject({
            reason: "quota", status: 429, code: "insufficient_quota", type: "insufficient_quota", retryable: false,
        });
        expect(classifyOpenAIFailure(sdkError(429, { message: "Credit balance exhausted.", code: "credit_balance_exhausted" })))
            .toMatchObject({ reason: "quota", retryable: false });
        // No code at all, but the wording names billing.
        expect(classifyOpenAIFailure(sdkError(429, { message: "Your credit balance is too low. Check your billing details." })))
            .toMatchObject({ reason: "quota", retryable: false });
    });

    it("reads 401 and 403 as auth and never retries them", () => {
        expect(classifyOpenAIFailure(sdkError(401, { message: "Incorrect API key provided", code: "invalid_api_key", type: "invalid_request_error" })))
            .toMatchObject({ reason: "auth", status: 401, code: "invalid_api_key", retryable: false });
        expect(classifyOpenAIFailure(sdkError(403, { message: "Country not supported", code: "unsupported_country_region_territory" })))
            .toMatchObject({ reason: "auth", status: 403, retryable: false });
    });

    it("reads an ordinary 429 as a rate limit worth retrying, honouring OpenAI's wait", () => {
        expect(classifyOpenAIFailure(sdkError(429, RATE_LIMIT_BODY, { "retry-after-ms": "1500" }))).toMatchObject({
            reason: "rate_limit", status: 429, code: "rate_limit_exceeded", retryable: true, retryAfterMs: 1500,
        });
        expect(classifyOpenAIFailure(sdkError(429, undefined, { "retry-after": "3" })))
            .toMatchObject({ reason: "rate_limit", retryable: true, retryAfterMs: 3000 });
        // A named rate limit wins over wording that happens to mention quota.
        expect(classifyOpenAIFailure(sdkError(429, { ...RATE_LIMIT_BODY, message: "Rate limit: your per-minute quota resets in 2s." })))
            .toMatchObject({ reason: "rate_limit" });
    });

    it("retries 5xx and dropped connections but not a request OpenAI rejected", () => {
        expect(classifyOpenAIFailure(sdkError(500, { message: "server error" }))).toMatchObject({ reason: "upstream", retryable: true });
        expect(classifyOpenAIFailure(sdkError(503, undefined))).toMatchObject({ reason: "upstream", status: 503, retryable: true });
        expect(classifyOpenAIFailure(sdkError(529, undefined))).toMatchObject({ reason: "upstream", retryable: true });
        expect(classifyOpenAIFailure(sdkError(400, { message: "Unsupported parameter", code: "unsupported_parameter" })))
            .toMatchObject({ reason: "upstream", status: 400, retryable: false });
        expect(classifyOpenAIFailure(new OpenAI.APIConnectionError({ message: undefined })))
            .toMatchObject({ reason: "upstream", status: null, code: "network", retryable: true });
        expect(classifyOpenAIFailure(new OpenAI.APIConnectionTimeoutError()))
            .toMatchObject({ reason: "upstream", status: null, code: "timeout", retryable: true });
        expect(classifyOpenAIFailure(new TypeError("fetch failed"))).toMatchObject({ code: "network", retryable: true });
        // A bug in our own code is not a network blip.
        expect(classifyOpenAIFailure(new TypeError("Cannot read properties of undefined"))).toMatchObject({ retryable: false });
    });

    it("reads a failed fetch response by code and status only", async () => {
        const response = new Response(JSON.stringify({ error: QUOTA_BODY }), { status: 429, headers: { "Content-Type": "application/json" } });
        expect(await classifyOpenAIResponseFailure(response)).toMatchObject({ reason: "quota", status: 429, code: "insufficient_quota" });
        expect(await classifyOpenAIResponseFailure(new Response("not json", { status: 502 })))
            .toMatchObject({ reason: "upstream", status: 502, code: null });
    });
});

describe("callOpenAIWithRetry", () => {
    it("returns a quota failure after one attempt, with no wait", async () => {
        const call = vi.fn(async () => { throw sdkError(429, QUOTA_BODY); });
        const sleep = vi.fn(async () => {});
        const result = await callOpenAIWithRetry(call, { sleep });
        expect(result).toMatchObject({ ok: false, attempts: 1, failure: { reason: "quota" } });
        expect(call).toHaveBeenCalledTimes(1);
        expect(sleep).not.toHaveBeenCalled();
    });

    it("retries a rate limit twice with 2 s then 4 s, then gives up", async () => {
        const call = vi.fn(async () => { throw sdkError(429, RATE_LIMIT_BODY); });
        const sleep = vi.fn(async () => {});
        const onRetry = vi.fn();
        const result = await callOpenAIWithRetry(call, { sleep, onRetry });
        expect(result).toMatchObject({ ok: false, attempts: 3, failure: { reason: "rate_limit" } });
        expect(sleep.mock.calls).toEqual([[2000], [4000]]);
        expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it("recovers when the retry succeeds", async () => {
        const call = vi.fn()
            .mockRejectedValueOnce(sdkError(503, undefined))
            .mockResolvedValueOnce("ok");
        const result = await callOpenAIWithRetry(call, { sleep: async () => {} });
        expect(result).toEqual({ ok: true, value: "ok", attempts: 2 });
    });

    it("stops instead of waiting when OpenAI asks for more than 8 s", async () => {
        const call = vi.fn(async () => { throw sdkError(429, RATE_LIMIT_BODY, { "retry-after": "30" }); });
        const sleep = vi.fn(async () => {});
        const result = await callOpenAIWithRetry(call, { sleep });
        expect(result).toMatchObject({ ok: false, attempts: 1, failure: { reason: "rate_limit" } });
        expect(sleep).not.toHaveBeenCalled();
    });
});

describe("what the shopper is told", () => {
    it("is honest about an outage and keeps 'busy' for real rate limits", () => {
        expect(graceFailureNotice("quota")).toEqual({ code: "grace_unavailable", message: GRACE_UNAVAILABLE_NOTICE });
        expect(graceFailureNotice("auth")).toEqual({ code: "grace_unavailable", message: GRACE_UNAVAILABLE_NOTICE });
        expect(graceFailureNotice("rate_limit")).toEqual({ code: "grace_busy", message: GRACE_BUSY_NOTICE });
        expect(graceFailureNotice("upstream")).toEqual({ code: "grace_error", message: GRACE_ERROR_NOTICE });
        expect(graceFailureNotice("internal")).toEqual({ code: "grace_error", message: GRACE_ERROR_NOTICE });

        expect(GRACE_UNAVAILABLE_NOTICE).toContain("sales@nematinternational.com");
        expect(GRACE_UNAVAILABLE_NOTICE).toContain("1-800-936-3628");
        for (const notice of [GRACE_UNAVAILABLE_NOTICE, GRACE_BUSY_NOTICE, GRACE_ERROR_NOTICE]) {
            expect(notice).not.toMatch(/!|sorry|apolog|high demand/i);
        }
        expect(GRACE_UNAVAILABLE_NOTICE).not.toMatch(/try again/i);
    });

    it("accepts the structured reply and the plain string an older Convex deployment returns", () => {
        expect(normalizeGraceTextReply("Hello")).toEqual({ message: "Hello" });
        expect(normalizeGraceTextReply({ message: "Hello" })).toEqual({ message: "Hello" });
        const failure = { code: "grace_unavailable", reason: "quota", status: 429, openaiCode: "insufficient_quota", type: "insufficient_quota", model: "gpt-5", attempts: 1 };
        expect(normalizeGraceTextReply({ message: GRACE_UNAVAILABLE_NOTICE, failure })).toEqual({ message: GRACE_UNAVAILABLE_NOTICE, failure });
        expect(normalizeGraceTextReply("")).toBeNull();
        expect(normalizeGraceTextReply({})).toBeNull();
        expect(normalizeGraceTextReply(null)).toBeNull();
    });
});
