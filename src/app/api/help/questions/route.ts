import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { createResilientConvexHttpClient } from "@/lib/convexServerClient";
import { enforceGraceRateLimit } from "@/lib/graceRateLimitServer";
import { reportError } from "@/lib/observability/report";
import { validateHelpQuestion } from "@/lib/help/questions";

/**
 * Stores a question the help center could not answer, for staff review.
 * Never logs the question or the email.
 */
export async function POST(req: NextRequest) {
    const limited = await enforceGraceRateLimit(req, { route: "help-question", limit: 5, windowMs: 10 * 60_000 });
    if (limited) return limited;

    const body = await req.json().catch(() => null);
    const checked = validateHelpQuestion(body);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) return NextResponse.json({ error: "Questions can't be received right now. Please email sales@nematinternational.com." }, { status: 503 });
    try {
        await createResilientConvexHttpClient(url).mutation(api.helpQuestions.submit, checked.value);
        return NextResponse.json({ ok: true });
    } catch (error) {
        reportError(error, { area: "help-question", level: "warning" });
        return NextResponse.json({ error: "We couldn't send that. Please try again or email sales@nematinternational.com." }, { status: 502 });
    }
}
