import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { enforceGraceRateLimit } from "@/lib/graceRateLimitServer";

/**
 * Grace vision endpoint — GPT-4o analyzes an uploaded reference image and
 * returns a description focused on catalog-relevant attributes (shape,
 * capacity, color, applicator). The description is then used as a
 * searchCatalog query to find matching bottles for Pattern H.
 *
 * Body:  { imageUrl: string }
 * Resp:  { description: string, searchTerms: string }
 */

const PUBLIC_VISION_UNAVAILABLE_MESSAGE =
    "Image analysis is temporarily unavailable right now. Please describe the bottle shape, color, size, or closure and Grace can search from that.";

type PublicVisionError = {
    error: string;
    code: string;
    status: number;
};

function getProviderStatus(err: unknown): number | null {
    if (!err || typeof err !== "object" || !("status" in err)) return null;
    const status = Number((err as { status?: unknown }).status);
    return Number.isFinite(status) ? status : null;
}

function getProviderMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (!err || typeof err !== "object") return "";
    const maybeMessage = (err as { message?: unknown; error?: { message?: unknown } }).message;
    if (typeof maybeMessage === "string") return maybeMessage;
    const nestedMessage = (err as { error?: { message?: unknown } }).error?.message;
    return typeof nestedMessage === "string" ? nestedMessage : "";
}

function publicVisionError(err: unknown): PublicVisionError {
    const status = getProviderStatus(err);
    const message = getProviderMessage(err);
    const lowered = message.toLowerCase();

    if (status === 401 || status === 403 || lowered.includes("api key") || lowered.includes("unauthorized")) {
        return {
            error: PUBLIC_VISION_UNAVAILABLE_MESSAGE,
            code: "vision_credentials_invalid",
            status: 503,
        };
    }

    if (status === 429 || lowered.includes("rate limit")) {
        return {
            error: "Image analysis is busy right now. Please try again in a minute.",
            code: "vision_rate_limited",
            status: 429,
        };
    }

    return {
        error: PUBLIC_VISION_UNAVAILABLE_MESSAGE,
        code: "vision_failed",
        status: 502,
    };
}

export async function POST(req: NextRequest) {
    try {
        const rateLimited = await enforceGraceRateLimit(req, {
            route: "grace-vision",
            limit: 20,
            windowMs: 60 * 60_000,
        });
        if (rateLimited) return rateLimited;

        const body = (await req.json()) as { imageUrl?: string; ownerKey?: string };
        const imageUrl = body.imageUrl?.trim();
        if (!imageUrl) {
            return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
        }
        if (!body.ownerKey || !/^(anon-[a-z0-9-]{8,}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(body.ownerKey)) {
            return NextResponse.json({ error: "Valid ownerKey required" }, { status: 400 });
        }
        let parsed: URL;
        try {
            parsed = new URL(imageUrl);
        } catch {
            return NextResponse.json({ error: "Invalid imageUrl" }, { status: 400 });
        }
        const trustedHost = parsed.protocol === "https:" && (
            parsed.hostname.endsWith(".convex.cloud") ||
            parsed.hostname.endsWith(".convex.site") ||
            parsed.hostname === new URL(process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://invalid.invalid").hostname
        );
        if (!trustedHost) {
            return NextResponse.json({ error: "Image URL must come from Grace upload storage." }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY?.trim();
        if (!apiKey) {
            return NextResponse.json(
                {
                    error: PUBLIC_VISION_UNAVAILABLE_MESSAGE,
                    code: "vision_not_configured",
                },
                { status: 503 },
            );
        }

        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 220,
            temperature: 0.2,
            messages: [
                {
                    role: "system",
                    content:
                        "You analyze packaging photos for a glass-bottle catalog search. " +
                        "Reply in two short lines:\n" +
                        "DESCRIPTION: 1-2 sentences in plain prose covering shape, color, applicator, and rough capacity.\n" +
                        "SEARCH: 4-6 keywords joined by spaces (e.g. '50ml clear cylinder fine mist sprayer'). " +
                        "Keywords should be searchable terms a wholesale bottle catalog would use — prefer 'roller' over 'roll-on', 'sprayer' over 'spray bottle'.",
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Analyze this reference image." },
                        { type: "image_url", image_url: { url: imageUrl } },
                    ],
                },
            ],
        });

        const raw = completion.choices[0]?.message?.content ?? "";
        // Parse the "DESCRIPTION: ... \n SEARCH: ..." shape.
        // [\s\S] is used instead of `.` + `s` (dotAll) flag because the `s`
        // flag requires ES2018+ and tsconfig targets ES2017.
        const descMatch = raw.match(/DESCRIPTION:\s*([\s\S]+?)(?:\n|SEARCH:|$)/i);
        const searchMatch = raw.match(/SEARCH:\s*([\s\S]+?)$/i);
        const description = (descMatch?.[1] ?? raw).trim();
        const searchTerms = (searchMatch?.[1] ?? "").trim();

        return NextResponse.json({ description, searchTerms });
    } catch (err) {
        console.error("[Grace vision] Error:", err);
        const publicError = publicVisionError(err);
        return NextResponse.json(
            { error: publicError.error, code: publicError.code },
            { status: publicError.status },
        );
    }
}
