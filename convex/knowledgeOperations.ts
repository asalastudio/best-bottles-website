import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { summarizeKnowledgeTraces } from "../src/lib/knowledge/operations";

const surface = v.union(
    v.literal("storefront"),
    v.literal("customer_portal"),
    v.literal("employee_workspace"),
    v.literal("executive_hub"),
    v.literal("chatgpt_app"),
);

function verifyWriteToken(token: string) {
    const expected = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!expected || token !== expected) throw new Error("Unauthorized knowledge operation");
}

export const recordKnowledgeTrace = mutation({
    args: {
        token: v.string(),
        trace: v.object({
            requestId: v.string(),
            conversationId: v.string(),
            surface,
            role: v.union(
                v.literal("public"),
                v.literal("customer"),
                v.literal("support"),
                v.literal("employee"),
                v.literal("executive"),
                v.literal("admin"),
            ),
            model: v.string(),
            startedAt: v.number(),
            completedAt: v.number(),
            durationMs: v.number(),
            status: v.union(
                v.literal("success"),
                v.literal("no_match"),
                v.literal("tool_error"),
                v.literal("model_error"),
                v.literal("blocked"),
            ),
            inputTokens: v.number(),
            cachedInputTokens: v.number(),
            outputTokens: v.number(),
            audioInputTokens: v.number(),
            audioOutputTokens: v.number(),
            fileSearchCalls: v.number(),
            estimatedCostUsd: v.number(),
            rateCardVersion: v.string(),
            toolCalls: v.array(v.object({
                name: v.string(),
                durationMs: v.number(),
                status: v.union(v.literal("success"), v.literal("error"), v.literal("blocked")),
            })),
            sourceIds: v.array(v.string()),
            rawContentStored: v.literal(false),
        }),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.token);
        return ctx.db.insert("knowledgeTraces", args.trace);
    },
});

export const submitKnowledgeCorrection = mutation({
    args: {
        token: v.string(),
        correction: v.object({
            conversationId: v.string(),
            messageId: v.string(),
            actorId: v.string(),
            surface,
            category: v.union(
                v.literal("product_truth"),
                v.literal("compatibility"),
                v.literal("policy"),
                v.literal("behavior"),
                v.literal("missing_knowledge"),
            ),
            correction: v.string(),
            sourceUrl: v.union(v.string(), v.null()),
        }),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.token);
        const now = Date.now();
        return ctx.db.insert("knowledgeCorrections", {
            ...args.correction,
            status: "pending",
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const getKnowledgeOperationsSummary = query({
    args: { token: v.string(), since: v.number() },
    handler: async (ctx, args) => {
        verifyWriteToken(args.token);
        const traces = await ctx.db
            .query("knowledgeTraces")
            .withIndex("by_completedAt", (q) => q.gte("completedAt", args.since))
            .collect();
        const pendingCorrections = await ctx.db
            .query("knowledgeCorrections")
            .withIndex("by_status", (q) => q.eq("status", "pending"))
            .collect();
        return summarizeKnowledgeTraces(traces.map((trace) => ({
            status: trace.status,
            estimatedCostUsd: trace.estimatedCostUsd,
            durationMs: trace.durationMs,
            toolCalls: trace.toolCalls,
        })), pendingCorrections.length);
    },
});
