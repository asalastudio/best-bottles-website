import { describe, expect, it, vi } from "vitest";
import {
    KnowledgeResponseExecutionError,
    runKnowledgeResponse,
} from "../src/lib/knowledge/openaiResponsesServer";

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

    it("retains usage and tool failure details when execution fails", async () => {
        const create = vi.fn().mockResolvedValue({
            output: [{ type: "function_call", name: "getCatalogStats", call_id: "call_failed", arguments: "{}" }],
            usage: { input_tokens: 1000, output_tokens: 100, input_tokens_details: { cached_tokens: 200 } },
        });

        try {
            await runKnowledgeResponse({
                context,
                messages: [{ role: "user", content: "How many products?" }],
                complexity: "routine",
                client: { responses: { create } },
                executeTool: vi.fn().mockRejectedValue(new Error("catalog unavailable")),
                env: {},
            });
            throw new Error("Expected the runtime to reject");
        } catch (error) {
            expect(error).toBeInstanceOf(KnowledgeResponseExecutionError);
            const trace = (error as KnowledgeResponseExecutionError).trace;
            expect(trace).toEqual(expect.objectContaining({
                status: "tool_error",
                inputTokens: 1000,
                outputTokens: 100,
            }));
            expect(trace.estimatedCostUsd).toBeGreaterThan(0);
            expect(trace.toolCalls).toEqual([
                expect.objectContaining({ name: "getCatalogStats", status: "error" }),
            ]);
        }
    });

    it("classifies authorization failures as blocked traces", async () => {
        const create = vi.fn().mockResolvedValue({
            output: [{ type: "function_call", name: "getCatalogStats", call_id: "call_blocked", arguments: "{}" }],
            usage: { input_tokens: 10, output_tokens: 2 },
        });

        await expect(runKnowledgeResponse({
            context,
            messages: [{ role: "user", content: "Count products" }],
            complexity: "routine",
            client: { responses: { create } },
            executeTool: vi.fn().mockRejectedValue(new Error("Knowledge tool blocked: missing_scope:catalog.read")),
            env: {},
        })).rejects.toMatchObject({
            trace: expect.objectContaining({
                status: "blocked",
                toolCalls: [expect.objectContaining({ status: "blocked" })],
            }),
        });
    });
});
