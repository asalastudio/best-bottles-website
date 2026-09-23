import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { CLERK_ENABLED } from "@/lib/clerk";
import { getPortalConvex, getPortalConvexWriteToken } from "@/lib/portal/convexClient";

/**
 * Transcript sync for Grace sessions.
 *
 * Deliberately NOT under /api/portal: that prefix redirects signed-out
 * requests to sign-in, and this route must answer anonymous callers with a
 * quiet 204 — Grace is public, recording is the signed-in extra.
 *
 * Identity comes from Clerk on the server, never from the request body, so
 * a client cannot write a session under someone else's account.
 */

const MESSAGE_CAP = 200;
const TEXT_MAX = 4000;

type IncomingMessage = { role: "user" | "grace"; text: string };

function parseMessages(raw: unknown): IncomingMessage[] | null {
    if (!Array.isArray(raw)) return null;
    const out: IncomingMessage[] = [];
    for (const entry of raw.slice(-MESSAGE_CAP)) {
        if (!entry || typeof entry !== "object") return null;
        const { role, text } = entry as { role?: unknown; text?: unknown };
        if (role !== "user" && role !== "grace") return null;
        if (typeof text !== "string") return null;
        const trimmed = text.trim().slice(0, TEXT_MAX);
        if (trimmed) out.push({ role, text: trimmed });
    }
    return out;
}

export async function POST(req: NextRequest) {
    if (!CLERK_ENABLED) return new NextResponse(null, { status: 204 });

    const { userId, orgId } = await auth();
    if (!userId) return new NextResponse(null, { status: 204 });

    let body: {
        sessionId?: unknown;
        ownerKey?: unknown;
        surface?: unknown;
        companionMode?: unknown;
        startedAt?: unknown;
        lastPageUrl?: unknown;
        messages?: unknown;
        ended?: unknown;
    };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const messages = parseMessages(body.messages);
    if (!sessionId || !messages || !messages.some((m) => m.role === "user")) {
        return NextResponse.json({ error: "sessionId and at least one user message are required." }, { status: 400 });
    }

    try {
        const id = await getPortalConvex().mutation(api.graceSessions.upsert, {
            writeToken: getPortalConvexWriteToken(),
            clerkUserId: userId,
            clerkOrgId: orgId ?? undefined,
            ownerKey: `user:${userId}`,
            sessionId,
            surface: typeof body.surface === "string" ? body.surface : "drawer",
            companionMode: typeof body.companionMode === "string" ? body.companionMode : "assist",
            startedAt: typeof body.startedAt === "number" && Number.isFinite(body.startedAt) ? body.startedAt : Date.now(),
            lastPageUrl: typeof body.lastPageUrl === "string" ? body.lastPageUrl : undefined,
            messages,
            ended: body.ended === true,
        });
        return NextResponse.json({ ok: true, id });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to record the session.";
        const status = message.includes("session_owned_by_other_user") ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
