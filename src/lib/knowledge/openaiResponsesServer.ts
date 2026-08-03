import type {
    KnowledgeCitation,
    KnowledgeRequestContext,
    KnowledgeToolCallTrace,
    KnowledgeTrace,
} from "@/lib/knowledge/contracts";
import { estimateKnowledgeCost } from "@/lib/knowledge/cost";
import { buildEmployeeKnowledgeInstructions } from "@/lib/knowledge/instructions";
import {
    type KnowledgeComplexity,
    selectKnowledgeTextModel,
} from "@/lib/knowledge/modelPolicy";
import { buildKnowledgeFileSearchTool } from "@/lib/knowledge/retrieval";
import { executeKnowledgeTool, getAuthorizedKnowledgeTools } from "@/lib/knowledge/toolRegistry";
import type { GraceOpenAIToolName } from "@/lib/knowledge/toolSchemas";
import { executeGraceServerTool } from "@/lib/grace/toolGatewayServer";

type KnowledgeMessageInput = {
    role: "user" | "assistant";
    content: string;
};

type RawResponseItem = Record<string, unknown> & {
    type?: string;
    name?: string;
    call_id?: string;
    arguments?: string;
    content?: unknown[];
};

type RawKnowledgeResponse = {
    id?: string;
    output?: RawResponseItem[];
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
        input_tokens_details?: { cached_tokens?: number };
    };
};

export type KnowledgeResponsesClient = {
    responses: {
        create: (body: Record<string, unknown>) => Promise<RawKnowledgeResponse>;
    };
};

type KnowledgeRuntimeEnvironment = Partial<Record<
    | "OPENAI_API_KEY"
    | "OPENAI_KNOWLEDGE_ROUTINE_MODEL"
    | "OPENAI_KNOWLEDGE_COMPLEX_MODEL"
    | "OPENAI_KNOWLEDGE_EXECUTIVE_MODEL"
    | "OPENAI_PUBLIC_KNOWLEDGE_VECTOR_STORE_ID"
    | "OPENAI_INTERNAL_KNOWLEDGE_VECTOR_STORE_ID"
    | "OPENAI_EXECUTIVE_KNOWLEDGE_VECTOR_STORE_ID",
    string
>>;

export type KnowledgeResponseRun = {
    text: string;
    citations: KnowledgeCitation[];
    model: string;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    fileSearchCalls: number;
    estimatedCostUsd: number;
    rateCardVersion: string;
    toolCalls: KnowledgeToolCallTrace[];
    trace: KnowledgeTrace;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
    Boolean(value) && typeof value === "object" && !Array.isArray(value)
);

function parseToolParameters(name: string, serialized: unknown): Record<string, unknown> {
    try {
        const parsed = JSON.parse(typeof serialized === "string" ? serialized : "{}");
        if (!isRecord(parsed)) throw new Error("Arguments must be an object");
        return parsed;
    } catch {
        throw new Error(`Invalid arguments for knowledge tool ${name}`);
    }
}

function extractText(output: RawResponseItem[]): string {
    const parts: string[] = [];
    for (const item of output) {
        if (item.type !== "message" || !Array.isArray(item.content)) continue;
        for (const content of item.content) {
            if (isRecord(content) && content.type === "output_text" && typeof content.text === "string") {
                parts.push(content.text);
            }
        }
    }
    return parts.join("\n").trim();
}

function citationKind(role: KnowledgeRequestContext["role"]): KnowledgeCitation["kind"] {
    if (role === "executive" || role === "admin") return "executive_document";
    if (role === "support" || role === "employee") return "internal_document";
    return "public_document";
}

function extractFileCitations(
    output: RawResponseItem[],
    role: KnowledgeRequestContext["role"],
): KnowledgeCitation[] {
    const citations = new Map<string, KnowledgeCitation>();
    for (const item of output) {
        if (!Array.isArray(item.content)) continue;
        for (const content of item.content) {
            if (!isRecord(content) || !Array.isArray(content.annotations)) continue;
            for (const annotation of content.annotations) {
                if (!isRecord(annotation) || annotation.type !== "file_citation") continue;
                const sourceId = String(annotation.file_id ?? annotation.filename ?? "approved-document");
                citations.set(sourceId, {
                    sourceId,
                    title: String(annotation.filename ?? annotation.title ?? "Approved knowledge source"),
                    kind: citationKind(role),
                });
            }
        }
    }
    return [...citations.values()];
}

async function createDefaultClient(env: KnowledgeRuntimeEnvironment): Promise<KnowledgeResponsesClient> {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY });
    return client as unknown as KnowledgeResponsesClient;
}

export async function runKnowledgeResponse({
    context,
    messages,
    complexity,
    client: injectedClient,
    executeTool: injectedExecuteTool,
    env,
}: {
    context: KnowledgeRequestContext;
    messages: KnowledgeMessageInput[];
    complexity: KnowledgeComplexity;
    client?: KnowledgeResponsesClient;
    executeTool?: (name: GraceOpenAIToolName, parameters: Record<string, unknown>) => Promise<unknown>;
    env: KnowledgeRuntimeEnvironment;
}): Promise<KnowledgeResponseRun> {
    const startedAt = Date.now();
    const model = selectKnowledgeTextModel({ role: context.role, complexity, env });
    const client = injectedClient ?? await createDefaultClient(env);
    const executeTool = injectedExecuteTool ?? ((name, parameters) => executeKnowledgeTool({
        context,
        name,
        parameters,
        execute: (authorizedName, authorizedParameters) => executeGraceServerTool({
            toolName: authorizedName,
            parameters: authorizedParameters,
        }),
    }));
    const functionTools = getAuthorizedKnowledgeTools(context).map((schema) => ({
        type: "function" as const,
        name: schema.name,
        description: schema.description,
        parameters: schema.parameters,
        strict: true,
    }));
    const fileSearchTool = buildKnowledgeFileSearchTool(context.role, env);
    const tools = fileSearchTool ? [...functionTools, fileSearchTool] : functionTools;
    const input: unknown[] = messages.map((message) => ({ ...message }));
    const toolCalls: KnowledgeToolCallTrace[] = [];
    const citations = new Map<string, KnowledgeCitation>();
    let inputTokens = 0;
    let cachedInputTokens = 0;
    let outputTokens = 0;
    let fileSearchCalls = 0;
    let toolRounds = 0;

    while (true) {
        const response = await client.responses.create({
            model,
            instructions: buildEmployeeKnowledgeInstructions(context),
            input,
            tools,
            store: false,
        });
        const output = response.output ?? [];
        inputTokens += response.usage?.input_tokens ?? 0;
        cachedInputTokens += response.usage?.input_tokens_details?.cached_tokens ?? 0;
        outputTokens += response.usage?.output_tokens ?? 0;
        fileSearchCalls += output.filter((item) => item.type === "file_search_call").length;
        for (const citation of extractFileCitations(output, context.role)) citations.set(citation.sourceId, citation);

        const functionCalls = output.filter((item) => item.type === "function_call");
        if (functionCalls.length === 0) {
            const text = extractText(output);
            const completedAt = Date.now();
            const cost = estimateKnowledgeCost({
                model,
                inputTokens,
                cachedInputTokens,
                outputTokens,
                audioInputTokens: 0,
                audioOutputTokens: 0,
                fileSearchCalls,
            });
            const trace: KnowledgeTrace = {
                requestId: context.requestId,
                conversationId: context.conversationId,
                surface: context.surface,
                role: context.role,
                model,
                startedAt,
                completedAt,
                durationMs: completedAt - startedAt,
                status: text ? "success" : "no_match",
                inputTokens,
                cachedInputTokens,
                outputTokens,
                audioInputTokens: 0,
                audioOutputTokens: 0,
                fileSearchCalls,
                estimatedCostUsd: cost.estimatedCostUsd,
                rateCardVersion: cost.rateCardVersion,
                toolCalls,
                sourceIds: [...citations.keys()],
                rawContentStored: false,
            };
            return {
                text,
                citations: [...citations.values()],
                model,
                inputTokens,
                cachedInputTokens,
                outputTokens,
                fileSearchCalls,
                estimatedCostUsd: cost.estimatedCostUsd,
                rateCardVersion: cost.rateCardVersion,
                toolCalls,
                trace,
            };
        }

        if (toolRounds >= 6) throw new Error("Knowledge response exceeded 6 tool rounds");
        const toolOutputs: Array<Record<string, unknown>> = [];
        for (const call of functionCalls) {
            const name = String(call.name ?? "") as GraceOpenAIToolName;
            const parameters = parseToolParameters(name, call.arguments);
            const callStartedAt = Date.now();
            try {
                const result = await executeTool(name, parameters);
                toolCalls.push({ name, durationMs: Date.now() - callStartedAt, status: "success" });
                const sourceId = `convex:${name}`;
                citations.set(sourceId, {
                    sourceId,
                    title: `Live Convex product truth · ${name}`,
                    kind: "product_truth",
                });
                toolOutputs.push({
                    type: "function_call_output",
                    call_id: String(call.call_id ?? ""),
                    output: JSON.stringify(result),
                });
            } catch (error) {
                toolCalls.push({
                    name,
                    durationMs: Date.now() - callStartedAt,
                    status: error instanceof Error && error.message.startsWith("Knowledge tool blocked:") ? "blocked" : "error",
                });
                throw error;
            }
        }
        toolRounds += 1;
        input.push(...output, ...toolOutputs);
    }
}
