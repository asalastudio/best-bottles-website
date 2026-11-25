import { NextRequest, NextResponse } from "next/server";
import { enforceGraceRateLimit } from "@/lib/graceRateLimitServer";

/** Every /api/kb/v1 response: rate-limited per caller, cacheable, CORS-open (read-only public data). */
export async function kbJson(req: NextRequest, build: () => unknown, notFound = "Not found"): Promise<NextResponse> {
    const limited = await enforceGraceRateLimit(req, { route: "kb-v1", limit: 60, windowMs: 60_000 });
    if (limited) return limited;
    const data = build();
    if (data == null) return NextResponse.json({ error: notFound }, { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
    return NextResponse.json(data, {
        headers: {
            "Cache-Control": "public, max-age=300, s-maxage=3600",
            "Access-Control-Allow-Origin": "*",
            "X-Content-Type-Options": "nosniff",
        },
    });
}
