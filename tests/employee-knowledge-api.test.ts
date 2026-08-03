import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createKnowledgeChatHandler } from "../src/app/api/knowledge/chat/route";

const serverContext = {
    surface: "employee_workspace" as const,
    role: "employee" as const,
    actorId: "user_staff",
    organizationId: "org_best_bottles",
    conversationId: "conversation_1",
    projectId: null,
    refineState: null,
    requestId: "request_1",
};

describe("employee knowledge chat API", () => {
    it("ignores any browser-supplied role and uses server context", async () => {
        const run = vi.fn().mockResolvedValue({
            text: "Verified answer",
            citations: [],
            model: "gpt-5.6-luna",
            trace: { requestId: "req_1" },
        });
        const persist = vi.fn().mockResolvedValue(undefined);
        const handler = createKnowledgeChatHandler({
            deriveContext: vi.fn().mockResolvedValue(serverContext),
            run,
            persist,
        });
        const response = await handler(new Request("http://localhost/api/knowledge/chat", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: "What fits 17-415?", role: "admin", model: "gpt-5.6-sol" }),
        }));
        expect(response.status).toBe(200);
        expect(run.mock.calls[0][0].context.role).toBe("employee");
        expect(run.mock.calls[0][0]).not.toHaveProperty("model");
        expect(persist).toHaveBeenCalledWith({ requestId: "req_1" });
    });

    it("returns 403 before invoking OpenAI for a non-team user", async () => {
        const run = vi.fn();
        const handler = createKnowledgeChatHandler({
            deriveContext: vi.fn().mockRejectedValue(new Error("Forbidden")),
            run,
            persist: vi.fn(),
        });
        const response = await handler(new Request("http://localhost/api/knowledge/chat", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: "Internal margins?" }),
        }));
        expect(response.status).toBe(403);
        expect(run).not.toHaveBeenCalled();
    });

    it("bounds history to twenty messages and 4,000 characters", async () => {
        const run = vi.fn().mockResolvedValue({
            text: "Verified answer",
            citations: [],
            model: "gpt-5.6-luna",
            trace: { requestId: "req_1" },
        });
        const handler = createKnowledgeChatHandler({
            deriveContext: vi.fn().mockResolvedValue(serverContext),
            run,
            persist: vi.fn(),
        });
        const messages = Array.from({ length: 25 }, (_, index) => ({
            role: index % 2 === 0 ? "assistant" : "user",
            content: "x".repeat(5000),
        }));
        messages[messages.length - 1] = { role: "user", content: "x".repeat(5000) };
        const response = await handler(new Request("http://localhost/api/knowledge/chat", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ messages }),
        }));
        expect(response.status).toBe(200);
        expect(run.mock.calls[0][0].messages).toHaveLength(20);
        expect(run.mock.calls[0][0].messages.every((message: { content: string }) => message.content.length === 4000)).toBe(true);
    });

    it("returns a generic provider failure and persists only a minimized error trace", async () => {
        const persist = vi.fn();
        const handler = createKnowledgeChatHandler({
            deriveContext: vi.fn().mockResolvedValue(serverContext),
            run: vi.fn().mockRejectedValue(new Error("provider-secret-body")),
            persist,
        });
        const response = await handler(new Request("http://localhost/api/knowledge/chat", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: "Find amber cylinders" }),
        }));
        expect(response.status).toBe(502);
        expect(await response.text()).not.toContain("provider-secret-body");
        expect(persist).toHaveBeenCalledWith(expect.objectContaining({
            status: "model_error",
            rawContentStored: false,
            requestId: "request_1",
        }));
    });
});
