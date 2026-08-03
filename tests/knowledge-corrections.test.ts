import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createCorrectionHandler } from "../src/app/api/knowledge/corrections/route";

const context = {
    surface: "employee_workspace" as const,
    role: "employee" as const,
    actorId: "user_staff",
    organizationId: "org_best_bottles",
    conversationId: "conversation_1",
    projectId: null,
    refineState: null,
    requestId: "request_1",
};

describe("knowledge corrections", () => {
    it("forces pending status and uses the authenticated actor", async () => {
        const persist = vi.fn().mockResolvedValue("correction_1");
        const handler = createCorrectionHandler({
            deriveContext: vi.fn().mockResolvedValue(context),
            persist,
        });
        const response = await handler(new Request("http://localhost/api/knowledge/corrections", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                messageId: "message_1",
                requestId: "request_answer_1",
                answerExcerpt: "The previous verified answer said this bottle used 13-415.",
                sourceIds: ["convex:checkCompatibility"],
                category: "compatibility",
                correction: "This bottle uses 17-415, not 13-415.",
                status: "accepted",
            }),
        }));
        expect(response.status).toBe(201);
        expect(persist.mock.calls[0][0]).toEqual(expect.objectContaining({
            actorId: "user_staff",
            status: "pending",
            surface: "employee_workspace",
            requestId: "request_answer_1",
            answerExcerpt: "The previous verified answer said this bottle used 13-415.",
            sourceIds: ["convex:checkCompatibility"],
        }));
        expect(await response.json()).toEqual({ correctionId: "correction_1", status: "pending" });
    });

    it("rejects insecure source URLs and short corrections", async () => {
        const persist = vi.fn();
        const handler = createCorrectionHandler({
            deriveContext: vi.fn().mockResolvedValue(context),
            persist,
        });
        const response = await handler(new Request("http://localhost/api/knowledge/corrections", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                messageId: "message_1",
                requestId: "request_answer_1",
                answerExcerpt: "A prior assistant answer.",
                sourceIds: [],
                category: "compatibility",
                correction: "Too short",
                sourceUrl: "http://example.com/source",
            }),
        }));
        expect(response.status).toBe(400);
        expect(persist).not.toHaveBeenCalled();
    });
});
