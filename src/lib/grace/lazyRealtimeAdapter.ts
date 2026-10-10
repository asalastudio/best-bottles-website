import type { KnowledgeRequestContext } from "@/lib/knowledge/contracts";
import type {
    GraceOpenAIRealtimeAdapter,
    GraceRealtimeCallbacks,
    GraceRealtimeToolImplementations,
} from "@/lib/grace/openaiRealtimeAdapter";

/**
 * The OpenAI Agents realtime SDK is only needed once a conversation starts.
 * This facade keeps that module out of the storefront's initial graph.
 */
export function createLazyGraceRealtimeAdapter(args: {
    baseInstructions: string;
    toolImplementations: GraceRealtimeToolImplementations;
    callbacks?: GraceRealtimeCallbacks;
    knowledgeContext?: KnowledgeRequestContext;
}): GraceOpenAIRealtimeAdapter {
    let real: GraceOpenAIRealtimeAdapter | null = null;
    let loading: Promise<GraceOpenAIRealtimeAdapter> | null = null;

    const load = (): Promise<GraceOpenAIRealtimeAdapter> => {
        if (real) return Promise.resolve(real);
        if (!loading) {
            loading = import("./openaiRealtimeAdapter").then((mod) => {
                real = mod.createGraceOpenAIRealtimeAdapter(args);
                return real;
            });
        }
        return loading;
    };

    return {
        connect: async (options) => {
            const adapter = await load();
            await adapter.connect(options);
        },
        disconnect: () => {
            if (real) real.disconnect();
        },
        interrupt: () => {
            if (real) real.interrupt();
        },
        hasSession: () => real?.hasSession() ?? false,
        isConnected: () => real?.isConnected() ?? false,
        sendContext: async (context) => {
            const adapter = await load();
            await adapter.sendContext(context);
        },
        sendText: (text) => {
            void load().then((adapter) => adapter.sendText(text));
        },
        compressSession: async (catalogNote) => {
            const adapter = await load();
            await adapter.compressSession(catalogNote);
        },
    };
}
