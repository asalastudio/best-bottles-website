import { createKnowledgeChatHandler } from "@/lib/knowledge/chatHandlerServer";
import { runKnowledgeResponse } from "@/lib/knowledge/openaiResponsesServer";
import { persistKnowledgeTrace } from "@/lib/knowledge/operationsServer";
import { deriveEmployeeKnowledgeContext } from "@/lib/knowledge/requestContextServer";

export const POST = createKnowledgeChatHandler({
    deriveContext: deriveEmployeeKnowledgeContext,
    run: runKnowledgeResponse,
    persist: persistKnowledgeTrace,
});
