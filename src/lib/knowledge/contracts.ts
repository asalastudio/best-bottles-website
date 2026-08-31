import type { GraceRefineState } from "@/lib/grace/refineState";

export type KnowledgeSurface =
    | "storefront"
    | "customer_portal"
    | "employee_workspace"
    | "executive_hub"
    | "chatgpt_app";

export type KnowledgeActorRole =
    | "public"
    | "customer"
    | "support"
    | "employee"
    | "executive"
    | "admin";

export type KnowledgeScope =
    | "catalog.read"
    | "compatibility.read"
    | "public_knowledge.read"
    | "cart.propose"
    | "navigation.propose"
    | "customer_project.read.self"
    | "customer_project.write.self"
    | "internal_knowledge.read"
    | "executive_metrics.read"
    | "correction.submit"
    | "trace.read";

export type KnowledgeRequestContext = {
    surface: KnowledgeSurface;
    role: KnowledgeActorRole;
    actorId: string | null;
    organizationId: string | null;
    conversationId: string;
    projectId: string | null;
    refineState: GraceRefineState | null;
    requestId: string;
};

export type KnowledgeCitation = {
    sourceId: string;
    title: string;
    kind: "product_truth" | "public_document" | "internal_document" | "executive_document";
    url?: string;
};

export type KnowledgeResponse = {
    text: string;
    citations: KnowledgeCitation[];
    verified: boolean;
};

export type KnowledgeToolCallTrace = {
    name: string;
    durationMs: number;
    status: "success" | "error" | "blocked";
};

export type KnowledgeTraceStatus =
    | "success"
    | "no_match"
    | "tool_error"
    | "model_error"
    | "blocked";

export type KnowledgeTrace = {
    requestId: string;
    conversationId: string;
    surface: KnowledgeSurface;
    role: KnowledgeActorRole;
    model: string;
    startedAt: number;
    completedAt: number;
    durationMs: number;
    status: KnowledgeTraceStatus;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    audioInputTokens: number;
    audioOutputTokens: number;
    fileSearchCalls: number;
    estimatedCostUsd: number;
    rateCardVersion: string;
    toolCalls: KnowledgeToolCallTrace[];
    sourceIds: string[];
    rawContentStored: false;
};

export type KnowledgeCorrection = {
    conversationId: string;
    messageId: string;
    requestId: string;
    actorId: string;
    surface: KnowledgeSurface;
    category: "product_truth" | "compatibility" | "policy" | "behavior" | "missing_knowledge";
    correction: string;
    sourceUrl: string | null;
    answerExcerpt: string;
    sourceIds: string[];
    status: "pending" | "accepted" | "rejected";
    createdAt: number;
};
