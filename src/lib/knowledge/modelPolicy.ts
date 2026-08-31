import type { KnowledgeActorRole } from "@/lib/knowledge/contracts";

export type KnowledgeComplexity = "routine" | "complex" | "exceptional";

type KnowledgeModelEnvironment = Partial<Record<
    | "OPENAI_KNOWLEDGE_ROUTINE_MODEL"
    | "OPENAI_KNOWLEDGE_COMPLEX_MODEL"
    | "OPENAI_KNOWLEDGE_EXECUTIVE_MODEL",
    string
>>;

export function selectKnowledgeTextModel({
    role,
    complexity,
    env,
}: {
    role: KnowledgeActorRole;
    complexity: KnowledgeComplexity;
    env: KnowledgeModelEnvironment;
}): string {
    const routineModel = env.OPENAI_KNOWLEDGE_ROUTINE_MODEL || "gpt-5.6-luna";
    const complexModel = env.OPENAI_KNOWLEDGE_COMPLEX_MODEL || "gpt-5.6-terra";
    const executiveModel = env.OPENAI_KNOWLEDGE_EXECUTIVE_MODEL || "gpt-5.6-sol";

    if (complexity === "routine") return routineModel;
    if (complexity === "complex") return complexModel;
    return role === "executive" || role === "admin" ? executiveModel : complexModel;
}
