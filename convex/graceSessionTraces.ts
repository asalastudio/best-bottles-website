import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const OWNER_MAX = 128;
const SESSION_MAX = 80;
const TOOL_CAP = 40;
const DEST_CAP = 12;
const SUMMARY_MAX = 240;
const TRACE_CAP_PER_OWNER = 20;

const toolValidator = v.object({
    name: v.string(),
    at: v.number(),
    ok: v.boolean(),
    summary: v.optional(v.string()),
});

const destinationValidator = v.object({
    href: v.string(),
    at: v.number(),
});

const metricsValidator = v.object({
    toolsCalled: v.number(),
    cartItemsAdded: v.number(),
    navigations: v.number(),
});

function assertOwnerKey(ownerKey: string): string {
    const trimmed = ownerKey.trim();
    if (!trimmed || trimmed.length > OWNER_MAX) {
        throw new Error("Invalid owner key");
    }
    return trimmed;
}

function clip(value: string, max: number): string {
    const trimmed = value.trim();
    return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

export const record = mutation({
    args: {
        ownerKey: v.string(),
        sessionId: v.string(),
        startedAt: v.number(),
        endedAt: v.number(),
        companionMode: v.string(),
        lastPageUrl: v.optional(v.string()),
        tools: v.array(toolValidator),
        destinations: v.array(destinationValidator),
        metrics: metricsValidator,
    },
    returns: v.id("graceSessionTraces"),
    handler: async (ctx, args) => {
        const ownerKey = assertOwnerKey(args.ownerKey);
        const sessionId = clip(args.sessionId, SESSION_MAX);
        if (!sessionId) throw new Error("Session id is required");

        const existing = await ctx.db
            .query("graceSessionTraces")
            .withIndex("by_owner", (q) => q.eq("ownerKey", ownerKey))
            .take(TRACE_CAP_PER_OWNER + 5);
        if (existing.length >= TRACE_CAP_PER_OWNER) {
            const oldest = [...existing].sort((a, b) => a.endedAt - b.endedAt);
            const extra = oldest.length - (TRACE_CAP_PER_OWNER - 1);
            for (let i = 0; i < extra; i += 1) {
                const row = oldest[i];
                if (row) await ctx.db.delete(row._id);
            }
        }

        return await ctx.db.insert("graceSessionTraces", {
            ownerKey,
            sessionId,
            startedAt: args.startedAt,
            endedAt: args.endedAt,
            companionMode: clip(args.companionMode, 32),
            lastPageUrl: args.lastPageUrl ? clip(args.lastPageUrl, 400) : undefined,
            tools: args.tools.slice(0, TOOL_CAP).map((tool) => ({
                name: clip(tool.name, 64),
                at: tool.at,
                ok: tool.ok,
                ...(tool.summary ? { summary: clip(tool.summary, SUMMARY_MAX) } : {}),
            })),
            destinations: args.destinations.slice(0, DEST_CAP).map((row) => ({
                href: clip(row.href, 400),
                at: row.at,
            })),
            metrics: args.metrics,
        });
    },
});

export const listRecentByOwner = query({
    args: { ownerKey: v.string() },
    returns: v.array(v.object({
        sessionId: v.string(),
        startedAt: v.number(),
        endedAt: v.number(),
        companionMode: v.string(),
        lastPageUrl: v.optional(v.string()),
        tools: v.array(toolValidator),
        destinations: v.array(destinationValidator),
        metrics: metricsValidator,
    })),
    handler: async (ctx, args) => {
        const ownerKey = assertOwnerKey(args.ownerKey);
        const rows = await ctx.db
            .query("graceSessionTraces")
            .withIndex("by_owner", (q) => q.eq("ownerKey", ownerKey))
            .take(TRACE_CAP_PER_OWNER);
        return rows
            .sort((a, b) => b.endedAt - a.endedAt)
            .map((row) => ({
                sessionId: row.sessionId,
                startedAt: row.startedAt,
                endedAt: row.endedAt,
                companionMode: row.companionMode,
                lastPageUrl: row.lastPageUrl,
                tools: row.tools,
                destinations: row.destinations,
                metrics: row.metrics,
            }));
    },
});
