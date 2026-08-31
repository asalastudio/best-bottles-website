import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Grace audit persistence.
 *
 * Runs are written one scenario at a time. That keeps every request far inside
 * the serverless timeout, makes a run resumable, and lets the executive
 * dashboard subscribe to progress instead of polling.
 */

const verdict = v.union(v.literal("pass"), v.literal("warn"), v.literal("fail"));

export const startRun = mutation({
    args: {
        kind: v.union(v.literal("conversation"), v.literal("integrity")),
        triggeredBy: v.string(),
        environment: v.string(),
        scenarioTotal: v.number(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("graceAuditRuns", {
            kind: args.kind,
            status: "running",
            startedAt: Date.now(),
            finishedAt: null,
            triggeredBy: args.triggeredBy,
            environment: args.environment,
            scenarioTotal: args.scenarioTotal,
            scenarioComplete: 0,
            passCount: 0,
            warnCount: 0,
            failCount: 0,
            scorePct: null,
            notes: null,
        });
    },
});

export const recordResult = mutation({
    args: {
        runId: v.id("graceAuditRuns"),
        scenarioId: v.string(),
        group: v.string(),
        title: v.string(),
        verdict,
        checks: v.array(v.object({
            label: v.string(),
            passed: v.boolean(),
            severity: v.union(v.literal("critical"), v.literal("soft")),
            detail: v.string(),
        })),
        transcript: v.array(v.object({
            user: v.string(),
            assistant: v.string(),
            toolCalls: v.array(v.object({
                name: v.string(),
                argsJson: v.string(),
                executed: v.string(),
            })),
        })),
        toolCallCount: v.number(),
        durationMs: v.number(),
        error: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        const run = await ctx.db.get(args.runId);
        if (!run) throw new Error("Audit run not found.");

        // Re-running a scenario replaces its previous result rather than
        // double-counting it in the run totals.
        const existing = await ctx.db
            .query("graceAuditResults")
            .withIndex("by_runId_scenarioId", (q) => q.eq("runId", args.runId).eq("scenarioId", args.scenarioId))
            .first();

        const { runId: _runId, ...row } = args;
        if (existing) {
            await ctx.db.patch(existing._id, { ...row, createdAt: Date.now() });
        } else {
            await ctx.db.insert("graceAuditResults", { ...args, createdAt: Date.now() });
        }

        const all = await ctx.db
            .query("graceAuditResults")
            .withIndex("by_runId", (q) => q.eq("runId", args.runId))
            .collect();

        const passCount = all.filter((r) => r.verdict === "pass").length;
        const warnCount = all.filter((r) => r.verdict === "warn").length;
        const failCount = all.filter((r) => r.verdict === "fail").length;
        // Warns are half credit: they are real gaps but not customer-facing errors.
        const scorePct = all.length > 0
            ? Math.round(((passCount + warnCount * 0.5) / all.length) * 100)
            : null;

        await ctx.db.patch(args.runId, {
            scenarioComplete: all.length,
            passCount,
            warnCount,
            failCount,
            scorePct,
        });

        return { scenarioComplete: all.length, passCount, warnCount, failCount, scorePct };
    },
});

export const finishRun = mutation({
    args: {
        runId: v.id("graceAuditRuns"),
        status: v.union(v.literal("complete"), v.literal("failed"), v.literal("cancelled")),
        notes: v.optional(v.union(v.string(), v.null())),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.runId, {
            status: args.status,
            finishedAt: Date.now(),
            notes: args.notes ?? null,
        });
    },
});

export const getRun = query({
    args: { runId: v.id("graceAuditRuns") },
    handler: async (ctx, args) => {
        const run = await ctx.db.get(args.runId);
        if (!run) return null;
        const results = await ctx.db
            .query("graceAuditResults")
            .withIndex("by_runId", (q) => q.eq("runId", args.runId))
            .collect();
        results.sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));
        return { run, results };
    },
});

export const listRuns = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("graceAuditRuns")
            .withIndex("by_startedAt")
            .order("desc")
            .take(Math.min(args.limit ?? 10, 50));
    },
});

export const latestRun = query({
    args: { kind: v.optional(v.union(v.literal("conversation"), v.literal("integrity"))) },
    handler: async (ctx, args) => {
        const runs = await ctx.db.query("graceAuditRuns").withIndex("by_startedAt").order("desc").take(25);
        const run = args.kind ? runs.find((r) => r.kind === args.kind) : runs[0];
        if (!run) return null;
        const results = await ctx.db
            .query("graceAuditResults")
            .withIndex("by_runId", (q) => q.eq("runId", run._id))
            .collect();
        results.sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));
        return { run, results };
    },
});
