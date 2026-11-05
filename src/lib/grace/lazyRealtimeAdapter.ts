import type { createGraceOpenAIRealtimeAdapter, GraceOpenAIRealtimeAdapter } from "./openaiRealtimeAdapter";
import { GraceRealtimeConnectionCancelledError, GraceRealtimeDisconnectedError } from "./realtimeErrors";

type AdapterArgs = Parameters<typeof createGraceOpenAIRealtimeAdapter>[0];

/**
 * The OpenAI Agents realtime SDK (with zod and the OpenAI client, ~210 KB
 * gzipped) is only needed once a voice conversation starts. GraceProvider
 * wraps every page, so it uses this facade and the SDK module loads on the
 * first connect instead of with the page.
 */
export function createLazyGraceRealtimeAdapter(args: AdapterArgs): GraceOpenAIRealtimeAdapter {
    let real: GraceOpenAIRealtimeAdapter | null = null;
    let loading: Promise<GraceOpenAIRealtimeAdapter> | null = null;
    // Bumped by disconnect(), so a connect still waiting on the module is cancelled like the real adapter's.
    let generation = 0;

    const load = (): Promise<GraceOpenAIRealtimeAdapter> => {
        if (real) return Promise.resolve(real);
        loading ??= import("./openaiRealtimeAdapter").then((mod) => {
            real = mod.createGraceOpenAIRealtimeAdapter(args);
            return real;
        }).catch((error: unknown) => {
            loading = null;
            throw error;
        });
        return loading;
    };

    return {
        connect: async (options) => {
            const started = generation;
            const adapter = await load();
            if (started !== generation) throw new GraceRealtimeConnectionCancelledError();
            await adapter.connect(options);
        },
        disconnect: () => {
            generation += 1;
            real?.disconnect();
        },
        interrupt: () => {
            real?.interrupt();
        },
        hasSession: () => real?.hasSession() ?? false,
        isConnected: () => real?.isConnected() ?? false,
        sendContext: async (context) => {
            const adapter = await load();
            await adapter.sendContext(context);
        },
        sendText: (text) => {
            // Same contract as the real adapter: sending with no live session throws.
            if (!real) throw new GraceRealtimeDisconnectedError();
            real.sendText(text);
        },
        compressSession: async (catalogNote) => {
            const adapter = await load();
            await adapter.compressSession(catalogNote);
        },
    };
}
