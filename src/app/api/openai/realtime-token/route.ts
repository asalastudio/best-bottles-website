import { NextRequest, NextResponse } from "next/server";
import { enforceGraceRateLimit } from "@/lib/graceRateLimitServer";
import {
    GRACE_REALTIME_MODEL,
    GRACE_REALTIME_VOICE,
    GraceRealtimeConfigError,
    createGraceRealtimeClientSecret,
} from "@/lib/grace/openaiRealtimeConfig";
import { classifyOpenAIFailure, graceFailureNotice } from "@/lib/grace/openaiFailure";
import { reportGraceOpenAIFailure } from "@/lib/grace/reportOpenAIFailure";

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
        const failure = error instanceof GraceRealtimeConfigError ? error.failure : classifyOpenAIFailure(error);
        reportGraceOpenAIFailure(failure, { route: "realtime-token", model: GRACE_REALTIME_MODEL });
        // `error` is what the Grace panel shows, so it carries the honest
        // notice; `code` and `reason` are stable for the UI and for monitoring.
        const notice = graceFailureNotice(failure.reason);
        return NextResponse.json(
            { error: notice.message, code: notice.code, reason: failure.reason },
            { status },
        );
    }
}
