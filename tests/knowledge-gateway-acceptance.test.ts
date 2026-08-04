import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EMPLOYEE_KNOWLEDGE_INSTRUCTIONS } from "../src/lib/knowledge/instructions";
import { resolveKnowledgeScopes } from "../src/lib/knowledge/authorization";
import { getKnowledgeVectorStoreIds } from "../src/lib/knowledge/retrieval";
import { KNOWLEDGE_TOOL_REGISTRY } from "../src/lib/knowledge/toolRegistry";

describe("Best Bottles knowledge gateway acceptance", () => {
    it("keeps product truth shared while enforcing privacy and audience boundaries", () => {
        const env = {
            OPENAI_PUBLIC_KNOWLEDGE_VECTOR_STORE_ID: "vs_public",
            OPENAI_INTERNAL_KNOWLEDGE_VECTOR_STORE_ID: "vs_internal",
        };
        const runtimeSource = readFileSync(resolve(process.cwd(), "src/lib/knowledge/openaiResponsesServer.ts"), "utf8");
        const traceSchemaSource = readFileSync(resolve(process.cwd(), "convex/schema.ts"), "utf8");

        expect(KNOWLEDGE_TOOL_REGISTRY.searchCatalog.requiredScopes).toContain("catalog.read");
        expect(getKnowledgeVectorStoreIds("public", env)).not.toContain("vs_internal");
        expect(resolveKnowledgeScopes("public")).not.toContain("internal_knowledge.read");
        expect(EMPLOYEE_KNOWLEDGE_INSTRUCTIONS).toContain("13-415");
        expect(EMPLOYEE_KNOWLEDGE_INSTRUCTIONS).toContain("17-415");
        expect(runtimeSource).toContain("store: false");
        expect(traceSchemaSource).toContain("rawContentStored: v.literal(false)");
    });
});
