import { describe, expect, it, vi } from "vitest";
import { runKnowledgeResponse } from "../src/lib/knowledge/openaiResponsesServer";

const context = {
    surface: "employee_workspace" as const,
    role: "employee" as const,
    actorId: "user_1",
    organizationId: "org_1",
    conversationId: "conversation_1",
    projectId: null,
    refineState: null,
    requestId: "request_1",
};

describe("OpenAI knowledge response runtime", () => {
    it("uses store false and returns tool-grounded text", async () => {
        const create = vi.fn()
            .mockResolvedValueOnce({
                id: "resp_1",
                output: [{ type: "function_call", name: "getCatalogStats", call_id: "call_1", arguments: "{}" }],
                usage: { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 0 } },
            })
            .mockResolvedValueOnce({
                id: "resp_2",
                output: [{ type: "message", content: [{ type: "output_text", text: "The live catalog contains 2,330 products.", annotations: [] }] }],
                usage: { input_tokens: 140, output_tokens: 30, input_tokens_details: { cached_tokens: 100 } },
            });
        const executeTool = vi.fn().mockResolvedValue({ totalVariants: 2330 });

        const result = await runKnowledgeResponse({
            context,
            messages: [{ role: "user", content: "How many products are live?" }],
            complexity: "routine",
            client: { responses: { create } },
            executeTool,
            env: {},
        });

        expect(create.mock.calls[0][0]).toEqual(expect.objectContaining({ model: "gpt-5.6-luna", store: false }));
        expect(executeTool).toHaveBeenCalledWith("getCatalogStats", {});
        expect(result.text).toContain("2,330");
        expect(result.toolCalls[0]).toEqual(expect.objectContaining({ name: "getCatalogStats", status: "success" }));
        expect(result.trace.rawContentStored).toBe(false);
    });

    it("stops after six tool rounds", async () => {
        const create = vi.fn().mockResolvedValue({
            output: [{ type: "function_call", name: "getCatalogStats", call_id: "call_loop", arguments: "{}" }],
            usage: { input_tokens: 1, output_tokens: 1, input_tokens_details: { cached_tokens: 0 } },
        });
        await expect(runKnowledgeResponse({
            context: { ...context, conversationId: "conversation_loop", requestId: "request_loop" },
            messages: [{ role: "user", content: "Loop" }],
            complexity: "routine",
            client: { responses: { create } },
            executeTool: vi.fn().mockResolvedValue({ totalVariants: 2330 }),
            env: {},
        })).rejects.toThrow("Knowledge response exceeded 6 tool rounds");
    });

    it("rejects malformed function arguments before invoking a tool", async () => {
        const executeTool = vi.fn();
        const create = vi.fn().mockResolvedValue({
            output: [{ type: "function_call", name: "searchCatalog", call_id: "call_bad", arguments: "[]" }],
            usage: { input_tokens: 1, output_tokens: 1, input_tokens_details: { cached_tokens: 0 } },
        });

        await expect(runKnowledgeResponse({
            context,
            messages: [{ role: "user", content: "Find bottles" }],
            complexity: "routine",
            client: { responses: { create } },
            executeTool,
            env: {},
        })).rejects.toThrow("Invalid arguments for knowledge tool searchCatalog");
        expect(executeTool).not.toHaveBeenCalled();
    });
});
