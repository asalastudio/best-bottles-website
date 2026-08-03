import { authorizeKnowledgeTool } from "@/lib/knowledge/authorization";
import type {
    KnowledgeCorrection,
    KnowledgeRequestContext,
} from "@/lib/knowledge/contracts";
import { persistKnowledgeCorrection } from "@/lib/knowledge/operationsServer";
import { deriveEmployeeKnowledgeContext } from "@/lib/knowledge/requestContextServer";

const CATEGORIES = [
    "product_truth",
    "compatibility",
    "policy",
    "behavior",
    "missing_knowledge",
] as const satisfies readonly KnowledgeCorrection["category"][];

type CorrectionDependencies = {
    deriveContext: (args: { conversationId?: string | null }) => Promise<KnowledgeRequestContext>;
    persist: (correction: KnowledgeCorrection) => Promise<string>;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
});

function normalizeHttpsUrl(value: unknown): string | null | undefined {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || value.length > 2_000) return undefined;
    try {
        const url = new URL(value);
        return url.protocol === "https:" ? url.toString() : undefined;
    } catch {
        return undefined;
    }
}

function normalizeSourceIds(value: unknown): string[] | undefined {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) return undefined;
    return [...new Set(value
        .map((entry) => entry.trim().slice(0, 160))
        .filter(Boolean))]
        .slice(0, 20);
}

export function createCorrectionHandler(dependencies: CorrectionDependencies) {
    return async function correctionHandler(request: Request): Promise<Response> {
        let body: Record<string, unknown>;
        try {
            const parsed = await request.json();
            body = parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? parsed as Record<string, unknown>
                : {};
        } catch {
            return json({ error: "A valid JSON body is required." }, 400);
        }

        const messageId = typeof body.messageId === "string" ? body.messageId.trim().slice(0, 160) : "";
        const requestId = typeof body.requestId === "string" ? body.requestId.trim().slice(0, 160) : "";
        const answerExcerpt = typeof body.answerExcerpt === "string" ? body.answerExcerpt.trim().slice(0, 1_000) : "";
        const correctionText = typeof body.correction === "string" ? body.correction.trim() : "";
        const category = typeof body.category === "string" && CATEGORIES.includes(body.category as KnowledgeCorrection["category"])
            ? body.category as KnowledgeCorrection["category"]
            : null;
        const sourceUrl = normalizeHttpsUrl(body.sourceUrl);
        const sourceIds = normalizeSourceIds(body.sourceIds);
        if (!messageId || !requestId || !answerExcerpt || !category || correctionText.length < 10 || correctionText.length > 2_000 || sourceUrl === undefined || sourceIds === undefined) {
            return json({ error: "Provide the answer reference, category, 10–2,000 character correction, and optional HTTPS source." }, 400);
        }

        let context: KnowledgeRequestContext;
        try {
            context = await dependencies.deriveContext({
                conversationId: typeof body.conversationId === "string" ? body.conversationId : null,
            });
        } catch {
            return json({ error: "Forbidden" }, 403);
        }
        const authorization = authorizeKnowledgeTool(
            context,
            ["correction.submit"],
            ["employee_workspace"],
        );
        if (!authorization.allowed || !context.actorId) return json({ error: "Forbidden" }, 403);

        const correction: KnowledgeCorrection = {
            conversationId: context.conversationId,
            messageId,
            requestId,
            actorId: context.actorId,
            surface: context.surface,
            category,
            correction: correctionText,
            sourceUrl,
            answerExcerpt,
            sourceIds,
            status: "pending",
            createdAt: Date.now(),
        };
        try {
            const correctionId = await dependencies.persist(correction);
            return json({ correctionId, status: "pending" }, 201);
        } catch {
            return json({ error: "The correction could not be submitted right now." }, 502);
        }
    };
}

export const POST = createCorrectionHandler({
    deriveContext: deriveEmployeeKnowledgeContext,
    persist: persistKnowledgeCorrection,
});
