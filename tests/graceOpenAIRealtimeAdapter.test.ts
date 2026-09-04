import { describe, expect, it, vi } from "vitest";
import {
    buildGraceRealtimeTools,
    createGraceOpenAIRealtimeAdapter,
    getGraceRealtimeToolSpecs,
    GraceRealtimeConnectionCancelledError,
    type GraceRealtimeAgentConfig,
    type GraceRealtimeSessionLike,
} from "../src/lib/grace/openaiRealtimeAdapter";
import { GRACE_OPENAI_TOOL_SPECS } from "../src/lib/grace/openaiToolSpecs";
import { GRACE_REALTIME_MODEL, GRACE_REALTIME_VOICE } from "../src/lib/grace/openaiRealtimeConfig";

class FakeSession implements GraceRealtimeSessionLike {
    handlers = new Map<string, Array<(...args: unknown[]) => void>>();
    connect = vi.fn<GraceRealtimeSessionLike["connect"]>(async () => undefined);
    sendMessage = vi.fn();
    updateAgent = vi.fn(async (agent: unknown) => agent);
    updateHistory = vi.fn();
    interrupt = vi.fn();
    close = vi.fn();

    on(event: string, handler: (...args: unknown[]) => void) {
        const handlers = this.handlers.get(event) ?? [];
        handlers.push(handler);
        this.handlers.set(event, handlers);
        return this;
    }

    emit(event: string, ...args: unknown[]) {
        for (const handler of this.handlers.get(event) ?? []) handler(...args);
    }
}

describe("Grace OpenAI Realtime adapter", () => {
    it("exposes only tools authorized for the active storefront actor", () => {
        const baseContext = {
            surface: "storefront" as const,
            actorId: null,
            organizationId: null,
            conversationId: "grace-realtime",
            projectId: null,
            refineState: null,
            requestId: "grace-realtime-config",
        };

        expect(getGraceRealtimeToolSpecs({ ...baseContext, role: "public" }).map(({ name }) => name))
            .not.toContain("listGraceProjects");
        expect(getGraceRealtimeToolSpecs({
            ...baseContext,
            role: "customer",
            actorId: "user_customer",
        }).map(({ name }) => name)).toEqual(expect.arrayContaining([
            "listGraceProjects",
            "proposeProjectSave",
        ]));
    });

    it("connects a WebRTC session with gpt-realtime-2.1 and Marin", async () => {
        const session = new FakeSession();
        const createAgent = vi.fn((config: GraceRealtimeAgentConfig) => config);
        const createSession = vi.fn(() => session);
        const adapter = createGraceOpenAIRealtimeAdapter({
            baseInstructions: "Use verified catalog truth.",
            toolImplementations: Object.fromEntries(
                GRACE_OPENAI_TOOL_SPECS.map(({ name }) => [name, vi.fn()]),
            ),
            dependencies: { createAgent, createSession },
        });

        await adapter.connect({ clientSecret: "ek_test", mode: "voice" });

        expect(createAgent).toHaveBeenCalledWith(expect.objectContaining({
            name: "Grace",
            voice: GRACE_REALTIME_VOICE,
        }));
        expect(createAgent).toHaveBeenCalledWith(expect.objectContaining({
            name: "Navigator",
            voice: GRACE_REALTIME_VOICE,
        }));
        expect(createSession).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                model: GRACE_REALTIME_MODEL,
                transport: "webrtc",
                config: expect.objectContaining({
                    outputModalities: ["audio"],
                    voice: GRACE_REALTIME_VOICE,
                }),
            }),
        );
        expect(session.connect).toHaveBeenCalledWith({ apiKey: "ek_test" });
    });

    it("sends typed turns and updates context without triggering a response", async () => {
        const session = new FakeSession();
        const createAgent = vi.fn((config: GraceRealtimeAgentConfig) => config);
        const adapter = createGraceOpenAIRealtimeAdapter({
            baseInstructions: "Base truth rules.",
            toolImplementations: Object.fromEntries(
                GRACE_OPENAI_TOOL_SPECS.map(({ name }) => [name, vi.fn()]),
            ),
            dependencies: { createAgent, createSession: () => session },
        });
        await adapter.connect({ clientSecret: "ek_test", mode: "text" });

        adapter.sendText("Show me amber 9 mL bottles");
        await adapter.sendContext("Active Refine thread: 17-415");

        expect(session.sendMessage).toHaveBeenCalledWith("Show me amber 9 mL bottles");
        expect(session.sendMessage).toHaveBeenCalledTimes(1);
        expect(createAgent).toHaveBeenLastCalledWith(expect.objectContaining({
            instructions: expect.stringContaining("Active Refine thread: 17-415"),
        }));
        expect(session.updateAgent).toHaveBeenCalledTimes(1);

        await adapter.compressSession("LAST CATALOG RESULT: searchCatalog\namber roller");
        expect(session.updateAgent).toHaveBeenCalledTimes(2);
        expect(session.updateHistory).toHaveBeenCalled();
        expect(createAgent).toHaveBeenCalledWith(expect.objectContaining({
            name: "Grace",
            instructions: expect.stringContaining("LAST CATALOG RESULT: searchCatalog"),
        }));
        expect(createAgent).toHaveBeenCalledWith(expect.objectContaining({
            name: "Navigator",
            instructions: expect.stringContaining("LAST CATALOG RESULT: searchCatalog"),
        }));
    });

    it("maps transcripts, response completion, connection, and errors to callbacks", async () => {
        const session = new FakeSession();
        const onConnect = vi.fn();
        const onDisconnect = vi.fn();
        const onTranscriptDelta = vi.fn();
        const onMessage = vi.fn();
        const onError = vi.fn();
        const adapter = createGraceOpenAIRealtimeAdapter({
            baseInstructions: "Truth first.",
            toolImplementations: Object.fromEntries(
                GRACE_OPENAI_TOOL_SPECS.map(({ name }) => [name, vi.fn()]),
            ),
            callbacks: { onConnect, onDisconnect, onTranscriptDelta, onMessage, onError },
            dependencies: {
                createAgent: (config) => config,
                createSession: () => session,
            },
        });
        await adapter.connect({ clientSecret: "ek_test", mode: "voice" });

        session.emit("transport_event", { type: "connection_change", status: "connected" });
        session.emit("transport_event", {
            type: "conversation.item.input_audio_transcription.completed",
            transcript: "Show me the caps",
        });
        session.emit("transport_event", {
            type: "response.output_audio_transcript.delta",
            delta: "Here are ",
        });
        session.emit("agent_end", {}, {}, "Here are the compatible caps.");
        session.emit("error", { type: "error", error: new Error("network") });
        session.emit("transport_event", { type: "connection_change", status: "disconnected" });

        expect(onConnect).toHaveBeenCalledTimes(1);
        expect(onMessage).toHaveBeenNthCalledWith(1, { role: "user", text: "Show me the caps" });
        expect(onTranscriptDelta).toHaveBeenCalledWith("Here are ");
        expect(onMessage).toHaveBeenNthCalledWith(2, {
            role: "assistant",
            text: "Here are the compatible caps.",
        });
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
        expect(onDisconnect).toHaveBeenCalledTimes(1);
    });

    it("executes the matching deterministic client implementation", async () => {
        const searchCatalog = vi.fn(async (args) => ({ ok: true, args }));
        const tools = buildGraceRealtimeTools(
            [GRACE_OPENAI_TOOL_SPECS[0]],
            { searchCatalog },
        );

        const result = await tools[0].invoke(
            {} as never,
            JSON.stringify({
                searchTerm: "amber cylinder",
                categoryLimit: null,
                familyLimit: "Cylinder",
                applicatorFilter: null,
            }),
        );

        expect(searchCatalog).toHaveBeenCalledWith(expect.objectContaining({
            searchTerm: "amber cylinder",
            familyLimit: "Cylinder",
        }));
        expect(JSON.parse(String(result))).toEqual(expect.objectContaining({ ok: true }));
    });

    it("fails closed when a declared tool has no implementation", () => {
        expect(() => buildGraceRealtimeTools([GRACE_OPENAI_TOOL_SPECS[0]], {})).toThrow(
            "Missing Grace tool implementation: searchCatalog",
        );
    });

    it("interrupts and closes the active session", async () => {
        const session = new FakeSession();
        const adapter = createGraceOpenAIRealtimeAdapter({
            baseInstructions: "Truth first.",
            toolImplementations: Object.fromEntries(
                GRACE_OPENAI_TOOL_SPECS.map(({ name }) => [name, vi.fn()]),
            ),
            dependencies: {
                createAgent: (config) => config,
                createSession: () => session,
            },
        });
        await adapter.connect({ clientSecret: "ek_test", mode: "voice" });

        adapter.interrupt();
        adapter.disconnect();

        expect(session.interrupt).toHaveBeenCalledTimes(1);
        expect(session.close).toHaveBeenCalledTimes(1);
        expect(adapter.isConnected()).toBe(false);
    });

    it("cancels and closes a session whose handshake finishes after disconnect", async () => {
        let finishHandshake: (() => void) | undefined;
        const session = new FakeSession();
        session.connect.mockImplementation(() => new Promise<void>((resolve) => {
            finishHandshake = resolve;
        }));
        const onConnect = vi.fn();
        const adapter = createGraceOpenAIRealtimeAdapter({
            baseInstructions: "Truth first.",
            toolImplementations: Object.fromEntries(
                GRACE_OPENAI_TOOL_SPECS.map(({ name }) => [name, vi.fn()]),
            ),
            callbacks: { onConnect },
            dependencies: {
                createAgent: (config) => config,
                createSession: () => session,
            },
        });

        const connecting = adapter.connect({ clientSecret: "ek_test", mode: "voice" });
        expect(adapter.hasSession()).toBe(true);
        adapter.disconnect();
        finishHandshake?.();

        await expect(connecting).rejects.toBeInstanceOf(GraceRealtimeConnectionCancelledError);
        expect(session.close).toHaveBeenCalled();
        expect(onConnect).not.toHaveBeenCalled();
        expect(adapter.hasSession()).toBe(false);
        expect(adapter.isConnected()).toBe(false);
    });
});
