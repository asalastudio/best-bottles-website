import { NextRequest, NextResponse } from "next/server";
import { enforceGraceRateLimit } from "@/lib/graceRateLimitServer";
import {
    executeGraceServerTool,
    type GraceServerToolName,
} from "@/lib/grace/toolGatewayServer";

/**
 * Same-origin HTTP adapter retained for Grace's browser-based tool calls.
 * Authorization for internal Responses calls happens in the shared registry;
 * this adapter preserves the existing browser secret and rate-limit boundary.
 */
export async function POST(req: NextRequest) {
    try {
        const expectedSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
        if (expectedSecret) {
            const originHeader = req.headers.get("origin");
            const hostHeader = req.headers.get("host");
            let isSameOrigin = false;
            if (originHeader && hostHeader) {
                try {
                    isSameOrigin = new URL(originHeader).host === hostHeader;
                } catch { /* malformed origin */ }
            }
            if (!isSameOrigin && req.headers.get("x-webhook-secret") !== expectedSecret) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        const rateLimited = await enforceGraceRateLimit(req, {
            route: "grace-server-tools",
            limit: 120,
            windowMs: 60_000,
        });
        if (rateLimited) return rateLimited;

        const body = (await req.json()) as {
            tool_name?: GraceServerToolName;
            parameters?: Record<string, unknown>;
        };
        if (!body.tool_name) {
            return NextResponse.json({ error: "Missing tool_name" }, { status: 400 });
        }

        const result = await executeGraceServerTool({
            toolName: body.tool_name,
            parameters: body.parameters,
        });
        return NextResponse.json({ result });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.startsWith("Unknown tool:")) {
            return NextResponse.json({ error: message }, { status: 400 });
        }
        console.error("[Grace server-tool] Error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
