import "server-only";

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { KnowledgeCorrection, KnowledgeTrace } from "@/lib/knowledge/contracts";
import type { KnowledgeOperationsSummary } from "@/lib/knowledge/operations";

let convexClient: ConvexHttpClient | null = null;

function getPersistenceConfiguration() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    const token = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    if (!token) throw new Error("BEST_BOTTLES_CONVEX_WRITE_TOKEN is not set");
    convexClient ??= new ConvexHttpClient(url);
    return { client: convexClient, token };
}

export async function persistKnowledgeTrace(trace: KnowledgeTrace): Promise<void> {
    const { client, token } = getPersistenceConfiguration();
    await client.mutation(api.knowledgeOperations.recordKnowledgeTrace, { token, trace });
}

export async function persistKnowledgeCorrection(
    correction: Omit<KnowledgeCorrection, "status" | "createdAt">,
): Promise<void> {
    const { client, token } = getPersistenceConfiguration();
    await client.mutation(api.knowledgeOperations.submitKnowledgeCorrection, { token, correction });
}

export async function loadKnowledgeOperationsSummary(since: number): Promise<KnowledgeOperationsSummary> {
    const { client, token } = getPersistenceConfiguration();
    return client.query(api.knowledgeOperations.getKnowledgeOperationsSummary, { token, since });
}
