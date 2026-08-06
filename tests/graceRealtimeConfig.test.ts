import { describe, expect, it, vi } from "vitest";
import {
    GRACE_REALTIME_MODEL,
    GRACE_REALTIME_VOICE,
    buildGraceRealtimeSessionRequest,
    createGraceRealtimeClientSecret,
} from "../src/lib/grace/openaiRealtimeConfig";

describe("Grace OpenAI Realtime configuration", () => {
    it("uses gpt-realtime-2.1 and Marin", () => {
        expect(GRACE_REALTIME_MODEL).toBe("gpt-realtime-2.1");
        expect(GRACE_REALTIME_VOICE).toBe("marin");
    });

    it("builds the fixed Realtime client-secret session request", () => {
        expect(buildGraceRealtimeSessionRequest()).toEqual({
            session: {
                type: "realtime",
                model: "gpt-realtime-2.1",
                audio: {
                    output: {
                        voice: "marin",
                    },
                },
            },
        });
    });

    it("exchanges the server API key for a short-lived client secret", async () => {
        const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
            value: "ek_test",
            expires_at: 1_786_000_000,
        }), { status: 200, headers: { "Content-Type": "application/json" } }));

        const result = await createGraceRealtimeClientSecret({
            apiKey: "sk-server-only",
            fetchImpl,
        });

        expect(result).toEqual({ clientSecret: "ek_test", expiresAt: 1_786_000_000 });
        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(fetchImpl).toHaveBeenCalledWith(
            "https://api.openai.com/v1/realtime/client_secrets",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    Authorization: "Bearer sk-server-only",
                    "Content-Type": "application/json",
                }),
                body: JSON.stringify(buildGraceRealtimeSessionRequest()),
            }),
        );
    });

    it("rejects missing server configuration and malformed upstream responses", async () => {
        await expect(createGraceRealtimeClientSecret({
            apiKey: "",
            fetchImpl: fetch,
        })).rejects.toThrow("OpenAI Realtime is not configured");

        const malformedFetch = vi.fn(async () => new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
        }));
        await expect(createGraceRealtimeClientSecret({
            apiKey: "sk-server-only",
            fetchImpl: malformedFetch,
        })).rejects.toThrow("valid client secret");
    });

    it("does not expose upstream error bodies", async () => {
        const failedFetch = vi.fn(async () => new Response("secret provider detail", { status: 500 }));

        await expect(createGraceRealtimeClientSecret({
            apiKey: "sk-server-only",
            fetchImpl: failedFetch,
        })).rejects.toThrow("OpenAI Realtime session initialization failed");
    });
});
