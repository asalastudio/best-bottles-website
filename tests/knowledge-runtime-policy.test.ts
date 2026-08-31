import { describe, expect, it } from "vitest";
import { selectKnowledgeTextModel } from "../src/lib/knowledge/modelPolicy";
import { buildKnowledgeFileSearchTool, getKnowledgeVectorStoreIds } from "../src/lib/knowledge/retrieval";
import { estimateKnowledgeCost } from "../src/lib/knowledge/cost";

describe("knowledge runtime policy", () => {
    it("uses Luna for routine work and reserves Sol for executive synthesis", () => {
        expect(selectKnowledgeTextModel({ role: "employee", complexity: "routine", env: {} })).toBe("gpt-5.6-luna");
        expect(selectKnowledgeTextModel({ role: "support", complexity: "complex", env: {} })).toBe("gpt-5.6-terra");
        expect(selectKnowledgeTextModel({ role: "executive", complexity: "exceptional", env: {} })).toBe("gpt-5.6-sol");
        expect(selectKnowledgeTextModel({ role: "public", complexity: "exceptional", env: {} })).toBe("gpt-5.6-terra");
    });

    it("never returns employee or executive vector stores to public roles", () => {
        const env = {
            OPENAI_PUBLIC_KNOWLEDGE_VECTOR_STORE_ID: "vs_public",
            OPENAI_INTERNAL_KNOWLEDGE_VECTOR_STORE_ID: "vs_internal",
            OPENAI_EXECUTIVE_KNOWLEDGE_VECTOR_STORE_ID: "vs_executive",
        };
        expect(getKnowledgeVectorStoreIds("public", env)).toEqual(["vs_public"]);
        expect(getKnowledgeVectorStoreIds("employee", env)).toEqual(["vs_public", "vs_internal"]);
        expect(getKnowledgeVectorStoreIds("executive", env)).toEqual(["vs_public", "vs_internal", "vs_executive"]);
        expect(buildKnowledgeFileSearchTool("public", {})).toBeNull();
    });

    it("uses the effective 2026-08-03 rate card", () => {
        expect(estimateKnowledgeCost({
            model: "gpt-5.6-luna",
            inputTokens: 4000,
            cachedInputTokens: 0,
            outputTokens: 600,
            audioInputTokens: 0,
            audioOutputTokens: 0,
            fileSearchCalls: 1,
        })).toEqual({ rateCardVersion: "2026-08-03", estimatedCostUsd: 0.00402 });
    });

    it("charges cached input separately and never double-bills it", () => {
        expect(estimateKnowledgeCost({
            model: "gpt-5.6-luna",
            inputTokens: 4000,
            cachedInputTokens: 3000,
            outputTokens: 0,
            audioInputTokens: 0,
            audioOutputTokens: 0,
            fileSearchCalls: 0,
        }).estimatedCostUsd).toBe(0.00026);
    });
});
