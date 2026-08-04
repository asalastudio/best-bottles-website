import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { enforceGraceRateLimit } from "@/lib/graceRateLimitServer";

type ChatMessage = { role: "user" | "assistant"; content: string };

let convexClient: ConvexHttpClient | null = null;

function getConvex() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured.");
    convexClient ??= new ConvexHttpClient(url);
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

        const message = await getConvex().action(api.grace.askGrace, {
            messages,
            voiceMode: false,
            pageContextBlock: typeof body.pageContextBlock === "string"
                ? body.pageContextBlock.slice(0, 2000)
                : undefined,
        });
        return NextResponse.json({ message });
    } catch (error) {
        console.error("[grace/chat]", error);
        return NextResponse.json({ error: "Grace is temporarily unavailable." }, { status: 502 });
    }
}
