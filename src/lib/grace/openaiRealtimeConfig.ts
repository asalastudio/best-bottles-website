export const GRACE_REALTIME_MODEL = "gpt-realtime-2.1" as const;
export const GRACE_REALTIME_VOICE = "marin" as const;

export function buildGraceRealtimeSessionRequest() {
    return {
        session: {
            type: "realtime" as const,
            model: GRACE_REALTIME_MODEL,
            audio: {
                output: {
                    voice: GRACE_REALTIME_VOICE,
                },
            },
        },
    };
}

export class GraceRealtimeConfigError extends Error {
    constructor(message: string, readonly statusCode: number) {
        super(message);
        this.name = "GraceRealtimeConfigError";
    }
}

export async function createGraceRealtimeClientSecret({
    apiKey,
    fetchImpl = fetch,
}: {
    apiKey: string | undefined;
    fetchImpl?: typeof fetch;
}): Promise<{ clientSecret: string; expiresAt: number | null }> {
    if (!apiKey?.trim()) {
        throw new GraceRealtimeConfigError("OpenAI Realtime is not configured.", 503);
    }

    const response = await fetchImpl("https://api.openai.com/v1/realtime/client_secrets", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(buildGraceRealtimeSessionRequest()),
    });

    if (!response.ok) {
        throw new GraceRealtimeConfigError("OpenAI Realtime session initialization failed.", 502);
    }

    const data = await response.json() as { value?: unknown; expires_at?: unknown };
    if (typeof data.value !== "string" || data.value.length === 0) {
        throw new GraceRealtimeConfigError("OpenAI did not return a valid client secret.", 502);
    }

    return {
        clientSecret: data.value,
        expiresAt: typeof data.expires_at === "number" ? data.expires_at : null,
    };
}
