import { NextRequest, NextResponse } from "next/server";
import { enforceGraceRateLimit } from "@/lib/graceRateLimitServer";
import {
    GRACE_REALTIME_MODEL,
    GRACE_REALTIME_VOICE,
    GraceRealtimeConfigError,
    createGraceRealtimeClientSecret,
} from "@/lib/grace/openaiRealtimeConfig";

export async function GET(req: NextRequest) {
    const rateLimited = await enforceGraceRateLimit(req, {
        route: "openai-realtime-token",
        limit: 30,
        windowMs: 60_000,
    });
    if (rateLimited) return rateLimited;

    try {
        const secret = await createGraceRealtimeClientSecret({
            apiKey: process.env.OPENAI_API_KEY,
        });
        return NextResponse.json({
            ...secret,
            model: GRACE_REALTIME_MODEL,
            voice: GRACE_REALTIME_VOICE,
        });
    } catch (error) {
        const status = error instanceof GraceRealtimeConfigError ? error.statusCode : 500;
        const message = error instanceof GraceRealtimeConfigError
            ? error.message
            : "Unable to initialize Grace voice.";
        console.error("[openai/realtime-token]", error);
        return NextResponse.json({ error: message }, { status });
    }
}
