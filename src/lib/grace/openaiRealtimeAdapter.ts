import {
    RealtimeAgent,
    RealtimeSession,
    tool,
    type FunctionTool,
} from "@openai/agents/realtime";
import { GRACE_REALTIME_MODEL, GRACE_REALTIME_VOICE } from "./openaiRealtimeConfig";
import {
    type GraceOpenAIToolSpec,
} from "./openaiToolSpecs";
import type { KnowledgeRequestContext } from "@/lib/knowledge/contracts";
import {
    assertKnowledgeToolParameters,
    getAuthorizedKnowledgeTools,
} from "@/lib/knowledge/toolRegistry";
import {
    GRACE_MERCHANDISER_NAME,
    GRACE_NAVIGATOR_NAME,
    buildMerchandiserInstructions,
    buildNavigatorInstructions,
    splitToolsForGraceRole,
} from "./realtimeAgents";
import {
    compressRealtimeHistory,
    mergeSessionContextBlocks,
    type CompressibleHistoryItem,
} from "./sessionCompression";

export type GraceConversationMode = "voice" | "text";
export type GraceRealtimeRole = "user" | "assistant";

type GraceToolArguments = Record<string, unknown>;
type GraceToolImplementation = (args: GraceToolArguments) => unknown | Promise<unknown>;

export type GraceRealtimeToolImplementations = Record<string, GraceToolImplementation>;

export type GraceRealtimeCallbacks = {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onModeChange?: (mode: "speaking" | "listening") => void;
    onTranscriptDelta?: (delta: string) => void;
    onMessage?: (message: { role: GraceRealtimeRole; text: string }) => void;
    onError?: (error: Error) => void;
};

export type GraceRealtimeAgentConfig = {
    name: string;
    voice: typeof GRACE_REALTIME_VOICE;
    instructions: string;
    tools: FunctionTool[];
    handoffs?: unknown[];
};

export type GraceRealtimeSessionConfig = {
    model: typeof GRACE_REALTIME_MODEL;
    transport: "webrtc";
    config: {
        outputModalities: Array<"text" | "audio">;
        voice: typeof GRACE_REALTIME_VOICE;
        audio: {
            input: {
                transcription: { model: "gpt-4o-mini-transcribe" };
                turnDetection: {
                    type: "semantic_vad";
                    eagerness: "auto";
                    interrupt_response: true;
                };
            };
            output: { voice: typeof GRACE_REALTIME_VOICE };
        };
    };
    tracingDisabled: false;
    workflowName: "Best Bottles Grace";
};

export type GraceRealtimeSessionLike = {
    on(event: string, handler: (...args: unknown[]) => void): unknown;
    connect(options: { apiKey: string }): Promise<void>;
    sendMessage(message: string): void;
    updateAgent(agent: unknown): Promise<unknown>;
    updateHistory?(history: CompressibleHistoryItem[] | ((history: CompressibleHistoryItem[]) => CompressibleHistoryItem[])): void;
    interrupt(): void;
    close(): void;
};

type GraceRealtimeDependencies = {
    createAgent(config: GraceRealtimeAgentConfig): unknown;
    createSession(agent: unknown, config: GraceRealtimeSessionConfig): GraceRealtimeSessionLike;
};

export type GraceOpenAIRealtimeAdapter = {
    connect(options: { clientSecret: string; mode: GraceConversationMode }): Promise<void>;
    disconnect(): void;
    interrupt(): void;
    hasSession(): boolean;
    isConnected(): boolean;
    sendContext(context: string): Promise<void>;
    sendText(text: string): void;
    compressSession(catalogNote: string): Promise<void>;
};

export class GraceRealtimeConnectionCancelledError extends Error {
    constructor() {
        super("Grace Realtime connection was cancelled.");
        this.name = "GraceRealtimeConnectionCancelledError";
    }
}

function serializeToolResult(result: unknown): string {
    if (typeof result === "string") return result;
    return JSON.stringify(result ?? null);
}

export function buildGraceRealtimeTools(
    specs: GraceOpenAIToolSpec[],
    implementations: GraceRealtimeToolImplementations,
): FunctionTool[] {
    return specs.map((spec) => {
        const implementation = implementations[spec.name];
        if (!implementation) {
            throw new Error(`Missing Grace tool implementation: ${spec.name}`);
        }

        return tool({
            name: spec.name,
            description: spec.description,
            parameters: spec.parameters as never,
            strict: true,
            execute: async (args: GraceToolArguments) => {
                assertKnowledgeToolParameters(spec.name, args);
                return serializeToolResult(await implementation(args));
            },
        });
    });
}

export function getGraceRealtimeToolSpecs(context: KnowledgeRequestContext) {
    return getAuthorizedKnowledgeTools(context);
}

function toError(value: unknown): Error {
    if (value instanceof Error) return value;
    if (typeof value === "string") return new Error(value);
    return new Error("Grace Realtime encountered an unknown error.");
}

const defaultDependencies: GraceRealtimeDependencies = {
    createAgent: (config) => new RealtimeAgent({
        name: config.name,
        voice: config.voice,
        instructions: config.instructions,
        tools: config.tools,
    }),
    createSession: (agent, config) => new RealtimeSession(
        agent as RealtimeAgent,
        config,
    ) as unknown as GraceRealtimeSessionLike,
};

function buildInstructions(baseInstructions: string, context: string): string {
    if (!context.trim()) return baseInstructions.trim();
    return `${baseInstructions.trim()}\n\nCURRENT CUSTOMER CONTEXT\n${context.trim()}`;
}

export function createGraceOpenAIRealtimeAdapter({
    baseInstructions,
    toolImplementations,
    callbacks = {},
    dependencies = defaultDependencies,
    knowledgeContext = {
        surface: "storefront",
        role: "public",
        actorId: null,
        organizationId: null,
        conversationId: "grace-realtime",
        projectId: null,
        refineState: null,
        requestId: "grace-realtime-config",
    },
}: {
    baseInstructions: string;
    toolImplementations: GraceRealtimeToolImplementations;
    callbacks?: GraceRealtimeCallbacks;
    dependencies?: GraceRealtimeDependencies;
    knowledgeContext?: KnowledgeRequestContext;
}): GraceOpenAIRealtimeAdapter {
    const authorizedSpecs = getGraceRealtimeToolSpecs(knowledgeContext);
    const merchandiserTools = buildGraceRealtimeTools(
        splitToolsForGraceRole(authorizedSpecs, "merchandiser"),
        toolImplementations,
    );
    const navigatorTools = buildGraceRealtimeTools(
        splitToolsForGraceRole(authorizedSpecs, "navigator"),
        toolImplementations,
    );
    let session: GraceRealtimeSessionLike | null = null;
    let connected = false;
    let currentContext = "";
    let catalogNote = "";
    let currentRole: "merchandiser" | "navigator" = "merchandiser";

    const composedContext = () => mergeSessionContextBlocks(currentContext, catalogNote || null);

    const attachHandoffs = (merchandiser: unknown, navigator: unknown) => {
        if (merchandiser && typeof merchandiser === "object" && navigator && typeof navigator === "object") {
            (merchandiser as { handoffs: unknown[] }).handoffs = [navigator];
            (navigator as { handoffs: unknown[] }).handoffs = [merchandiser];
        }
    };

    const createTeam = () => {
        const context = composedContext();
        const merchandiser = dependencies.createAgent({
            name: GRACE_MERCHANDISER_NAME,
            voice: GRACE_REALTIME_VOICE,
            instructions: buildInstructions(buildMerchandiserInstructions(baseInstructions), context),
            tools: merchandiserTools,
        });
        const navigator = dependencies.createAgent({
            name: GRACE_NAVIGATOR_NAME,
            voice: GRACE_REALTIME_VOICE,
            instructions: buildInstructions(buildNavigatorInstructions(baseInstructions), context),
            tools: navigatorTools,
        });
        attachHandoffs(merchandiser, navigator);
        return { merchandiser, navigator };
    };

    const createCurrentAgent = () => {
        const team = createTeam();
        return currentRole === "navigator" ? team.navigator : team.merchandiser;
    };

    const refreshSession = async () => {
        if (!session) return;
        await session.updateAgent(createCurrentAgent());
        session.updateHistory?.((history) => compressRealtimeHistory(history));
    };

    const notifyConnected = () => {
        if (connected) return;
        connected = true;
        callbacks.onConnect?.();
    };

    const notifyDisconnected = () => {
        if (!connected) return;
        connected = false;
        callbacks.onDisconnect?.();
    };

    const bindEvents = (activeSession: GraceRealtimeSessionLike) => {
        const isCurrentSession = () => session === activeSession;
        activeSession.on("audio_start", () => {
            if (isCurrentSession()) callbacks.onModeChange?.("speaking");
        });
        activeSession.on("audio_stopped", () => {
            if (isCurrentSession()) callbacks.onModeChange?.("listening");
        });
        activeSession.on("agent_end", (...args: unknown[]) => {
            if (!isCurrentSession()) return;
            const output = args[2];
            if (typeof output === "string" && output.trim()) {
                callbacks.onMessage?.({ role: "assistant", text: output.trim() });
            }
        });
        activeSession.on("agent_handoff", (...args: unknown[]) => {
            if (!isCurrentSession()) return;
            const toAgent = args[2] as { name?: string } | undefined;
            if (toAgent?.name === GRACE_NAVIGATOR_NAME) currentRole = "navigator";
            if (toAgent?.name === GRACE_MERCHANDISER_NAME) currentRole = "merchandiser";
        });
        activeSession.on("error", (...args: unknown[]) => {
            if (!isCurrentSession()) return;
            const payload = args[0] as { error?: unknown } | undefined;
            callbacks.onError?.(toError(payload?.error ?? payload));
        });
        activeSession.on("transport_event", (...args: unknown[]) => {
            if (!isCurrentSession()) return;
            const event = args[0] as Record<string, unknown> | undefined;
            if (!event) return;

            if (event.type === "connection_change") {
                if (event.status === "connected") notifyConnected();
                if (event.status === "disconnected") notifyDisconnected();
                return;
            }

            if (
                event.type === "conversation.item.input_audio_transcription.completed"
                && typeof event.transcript === "string"
                && event.transcript.trim()
            ) {
                callbacks.onMessage?.({ role: "user", text: event.transcript.trim() });
                return;
            }

            if (
                (event.type === "response.output_audio_transcript.delta"
                    || event.type === "response.audio_transcript.delta"
                    || event.type === "response.output_text.delta")
                && typeof event.delta === "string"
            ) {
                callbacks.onTranscriptDelta?.(event.delta);
            }
        });
    };

    return {
        async connect({ clientSecret, mode }) {
            if (!clientSecret.trim()) throw new Error("A Realtime client secret is required.");
            if (session) session.close();

            currentRole = "merchandiser";
            const agent = createCurrentAgent();
            const activeSession = dependencies.createSession(agent, {
                model: GRACE_REALTIME_MODEL,
                transport: "webrtc",
                config: {
                    outputModalities: [mode === "voice" ? "audio" : "text"],
                    voice: GRACE_REALTIME_VOICE,
                    audio: {
                        input: {
                            transcription: { model: "gpt-4o-mini-transcribe" },
                            turnDetection: {
                                type: "semantic_vad",
                                eagerness: "auto",
                                interrupt_response: true,
                            },
                        },
                        output: { voice: GRACE_REALTIME_VOICE },
                    },
                },
                tracingDisabled: false,
                workflowName: "Best Bottles Grace",
            });
            session = activeSession;
            bindEvents(activeSession);

            try {
                await activeSession.connect({ apiKey: clientSecret });
                if (session !== activeSession) {
                    activeSession.close();
                    throw new GraceRealtimeConnectionCancelledError();
                }
                notifyConnected();
            } catch (error) {
                activeSession.close();
                if (session === activeSession) {
                    session = null;
                    notifyDisconnected();
                }
                throw error;
            }
        },

        disconnect() {
            session?.close();
            session = null;
            notifyDisconnected();
        },

        interrupt() {
            session?.interrupt();
        },

        hasSession() {
            return session !== null;
        },

        isConnected() {
            return connected;
        },

        async sendContext(context) {
            currentContext = context;
            await refreshSession();
        },

        async compressSession(nextCatalogNote) {
            catalogNote = nextCatalogNote.trim();
            await refreshSession();
        },

        sendText(text) {
            if (!session || !connected) throw new Error("Grace Realtime is not connected.");
            const normalized = text.trim();
            if (!normalized) return;
            session.sendMessage(normalized);
        },
    };
}
