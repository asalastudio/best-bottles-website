import type { KnowledgeActorRole } from "@/lib/knowledge/contracts";

export type KnowledgeDocumentAudience = "public" | "customer" | "employee" | "executive";

export type KnowledgeDocumentRecord = {
    sourceId: string;
    title: string;
    audience: KnowledgeDocumentAudience;
    version: string;
    approvedAt: number;
    expiresAt: number | null;
};

type KnowledgeVectorStoreEnvironment = Partial<Record<
    | "OPENAI_PUBLIC_KNOWLEDGE_VECTOR_STORE_ID"
    | "OPENAI_INTERNAL_KNOWLEDGE_VECTOR_STORE_ID"
    | "OPENAI_EXECUTIVE_KNOWLEDGE_VECTOR_STORE_ID",
    string
>>;

const compact = (values: Array<string | undefined>): string[] => (
    values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))
);

export function getKnowledgeVectorStoreIds(
    role: KnowledgeActorRole,
    env: KnowledgeVectorStoreEnvironment,
): string[] {
    const publicStore = env.OPENAI_PUBLIC_KNOWLEDGE_VECTOR_STORE_ID;
    const internalStore = env.OPENAI_INTERNAL_KNOWLEDGE_VECTOR_STORE_ID;
    const executiveStore = env.OPENAI_EXECUTIVE_KNOWLEDGE_VECTOR_STORE_ID;

    if (role === "public" || role === "customer") return compact([publicStore]);
    if (role === "support" || role === "employee") return compact([publicStore, internalStore]);
    return compact([publicStore, internalStore, executiveStore]);
}

export function buildKnowledgeFileSearchTool(
    role: KnowledgeActorRole,
    env: KnowledgeVectorStoreEnvironment,
) {
    const vectorStoreIds = getKnowledgeVectorStoreIds(role, env);
    if (vectorStoreIds.length === 0) return null;

    return {
        type: "file_search" as const,
        vector_store_ids: vectorStoreIds,
        max_num_results: 6,
    };
}
