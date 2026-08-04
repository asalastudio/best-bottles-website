import { createCorrectionHandler } from "@/lib/knowledge/correctionHandlerServer";
import { persistKnowledgeCorrection } from "@/lib/knowledge/operationsServer";
import { deriveEmployeeKnowledgeContext } from "@/lib/knowledge/requestContextServer";

export const POST = createCorrectionHandler({
    deriveContext: deriveEmployeeKnowledgeContext,
    persist: persistKnowledgeCorrection,
});
