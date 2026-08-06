import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";

import { api } from "../../../../../convex/_generated/api";
import { getUserEmailAddresses, hasExecutiveHubAccess } from "@/lib/teamAccess";
import {
    GRACE_AUDIT_SCENARIOS,
    runAuditScenario,
    estimateAuditCostUsd,
} from "@/lib/grace/auditRunner";
import type { Id } from "../../../../../convex/_generated/dataModel";

/**
 * Executive-hub Grace audit control plane.
 *
 * One scenario per request: a full conversation audit takes 10–20 minutes,
 * far beyond any single serverless invocation, so the dashboard drives the run
 * step by step and Convex holds the state. That also makes a run resumable and
 * keeps one bad scenario from killing the whole audit.
 *
 * Actions: plan | start | step | finish
 */

export const maxDuration = 300;

function convex() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured.");
    return new ConvexHttpClient(url);
}

async function requireExecutive() {
    const { userId } = await auth();
    if (!userId) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    const user = await currentUser();
    const emailAddresses = getUserEmailAddresses(user);
    if (!hasExecutiveHubAccess(user?.publicMetadata, { emailAddresses })) {
        return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return { ok: true as const, userId };
}

export async function POST(req: NextRequest) {
    const gate = await requireExecutive();
    if (!gate.ok) return gate.response;

    let body: Record<string, unknown>;
    try {
        body = (await req.json()) as Record<string, unknown>;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const action = String(body.action ?? "");

    try {
        if (action === "plan") {
            return NextResponse.json({
                scenarios: GRACE_AUDIT_SCENARIOS.map((s) => ({ id: s.id, group: s.group, title: s.title, turns: s.turns.length })),
                estimatedCostUsd: estimateAuditCostUsd(),
                environment: process.env.NEXT_PUBLIC_CONVEX_URL ?? "unknown",
            });
        }

        if (action === "start") {
            const runId = await convex().mutation(api.graceAudit.startRun, {
                kind: "conversation",
                triggeredBy: gate.userId,
                environment: process.env.NEXT_PUBLIC_CONVEX_URL ?? "unknown",
                scenarioTotal: GRACE_AUDIT_SCENARIOS.length,
            });
            return NextResponse.json({
                runId,
                scenarioIds: GRACE_AUDIT_SCENARIOS.map((s) => s.id),
            });
        }

        if (action === "step") {
            const runId = String(body.runId ?? "");
            const scenarioId = String(body.scenarioId ?? "");
            if (!runId || !scenarioId) {
                return NextResponse.json({ error: "runId and scenarioId are required" }, { status: 400 });
            }

            const result = await runAuditScenario(scenarioId);

            const totals = await convex().mutation(api.graceAudit.recordResult, {
                runId: runId as Id<"graceAuditRuns">,
                scenarioId: result.scenarioId,
                group: result.group,
                title: result.title,
                verdict: result.verdict,
                checks: result.checks,
                transcript: result.transcript.map((t) => ({
                    user: t.user,
                    assistant: t.assistant,
                    toolCalls: t.toolCalls.map((c) => ({
                        name: c.name,
                        argsJson: JSON.stringify(c.args).slice(0, 800),
                        executed: c.executed,
                    })),
                })),
                toolCallCount: result.toolCallCount,
                durationMs: result.durationMs,
                error: result.error,
            });

            return NextResponse.json({ result: { ...result, transcript: undefined }, totals });
        }

        if (action === "finish") {
            const runId = String(body.runId ?? "");
            if (!runId) return NextResponse.json({ error: "runId is required" }, { status: 400 });
            const status = body.status === "cancelled" ? "cancelled" : "complete";
            await convex().mutation(api.graceAudit.finishRun, {
                runId: runId as Id<"graceAuditRuns">,
                status,
                notes: typeof body.notes === "string" ? body.notes : null,
            });
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    } catch (error) {
        console.error("[executive/grace-audit]", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Audit request failed" },
            { status: 500 },
        );
    }
}
