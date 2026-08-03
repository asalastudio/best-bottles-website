import {
    RealtimeAgent,
    RealtimeSession,
    tool,
    type FunctionTool,
} from "@openai/agents/realtime";
import { GRACE_REALTIME_MODEL, GRACE_REALTIME_VOICE } from "./openaiRealtimeConfig";
import {
    GRACE_OPENAI_TOOL_SPECS,
    type GraceOpenAIToolSpec,
} from "./openaiToolSpecs";

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
    name: "Grace";
    voice: typeof GRACE_REALTIME_VOICE;
    instructions: string;
    tools: FunctionTool[];
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
    isConnected(): boolean;
    sendContext(context: string): Promise<void>;
    sendText(text: string): void;
};

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
            execute: async (args: GraceToolArguments) => serializeToolResult(
                await implementation(args),
            ),
        });
    });
}

function toError(value: unknown): Error {
    if (value instanceof Error) return value;
    if (typeof value === "string") return new Error(value);
    return new Error("Grace Realtime encountered an unknown error.");
}

const defaultDependencies: GraceRealtimeDependencies = {
    createAgent: (config) => new RealtimeAgent(config),
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
}: {
    baseInstructions: string;
    toolImplementations: GraceRealtimeToolImplementations;
    callbacks?: GraceRealtimeCallbacks;
    dependencies?: GraceRealtimeDependencies;
}): GraceOpenAIRealtimeAdapter {
    const tools = buildGraceRealtimeTools(GRACE_OPENAI_TOOL_SPECS, toolImplementations);
    let session: GraceRealtimeSessionLike | null = null;
    let connected = false;
    let currentContext = "";

    const createAgent = () => dependencies.createAgent({
        name: "Grace",
        voice: GRACE_REALTIME_VOICE,
        instructions: buildInstructions(baseInstructions, currentContext),
        tools,
    });

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
        activeSession.on("audio_start", () => callbacks.onModeChange?.("speaking"));
        activeSession.on("audio_stopped", () => callbacks.onModeChange?.("listening"));
        activeSession.on("agent_end", (...args: unknown[]) => {
            const output = args[2];
            if (typeof output === "string" && output.trim()) {
                callbacks.onMessage?.({ role: "assistant", text: output.trim() });
            }
        });
        activeSession.on("error", (...args: unknown[]) => {
            const payload = args[0] as { error?: unknown } | undefined;
            callbacks.onError?.(toError(payload?.error ?? payload));
        });
        activeSession.on("transport_event", (...args: unknown[]) => {
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

            const agent = createAgent();
            session = dependencies.createSession(agent, {
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
            bindEvents(session);

            try {
                await session.connect({ apiKey: clientSecret });
                notifyConnected();
            } catch (error) {
                session.close();
                session = null;
                notifyDisconnected();
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

        isConnected() {
            return connected;
        },

        async sendContext(context) {
            currentContext = context;
            if (!session) return;
            await session.updateAgent(createAgent());
        },

        sendText(text) {
            if (!session || !connected) throw new Error("Grace Realtime is not connected.");
            const normalized = text.trim();
            if (!normalized) return;
            session.sendMessage(normalized);
        },
    };
}
