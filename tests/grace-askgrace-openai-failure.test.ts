// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import {
    GRACE_BUSY_NOTICE,
    GRACE_UNAVAILABLE_NOTICE,
} from "../src/lib/grace/openaiFailure";

const modules = import.meta.glob("../convex/**/*.ts");

// The real OpenAI SDK runs against a stubbed fetch, so these tests cover how
// the SDK turns OpenAI's responses into errors, and every request it sends.
const SHOPPER_TEXT = "Do you have a 9ml roll-on for jane@example.com?";
const API_KEY = "sk-test-not-a-real-key";

function openAIError(status: number, error: Record<string, unknown>, headers: Record<string, string> = {}) {
    return new Response(JSON.stringify({ error }), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
    });
}

function completion(content: string) {
    return new Response(JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 1,
        model: "gpt-5",
        choices: [{ index: 0, finish_reason: "stop", logprobs: null, message: { role: "assistant", content, refusal: null } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
}

const QUOTA = {
    message: "You exceeded your current quota, please check your plan and billing details.",
    type: "insufficient_quota",
    param: null,
    code: "insufficient_quota",
};
const RATE_LIMIT = {
    message: "Rate limit reached for gpt-5 on requests per min (RPM). Please try again in 1ms.",
    type: "requests",
    param: null,
    code: "rate_limit_exceeded",
};
// OpenAI names the wait on a rate limit; 1 ms keeps the test fast while
// still going through the real retry path.
const RETRY_NOW = { "retry-after-ms": "1" };

let fetchMock: ReturnType<typeof vi.fn>;
let errorLog: ReturnType<typeof vi.spyOn>;

const ask = () => convexTest(schema, modules).action(api.grace.askGraceReply, {
    messages: [{ role: "user", content: SHOPPER_TEXT }],
});

function openAICalls() {
    return fetchMock.mock.calls.filter(([url]) => String(url).includes("/chat/completions"));
}

function loggedFailures() {
    return errorLog.mock.calls.filter(([tag]) => tag === "[grace:openai_unavailable]");
}

describe("askGraceReply when OpenAI fails", () => {
    beforeEach(() => {
        vi.stubEnv("OPENAI_API_KEY", API_KEY);
        vi.stubEnv("TYPESAFE_API_KEY", "");
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("an exhausted credit balance is not retried, logs an error and returns the honest notice", async () => {
        fetchMock.mockImplementation(async () => openAIError(429, QUOTA));

        const reply = await ask();

        expect(openAICalls()).toHaveLength(1);
        expect(reply).toEqual({
            message: GRACE_UNAVAILABLE_NOTICE,
            failure: {
                code: "grace_unavailable",
                reason: "quota",
                status: 429,
                openaiCode: "insufficient_quota",
                type: "insufficient_quota",
                model: "gpt-5",
                attempts: 1,
            },
        });
        expect(reply.message).not.toMatch(/high demand/i);

        const logged = loggedFailures();
        expect(logged).toHaveLength(1);
        expect(logged[0][1]).toEqual({
            route: "askGrace",
            reason: "quota",
            status: 429,
            code: "insufficient_quota",
            type: "insufficient_quota",
            model: "gpt-5",
            attempts: 1,
        });
        const everythingLogged = JSON.stringify(errorLog.mock.calls);
        expect(everythingLogged).not.toContain(API_KEY);
        expect(everythingLogged).not.toContain("jane@example.com");
    });

    it("a 401 is not retried and returns the honest notice", async () => {
        fetchMock.mockImplementation(async () => openAIError(401, {
            message: "Incorrect API key provided.",
            type: "invalid_request_error",
            param: null,
            code: "invalid_api_key",
        }));

        const reply = await ask();

        expect(openAICalls()).toHaveLength(1);
        expect(reply.message).toBe(GRACE_UNAVAILABLE_NOTICE);
        expect(reply.failure).toMatchObject({ code: "grace_unavailable", reason: "auth", status: 401, openaiCode: "invalid_api_key" });
        expect(loggedFailures()).toHaveLength(1);
    });

    it("a missing key returns the honest notice without calling OpenAI", async () => {
        vi.stubEnv("OPENAI_API_KEY", "");

        const reply = await ask();

        expect(fetchMock).not.toHaveBeenCalled();
        expect(reply.failure).toMatchObject({ code: "grace_unavailable", reason: "auth", openaiCode: "missing_api_key", attempts: 0 });
        expect(loggedFailures()).toHaveLength(1);
    });

    it("a rate limit that does not clear is retried twice, then the shopper is told Grace is busy", async () => {
        fetchMock.mockImplementation(async () => openAIError(429, RATE_LIMIT, RETRY_NOW));

        const reply = await ask();

        expect(openAICalls()).toHaveLength(3);
        expect(reply.message).toBe(GRACE_BUSY_NOTICE);
        expect(reply.failure).toMatchObject({ code: "grace_busy", reason: "rate_limit", status: 429, openaiCode: "rate_limit_exceeded", attempts: 3 });
        expect(loggedFailures()).toHaveLength(1);
    });

    it("a rate limit that clears on retry gives the normal reply", async () => {
        fetchMock
            .mockResolvedValueOnce(openAIError(429, RATE_LIMIT, RETRY_NOW))
            .mockResolvedValueOnce(completion("We carry the 9 ml Cylinder roll-on."));

        const reply = await ask();

        expect(openAICalls()).toHaveLength(2);
        expect(reply).toEqual({ message: "We carry the 9 ml Cylinder roll-on." });
        expect(loggedFailures()).toHaveLength(0);
    });

    it("success is unchanged: one call, the model's words, no failure flag", async () => {
        fetchMock.mockImplementation(async () => completion("Here are three 9 ml roll-on options."));

        const t = convexTest(schema, modules);
        const args = { messages: [{ role: "user" as const, content: SHOPPER_TEXT }] };
        const reply = await t.action(api.grace.askGraceReply, args);
        const plain = await t.action(api.grace.askGrace, args);

        expect(reply).toEqual({ message: "Here are three 9 ml roll-on options." });
        // The plain-text action the eval scripts call still returns a string.
        expect(plain).toBe("Here are three 9 ml roll-on options.");
        expect(openAICalls()).toHaveLength(2);
        expect(errorLog).not.toHaveBeenCalled();
    });
});
