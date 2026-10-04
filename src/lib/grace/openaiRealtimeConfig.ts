import { classifyOpenAIResponseFailure, type GraceOpenAIFailure } from "./openaiFailure";

export const GRACE_REALTIME_MODEL = "gpt-realtime-2.1" as const;
export const GRACE_REALTIME_VOICE = "marin" as const;
// Slightly under 1.0 so speech lands clearly for older customers (Jordan,
// 2026-08-06). Range OpenAI accepts is 0.25–1.5; pair with the PACING
// instruction in realtimeInstructions.ts rather than dropping this further —
// very low values sound unnatural.
export const GRACE_REALTIME_SPEED = 0.9 as const;

export function buildGraceRealtimeSessionRequest() {
    return {
        session: {
            type: "realtime" as const,
            model: GRACE_REALTIME_MODEL,
            audio: {
                output: {
                    voice: GRACE_REALTIME_VOICE,
                    speed: GRACE_REALTIME_SPEED,
                },
            },
        },
    };
}

export class GraceRealtimeConfigError extends Error {
    constructor(
        message: string,
        readonly statusCode: number,
        /** What went wrong upstream, so the route can log it and pick an honest notice. */
        readonly failure: GraceOpenAIFailure = upstreamFailure(null),
    ) {
        super(message);
        this.name = "GraceRealtimeConfigError";
    }
}

function upstreamFailure(code: string | null, status: number | null = null): GraceOpenAIFailure {
    const retryable = code === "timeout" || code === "network";
    return { reason: "upstream", status, code, type: null, retryable, retryAfterMs: null };
}

/**
 * How long the token route waits for OpenAI to mint a client secret. The
 * browser gives up after 12 s (GraceProvider); a hung upstream used to hold
 * the request open past that, so the customer saw a timeout and the function
 * kept running.
 */
export const GRACE_REALTIME_TOKEN_TIMEOUT_MS = 8_000;

export async function createGraceRealtimeClientSecret({
    apiKey,
    fetchImpl = fetch,
    timeoutMs = GRACE_REALTIME_TOKEN_TIMEOUT_MS,
}: {
    apiKey: string | undefined;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
}): Promise<{ clientSecret: string; expiresAt: number | null }> {
    if (!apiKey?.trim()) {
        throw new GraceRealtimeConfigError("OpenAI Realtime is not configured.", 503, {
            reason: "auth",
            status: null,
            code: "missing_api_key",
            type: null,
            retryable: false,
            retryAfterMs: null,
        });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
    try {
        const response = await fetchImpl("https://api.openai.com/v1/realtime/client_secrets", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(buildGraceRealtimeSessionRequest()),
            signal: controller.signal,
        });

        if (!response.ok) {
            // Only OpenAI's error code, type and headers are read; the body's
            // wording never reaches the shopper or the logs.
            throw new GraceRealtimeConfigError(
                "OpenAI Realtime session initialization failed.",
                502,
                await classifyOpenAIResponseFailure(response),
            );
        }

        const data = await response.json() as { value?: unknown; expires_at?: unknown };
        if (typeof data.value !== "string" || data.value.length === 0) {
            throw new GraceRealtimeConfigError(
                "OpenAI did not return a valid client secret.",
                502,
                upstreamFailure("malformed_response", response.status),
            );
        }

        return {
            clientSecret: data.value,
            expiresAt: typeof data.expires_at === "number" ? data.expires_at : null,
        };
    } catch (error) {
        if (error instanceof GraceRealtimeConfigError) throw error;
        if (controller.signal.aborted) {
            throw new GraceRealtimeConfigError(
                "OpenAI Realtime took too long to respond. Please try again.",
                504,
                upstreamFailure("timeout"),
            );
        }
        const unreachable = new GraceRealtimeConfigError(
            "OpenAI Realtime could not be reached. Please try again.",
            502,
            upstreamFailure("network"),
        );
        unreachable.cause = error;
        throw unreachable;
    } finally {
        clearTimeout(timer);
    }
}
