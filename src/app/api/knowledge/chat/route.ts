import type { KnowledgeCitation, KnowledgeRequestContext, KnowledgeTrace } from "@/lib/knowledge/contracts";
import { deriveEmployeeKnowledgeContext } from "@/lib/knowledge/requestContextServer";
import {
    KnowledgeResponseExecutionError,
    runKnowledgeResponse,
    type KnowledgeRuntimeEnvironment,
} from "@/lib/knowledge/openaiResponsesServer";
import { persistKnowledgeTrace } from "@/lib/knowledge/operationsServer";
import { selectKnowledgeTextModel } from "@/lib/knowledge/modelPolicy";
import { KNOWLEDGE_RATE_CARD } from "@/lib/knowledge/cost";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ChatRunResult = {
    text: string;
    citations: KnowledgeCitation[];
    model: string;
    trace: KnowledgeTrace;
};

type KnowledgeChatDependencies = {
    deriveContext: (args: { conversationId?: string | null }) => Promise<KnowledgeRequestContext>;
    run: (args: {
        context: KnowledgeRequestContext;
        messages: ChatMessage[];
        complexity: "routine" | "complex" | "exceptional";
        env: KnowledgeRuntimeEnvironment;
    }) => Promise<ChatRunResult>;
    persist: (trace: KnowledgeTrace) => Promise<void>;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
});

function normalizeMessages(value: unknown, singleMessage: unknown): ChatMessage[] {
    const source = Array.isArray(value) ? value : [];
    const normalized = source.flatMap((entry): ChatMessage[] => {
        if (!entry || typeof entry !== "object") return [];
        const record = entry as Record<string, unknown>;
        if (record.role !== "user" && record.role !== "assistant") return [];
        if (typeof record.content !== "string" || !record.content.trim()) return [];
        return [{ role: record.role, content: record.content.trim().slice(0, 4000) }];
    });
    if (typeof singleMessage === "string" && singleMessage.trim()) {
        normalized.push({ role: "user", content: singleMessage.trim().slice(0, 4000) });
    }
    return normalized.slice(-20);
}

function inferComplexity(messages: ChatMessage[]): "routine" | "complex" | "exceptional" {
    const request = messages.at(-1)?.content.toLowerCase() ?? "";
    if (/\b(executive synthesis|company-wide strategy|board analysis|cross-functional forecast)\b/.test(request)) {
        return "exceptional";
    }
    if (messages.length > 8 || request.length > 700 || /\b(compare|analyze|investigate|summarize)\b/.test(request)) {
        return "complex";
    }
    return "routine";
}

export function createKnowledgeChatHandler(dependencies: KnowledgeChatDependencies) {
    return async function knowledgeChatHandler(request: Request): Promise<Response> {
        let body: Record<string, unknown>;
        try {
            const parsed = await request.json();
            body = parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? parsed as Record<string, unknown>
                : {};
        } catch {
            return json({ error: "A valid JSON body is required." }, 400);
        }

        const messages = normalizeMessages(body.messages, body.message);
        if (messages.length === 0 || messages.at(-1)?.role !== "user") {
            return json({ error: "A user message is required." }, 400);
        }

        let context: KnowledgeRequestContext;
        try {
            context = await dependencies.deriveContext({
                conversationId: typeof body.conversationId === "string" ? body.conversationId : null,
            });
        } catch {
            return json({ error: "Forbidden" }, 403);
        }

        const startedAt = Date.now();
        const complexity = inferComplexity(messages);
        try {
            const run = await dependencies.run({
                context,
                messages,
                complexity,
                env: process.env as KnowledgeRuntimeEnvironment,
            });
            try {
                await dependencies.persist(run.trace);
            } catch (persistenceError) {
                console.error("[knowledge/chat] trace persistence failed", {
                    requestId: context.requestId,
                    error: persistenceError instanceof Error ? persistenceError.name : "unknown",
                });
            }
            return json({
                message: run.text,
                citations: run.citations,
                requestId: context.requestId,
                model: run.model,
            });
        } catch (error) {
            console.error("[knowledge/chat] model failure", {
                requestId: context.requestId,
                error: error instanceof Error ? error.name : "unknown",
            });
            const completedAt = Date.now();
            const errorTrace: KnowledgeTrace = error instanceof KnowledgeResponseExecutionError
                ? error.trace
                : {
                requestId: context.requestId,
                conversationId: context.conversationId,
                surface: context.surface,
                role: context.role,
                model: selectKnowledgeTextModel({
                    role: context.role,
                    complexity,
                    env: process.env as KnowledgeRuntimeEnvironment,
                }),
                startedAt,
                completedAt,
                durationMs: completedAt - startedAt,
                status: "model_error",
                inputTokens: 0,
                cachedInputTokens: 0,
                outputTokens: 0,
                audioInputTokens: 0,
                audioOutputTokens: 0,
                fileSearchCalls: 0,
                estimatedCostUsd: 0,
                rateCardVersion: KNOWLEDGE_RATE_CARD.version,
                toolCalls: [],
                sourceIds: [],
                rawContentStored: false,
                };
            try {
                await dependencies.persist(errorTrace);
            } catch {
                // The public response remains generic even if operations persistence is unavailable.
            }
            return json({ error: "Grace is temporarily unavailable." }, 502);
        }
    };
}

export const POST = createKnowledgeChatHandler({
    deriveContext: deriveEmployeeKnowledgeContext,
    run: runKnowledgeResponse,
    persist: persistKnowledgeTrace,
});
