import {
    OpenAIRealtimeWebRTC,
    RealtimeAgent,
    RealtimeSession,
    tool,
    type FunctionTool,
} from "@openai/agents/realtime";
import { GRACE_REALTIME_MODEL, GRACE_REALTIME_SPEED, GRACE_REALTIME_VOICE } from "./openaiRealtimeConfig";
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
import {
    GRACE_VOICE_AUDIO_CONSTRAINTS,
    GRACE_VOICE_ECHO_TAIL_MS,
    isVoiceEchoGuardActive,
    shouldCancelEchoGeneratedResponse,
    shouldIgnoreVoiceUserTranscript,
} from "./voiceEchoGuard";

export type GraceConversationMode = "voice" | "text";
export type GraceRealtimeRole = "user" | "assistant";

type GraceToolArguments = Record<string, unknown>;
type GraceToolImplementation = (args: GraceToolArguments) => unknown | Promise<unknown>;

export type GraceRealtimeToolImplementations = Record<string, GraceToolImplementation>;

export type GraceRealtimeCallbacks = {
    onConnect?: () => void;
    /** `unexpected` is true when the transport dropped on its own (idle close, network change), false for disconnect(). */
    onDisconnect?: (details?: { unexpected: boolean }) => void;
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

export type GraceVadEagerness = "low" | "medium" | "high" | "auto";

/**
 * How quickly the model decides the customer has finished speaking. "low"
 * (the 2026-09-16 echo fix) waits up to ~8 s of silence; "medium"/"auto" ~4 s;
 * "high" ~2 s. The mic is now hard-muted while Grace speaks, so the setting is
 * an env choice for staging trials rather than a constant.
 */
export function resolveGraceVadEagerness(raw: string | undefined = process.env.NEXT_PUBLIC_GRACE_VAD_EAGERNESS): GraceVadEagerness {
    const value = raw?.trim().toLowerCase();
    return value === "medium" || value === "high" || value === "auto" ? value : "low";
}

export type GraceRealtimeSessionConfig = {
    model: typeof GRACE_REALTIME_MODEL;
    transport: "webrtc" | "websocket";
    mediaStream?: MediaStream;
    config: {
        outputModalities: Array<"text" | "audio">;
        voice: typeof GRACE_REALTIME_VOICE;
        // The token is minted at 0.9; without this the SDK's first
        // session.update reset the voice to 1.0.
        speed: typeof GRACE_REALTIME_SPEED;
        audio: {
            input: {
                transcription: { model: "gpt-4o-mini-transcribe" };
                noiseReduction: { type: "far_field" };
                turnDetection: {
                    type: "semantic_vad";
                    // Low eagerness waits longer before committing a turn so
                    // leftover speaker audio is less likely to become a reply.
                    eagerness: GraceVadEagerness;
                    // Speaker echo looks like barge-in. Mute + this flag keep
                    // Grace from cutting herself off, then answering the echo.
                    interrupt_response: boolean;
                };
            };
            output: { voice: typeof GRACE_REALTIME_VOICE };
        };
    };
    tracingDisabled: false;
    workflowName: "Best Bottles Grace";
};

export type GraceRealtimeTransportStatus = "connected" | "disconnected" | "connecting" | "disconnecting";

export type GraceRealtimeSessionLike = {
    on(event: string, handler: (...args: unknown[]) => void): unknown;
    connect(options: { apiKey: string }): Promise<void>;
    sendMessage(message: string): void;
    updateAgent(agent: unknown): Promise<unknown>;
    updateHistory?(history: CompressibleHistoryItem[] | ((history: CompressibleHistoryItem[]) => CompressibleHistoryItem[])): void;
    mute?(muted: boolean): void;
    interrupt(): void;
    close(): void;
    transport?: {
        sendEvent?(event: { type: string }): void;
        /** The SDK reports socket state on the transport, not as a server event. */
        on?(event: string, handler: (...args: unknown[]) => void): unknown;
        status?: GraceRealtimeTransportStatus;
    };
}

/** The live Realtime transport is gone; reconnect before sending again. */
export class GraceRealtimeDisconnectedError extends Error {
    constructor(message = "Grace Realtime is not connected.") {
        super(message);
        this.name = "GraceRealtimeDisconnectedError";
    }
}

function muteRealtimeMicrophone(session: GraceRealtimeSessionLike, muted: boolean): void {
    try {
        session.mute?.(muted);
    } catch {
        // Transport may not expose mute (tests, websocket).
    }
}

function clearRealtimeInputBuffer(session: GraceRealtimeSessionLike): void {
    try {
        session.transport?.sendEvent?.({ type: "input_audio_buffer.clear" });
    } catch {
        // Transport may not expose sendEvent (tests, websocket).
    }
}

function cancelEchoResponse(session: GraceRealtimeSessionLike): void {
    try {
        session.interrupt();
    } catch {
        // No active response to cancel.
    }
    clearRealtimeInputBuffer(session);
}

export async function createGraceVoiceMediaStream(
    getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream> = (constraints) =>
        navigator.mediaDevices.getUserMedia(constraints),
): Promise<MediaStream> {
    return getUserMedia({ audio: { ...GRACE_VOICE_AUDIO_CONSTRAINTS } });
}

function assistantTextFromTransportEvent(event: Record<string, unknown>): string | null {
    if (
        (event.type === "response.output_audio_transcript.done"
            || event.type === "response.audio_transcript.done"
            || event.type === "response.output_text.done")
        && typeof event.transcript === "string"
        && event.transcript.trim()
    ) {
        return event.transcript.trim();
    }
    if (typeof event.text === "string" && event.text.trim() && event.type === "response.output_text.done") {
        return event.text.trim();
    }
    return null;
}

type GraceRealtimeDependencies = {
    createAgent(config: GraceRealtimeAgentConfig): unknown;
    createSession(agent: unknown, config: GraceRealtimeSessionConfig): GraceRealtimeSessionLike;
    createVoiceStream?(): Promise<MediaStream | undefined>;
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
    // The server's error event carries { type, code, message }. Keep them, or the
    // log only ever says "unknown error" (2026-09-25 audit).
    if (value && typeof value === "object") {
        const detail = value as { message?: unknown; code?: unknown; type?: unknown };
        const message = typeof detail.message === "string" && detail.message.trim() ? detail.message.trim() : null;
        if (message) {
            const code = typeof detail.code === "string" && detail.code ? detail.code : typeof detail.type === "string" ? detail.type : null;
            const error = new Error(code ? `${code}: ${message}` : message);
            error.name = "GraceRealtimeServerError";
            return error;
        }
    }
    return new Error("Grace Realtime encountered an unknown error.");
}

const defaultDependencies: GraceRealtimeDependencies = {
    createAgent: (config) => new RealtimeAgent({
        name: config.name,
        voice: config.voice,
        instructions: config.instructions,
        tools: config.tools,
    }),
    createVoiceStream: async () => {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            return undefined;
        }
        try {
            return await createGraceVoiceMediaStream();
        } catch {
            return undefined;
        }
    },
    createSession: (agent, config) => {
        const { mediaStream, ...sessionOptions } = config;
        if (mediaStream) {
            return new RealtimeSession(
                agent as RealtimeAgent,
                {
                    ...sessionOptions,
                    transport: new OpenAIRealtimeWebRTC({ mediaStream }),
                },
            ) as unknown as GraceRealtimeSessionLike;
        }
        return new RealtimeSession(
            agent as RealtimeAgent,
            sessionOptions,
        ) as unknown as GraceRealtimeSessionLike;
    },
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
    // True while we are closing a session ourselves, so the transport's own
    // "disconnected" report is not mistaken for a dropped connection.
    let closingIntentionally = false;
    let currentContext = "";
    let catalogNote = "";
    let currentRole: "merchandiser" | "navigator" = "merchandiser";
    let echoUnmuteTimer: ReturnType<typeof setTimeout> | null = null;

    const releaseMicrophone = (target: GraceRealtimeSessionLike | null) => {
        if (echoUnmuteTimer) {
            clearTimeout(echoUnmuteTimer);
            echoUnmuteTimer = null;
        }
        if (target) muteRealtimeMicrophone(target, false);
    };

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

    const notifyDisconnected = (unexpected = false) => {
        if (!connected) return;
        connected = false;
        callbacks.onDisconnect?.({ unexpected });
    };

    /** The transport's own view, when it exposes one; the SDK's WebSocket and WebRTC transports both do. */
    const transportDropped = () => {
        const status = session?.transport?.status;
        return status === "disconnected" || status === "disconnecting";
    };

    const isConnected = () => {
        // The socket can close without any server event (idle timeout, network
        // change, tab sleep). Before 2026-09-25 nothing noticed, so the next
        // send threw inside the SDK and the chat sat on "thinking" for good.
        if (connected && transportDropped()) notifyDisconnected(true);
        return connected;
    };

    const bindEvents = (activeSession: GraceRealtimeSessionLike) => {
        const isCurrentSession = () => session === activeSession;

        activeSession.transport?.on?.("connection_change", (...args: unknown[]) => {
            if (!isCurrentSession()) return;
            const status = args[0];
            if (status === "connected") notifyConnected();
            if (status === "disconnected") {
                releaseMicrophone(activeSession);
                notifyDisconnected(!closingIntentionally);
            }
        });
        let assistantSpeaking = false;
        let echoGuardUntil = 0;
        let lastAssistantText = "";
        // Set when the server heard speech while Grace was talking or in the
        // echo tail. Only a response that follows such speech is an echo reply;
        // a response that follows a tool result or a handoff is the real answer
        // and must not be cancelled (before 2026-09-25 it was, so the customer
        // had to repeat themselves after every fast tool call).
        let speechDuringGuard = false;

        const rememberAssistantText = (text: string) => {
            const trimmed = text.trim();
            if (trimmed) lastAssistantText = trimmed;
        };

        const beginSpeakingGuard = () => {
            assistantSpeaking = true;
            if (echoUnmuteTimer) {
                clearTimeout(echoUnmuteTimer);
                echoUnmuteTimer = null;
            }
            muteRealtimeMicrophone(activeSession, true);
            clearRealtimeInputBuffer(activeSession);
            callbacks.onModeChange?.("speaking");
        };

        const endSpeakingGuard = () => {
            assistantSpeaking = false;
            echoGuardUntil = Date.now() + GRACE_VOICE_ECHO_TAIL_MS;
            clearRealtimeInputBuffer(activeSession);
            callbacks.onModeChange?.("listening");
            echoUnmuteTimer = setTimeout(() => {
                echoUnmuteTimer = null;
                speechDuringGuard = false;
                if (isCurrentSession() && !assistantSpeaking) {
                    muteRealtimeMicrophone(activeSession, false);
                }
            }, GRACE_VOICE_ECHO_TAIL_MS);
        };

        const cancelEchoReply = () => {
            speechDuringGuard = false;
            cancelEchoResponse(activeSession);
        };

        const echoReplySuspected = () => speechDuringGuard && shouldCancelEchoGeneratedResponse({
            now: Date.now(),
            assistantSpeaking,
            echoGuardUntil,
        });

        activeSession.on("audio_start", () => {
            if (!isCurrentSession()) return;
            if (shouldCancelEchoGeneratedResponse({
                now: Date.now(),
                assistantSpeaking,
                echoGuardUntil,
            })) {
                cancelEchoResponse(activeSession);
                return;
            }
            beginSpeakingGuard();
        });
        activeSession.on("audio_stopped", () => {
            if (isCurrentSession()) endSpeakingGuard();
        });
        activeSession.on("agent_end", (...args: unknown[]) => {
            if (!isCurrentSession()) return;
            const output = args[2];
            if (typeof output === "string" && output.trim()) {
                rememberAssistantText(output);
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
                // Kept for transports that relay their state as a server event.
                if (event.status === "connected") notifyConnected();
                if (event.status === "disconnected") notifyDisconnected(!closingIntentionally);
                return;
            }

            if (event.type === "input_audio_buffer.speech_started") {
                if (isVoiceEchoGuardActive({
                    now: Date.now(),
                    assistantSpeaking,
                    echoGuardUntil,
                })) {
                    // Remember the speech: the reply it produces arrives as a
                    // later response.created and must still be cancelled.
                    speechDuringGuard = true;
                    clearRealtimeInputBuffer(activeSession);
                    if (shouldCancelEchoGeneratedResponse({
                        now: Date.now(),
                        assistantSpeaking,
                        echoGuardUntil,
                    })) {
                        cancelEchoResponse(activeSession);
                    }
                }
                return;
            }

            if (event.type === "response.created" && echoReplySuspected()) {
                cancelEchoReply();
                return;
            }

            if (
                (event.type === "response.output_audio.delta"
                    || event.type === "response.output_audio_transcript.delta"
                    || event.type === "output_audio_buffer.started")
                && !assistantSpeaking
            ) {
                if (echoReplySuspected()) {
                    cancelEchoReply();
                    return;
                }
                beginSpeakingGuard();
            }

            if (
                event.type === "conversation.item.input_audio_transcription.completed"
                && typeof event.transcript === "string"
                && event.transcript.trim()
            ) {
                if (shouldIgnoreVoiceUserTranscript({
                    now: Date.now(),
                    assistantSpeaking,
                    echoGuardUntil,
                    transcript: event.transcript,
                    lastAssistantText,
                })) {
                    if (shouldCancelEchoGeneratedResponse({
                        now: Date.now(),
                        assistantSpeaking,
                        echoGuardUntil,
                    })) {
                        cancelEchoResponse(activeSession);
                    } else {
                        clearRealtimeInputBuffer(activeSession);
                    }
                    return;
                }
                callbacks.onMessage?.({ role: "user", text: event.transcript.trim() });
                return;
            }

            const assistantText = assistantTextFromTransportEvent(event);
            if (assistantText) {
                rememberAssistantText(assistantText);
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
            if (session) {
                // Replacing a session is not a disconnect: detach it first so its
                // transport events are ignored, then let the new connect report.
                const previous = session;
                session = null;
                connected = false;
                releaseMicrophone(previous);
                closingIntentionally = true;
                try {
                    previous.close();
                } finally {
                    closingIntentionally = false;
                }
            }

            currentRole = "merchandiser";
            const agent = createCurrentAgent();
            const mediaStream = mode === "voice" && dependencies.createVoiceStream
                ? await dependencies.createVoiceStream().catch(() => undefined)
                : undefined;
            const activeSession = dependencies.createSession(agent, {
                model: GRACE_REALTIME_MODEL,
                // Text sessions must not use WebRTC — Chrome still requests the
                // microphone for a webrtc transport even when output is text.
                transport: mode === "voice" ? "webrtc" : "websocket",
                ...(mediaStream ? { mediaStream } : {}),
                config: {
                    outputModalities: [mode === "voice" ? "audio" : "text"],
                    voice: GRACE_REALTIME_VOICE,
                    speed: GRACE_REALTIME_SPEED,
                    audio: {
                        input: {
                            transcription: { model: "gpt-4o-mini-transcribe" },
                            noiseReduction: { type: "far_field" },
                            turnDetection: {
                                type: "semantic_vad",
                                eagerness: resolveGraceVadEagerness(),
                                interrupt_response: false,
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
            closingIntentionally = true;
            try {
                releaseMicrophone(session);
                session?.close();
            } finally {
                closingIntentionally = false;
            }
            session = null;
            notifyDisconnected(false);
        },

        interrupt() {
            session?.interrupt();
        },

        hasSession() {
            return session !== null;
        },

        isConnected,

        async sendContext(context) {
            currentContext = context;
            await refreshSession();
        },

        async compressSession(nextCatalogNote) {
            catalogNote = nextCatalogNote.trim();
            await refreshSession();
        },

        sendText(text) {
            if (!session || !isConnected()) throw new GraceRealtimeDisconnectedError();
            const normalized = text.trim();
            if (!normalized) return;
            try {
                session.sendMessage(normalized);
            } catch (error) {
                // The SDK throws "WebSocket is not connected" when the socket
                // closed without telling us; treat that as the disconnect it is.
                notifyDisconnected(true);
                throw new GraceRealtimeDisconnectedError(error instanceof Error ? error.message : undefined);
            }
        },
    };
}
