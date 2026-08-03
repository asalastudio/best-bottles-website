import { describe, expect, it, vi } from "vitest";
import {
    KNOWLEDGE_TOOL_REGISTRY,
    executeKnowledgeTool,
    getAuthorizedKnowledgeTools,
} from "../src/lib/knowledge/toolRegistry";
import type { KnowledgeRequestContext } from "../src/lib/knowledge/contracts";
import { GRACE_OPENAI_TOOL_SPECS } from "../src/lib/grace/openaiToolSpecs";

const employeeContext: KnowledgeRequestContext = {
    surface: "employee_workspace",
    role: "employee",
    actorId: "user_employee",
    organizationId: "org_best_bottles",
    conversationId: "conversation_registry",
    projectId: null,
    refineState: null,
    requestId: "request_registry",
};

describe("knowledge tool registry", () => {
    it("owns one policy record for every existing Grace schema", () => {
        expect(Object.keys(KNOWLEDGE_TOOL_REGISTRY).sort()).toEqual(
            GRACE_OPENAI_TOOL_SPECS.map((tool) => tool.name).sort(),
        );
        for (const definition of Object.values(KNOWLEDGE_TOOL_REGISTRY)) {
            expect(definition.requiredScopes.length).toBeGreaterThan(0);
            expect(definition.surfaces.length).toBeGreaterThan(0);
            expect(["read", "propose", "write"]).toContain(definition.risk);
        }
    });

    it("does not expose customer project tools to an employee surface", () => {
        expect(getAuthorizedKnowledgeTools(employeeContext).map((tool) => tool.name)).not.toContain("listGraceProjects");
    });

    it("blocks execution before calling the handler", async () => {
        const execute = vi.fn();
        await expect(executeKnowledgeTool({
            context: { ...employeeContext, role: "public", surface: "customer_portal" },
            name: "listGraceProjects",
            parameters: {},
            execute,
        })).rejects.toThrow("Knowledge tool blocked: missing_scope:customer_project.read.self");
        expect(execute).not.toHaveBeenCalled();
    });

    it("authorizes exact 17-415 compatibility reads without broadening state", async () => {
        const execute = vi.fn().mockResolvedValue({ threadSize: "17-415" });
        await expect(executeKnowledgeTool({
            context: employeeContext,
            name: "checkCompatibility",
            parameters: { threadSize: "17-415" },
            execute,
        })).resolves.toEqual({ threadSize: "17-415" });
        expect(execute).toHaveBeenCalledWith("checkCompatibility", { threadSize: "17-415" });
    });
});
