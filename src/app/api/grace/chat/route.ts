import { NextRequest, NextResponse } from "next/server";
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { createResilientConvexHttpClient } from "@/lib/convexServerClient";
import { enforceGraceRateLimit } from "@/lib/graceRateLimitServer";
import { reportError } from "@/lib/observability/report";
import { normalizeGraceTextReply } from "@/lib/grace/openaiFailure";
import { reportGraceOpenAIFailure } from "@/lib/grace/reportOpenAIFailure";

type ChatMessage = { role: "user" | "assistant"; content: string };

let convexClient: ConvexHttpClient | null = null;

function getConvex() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured.");
    convexClient ??= createResilientConvexHttpClient(url);
    return convexClient;
}

function normalizeMessages(value: unknown): ChatMessage[] {
    if (!Array.isArray(value)) return [];
    return value.slice(-30).flatMap((entry): ChatMessage[] => {
        if (!entry || typeof entry !== "object") return [];
        const record = entry as Record<string, unknown>;
        if (record.role !== "user" && record.role !== "assistant") return [];
        if (typeof record.content !== "string" || !record.content.trim()) return [];
        return [{ role: record.role, content: record.content.trim().slice(0, 4000) }];
    });
}

export async function POST(req: NextRequest) {
    const rateLimited = await enforceGraceRateLimit(req, {
        route: "grace-openai-chat",
        limit: 20,
        windowMs: 60_000,
    });
    if (rateLimited) return rateLimited;

    try {
        const body = await req.json() as { messages?: unknown; pageContextBlock?: unknown };
        const messages = normalizeMessages(body.messages);
        if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
            return NextResponse.json({ error: "A user message is required." }, { status: 400 });
        }

        const raw: unknown = await getConvex().action(api.grace.askGraceReply, {
            messages,
            voiceMode: false,
            pageContextBlock: typeof body.pageContextBlock === "string"
                ? body.pageContextBlock.slice(0, 2000)
                : undefined,
        });
        const reply = normalizeGraceTextReply(raw);
        if (!reply) throw new Error("askGraceReply returned no message.");
        if (!reply.failure) return NextResponse.json({ message: reply.message });

        // The turn failed. Report it (Convex has no Sentry) and answer with a
        // non-2xx status, the honest notice and a stable code, so the panel
        // shows a system notice instead of presenting it as Grace's reply.
        const { failure } = reply;
        if (failure.reason === "internal") {
            reportError(new Error("Grace text turn failed inside askGraceReply."), {
                area: "grace-chat",
                tags: { mode: "text", reason: failure.reason },
            });
        } else {
            reportGraceOpenAIFailure(
                { reason: failure.reason, status: failure.status, code: failure.openaiCode, type: failure.type },
                { route: "grace-chat", model: failure.model, attempts: failure.attempts },
            );
        }
        return NextResponse.json(
            { error: reply.message, code: failure.code, reason: failure.reason },
            {
                status: failure.code === "grace_error" ? 502 : 503,
                headers: failure.code === "grace_busy" ? { "Retry-After": "5" } : undefined,
            },
        );
    } catch (error) {
        reportError(error, { area: "grace-chat", tags: { mode: "text" } });
        return NextResponse.json({ error: "Grace is temporarily unavailable." }, { status: 502 });
    }
}
