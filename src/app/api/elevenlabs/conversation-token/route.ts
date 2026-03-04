import { NextResponse } from "next/server";

/**
 * Fetches a WebRTC conversation token from ElevenLabs.
 * Use this for low-latency voice (WebRTC) instead of signed URL (WebSocket).
 */
export async function GET() {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;

    if (!apiKey || !agentId) {
        return NextResponse.json(
            { error: "ElevenLabs API key or Agent ID not configured" },
            { status: 503 }
        );
    }

    try {
        const response = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
            {
                headers: {
                    "xi-api-key": apiKey,
                },
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error("[elevenlabs/conversation-token] ElevenLabs error:", response.status, errText);
            let detail = "Failed to get conversation token from ElevenLabs";
            try {
                const errJson = JSON.parse(errText) as {
                    detail?: string | { status?: string; message?: string };
                };
                const d = errJson.detail;
                if (typeof d === "string") detail = d;
                else if (d && typeof d === "object" && d.message) detail = d.message;
                else if (d && typeof d === "object" && d.status)
                    detail = `${d.status}: ${d.message ?? ""}`.trim();
            } catch {
                if (response.status === 401) detail = "Invalid API key. Check ELEVENLABS_API_KEY.";
                else if (response.status === 404)
                    detail =
                        "Agent not found. Check ELEVENLABS_AGENT_ID.";
            }
            return NextResponse.json({ error: detail }, { status: 502 });
        }

        const data = (await response.json()) as { token?: string };
        if (!data.token) {
            return NextResponse.json(
                { error: "ElevenLabs did not return a conversation token" },
                { status: 502 }
            );
        }

        return NextResponse.json({ token: data.token });
    } catch (err) {
        console.error("[elevenlabs/conversation-token] Error:", err);
        return NextResponse.json(
            { error: "Internal error generating conversation token" },
            { status: 500 }
        );
    }
}
