"use client";

/**
 * GraceElevenLabsProvider — ElevenLabs Conversational AI integration.
 *
 * Drop-in replacement for GraceProvider that uses ElevenLabs for voice
 * instead of OpenAI Realtime. Exposes the same GraceContextValue so all
 * downstream UI components (GraceSidePanel, etc.) work unchanged.
 */

import {
    useState,
    useRef,
    useCallback,
    useEffect,
    type ReactNode,
} from "react";
import { useConversation } from "@elevenlabs/react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCart } from "./CartProvider";
import {
    GraceContext,
    type GraceStatus,
    type GraceAction,
    type GraceMessage,
    type ProductCard,
    type KitItem,
    type PanelMode,
} from "./GraceContext";

// ─── Strip markdown ──────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/_(.*?)_/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^[-*+]\s+/gm, "")
        .replace(/`([^`]*)`/g, "$1")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export default function GraceElevenLabsProvider({ children }: { children: ReactNode }) {
    const { addItems: addToCart } = useCart();
    const [panelMode, setPanelMode] = useState<PanelMode>("closed");
    const [status, setStatus] = useState<GraceStatus>("idle");
    const [messages, setMessages] = useState<GraceMessage[]>([]);
    const [input, setInput] = useState("");
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [conversationActive, setConversationActive] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

    const askGrace = useAction(api.grace.askGrace);

    // ── ElevenLabs conversation hook ─────────────────────────────────────────

    const conversation = useConversation({
        clientTools: {
            // ── showProducts: Display product card grid ──────────────────────
            showProducts: async (parameters: { query: string; family?: string }) => {
                try {
                    const r = await fetch("/api/elevenlabs/server-tools", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            tool_name: "searchCatalog",
                            parameters: {
                                searchTerm: parameters.query ?? "",
                                familyLimit: parameters.family,
                            },
                        }),
                    });
                    const data = await r.json() as { result?: ProductCard[] };
                    const products: ProductCard[] = Array.isArray(data.result) ? data.result : [];
                    if (products.length > 0) {
                        setMessages((prev) => [
                            ...prev,
                            {
                                role: "grace",
                                content: "",
                                id: `a-${Date.now()}`,
                                action: { type: "showProducts", products: products.slice(0, 6) },
                            },
                        ]);
                        // Return actual product data so Grace knows what she's presenting
                        const summary = products.slice(0, 6).map((p) =>
                            [p.itemName, p.capacity, p.color].filter(Boolean).join(" ")
                        ).join("; ");
                        return `Found ${products.length} matching products. Showing: ${summary}. Product cards are now displayed to the customer.`;
                    }
                    return "No products found matching that description. Try a broader search term.";
                } catch (e) {
                    console.error("[Grace EL] showProducts error:", e);
                    return "Catalog search failed. Please try again.";
                }
            },

            // ── compareProducts: Side-by-side comparison ────────────────────
            compareProducts: async (parameters: { query: string; family?: string }) => {
                try {
                    const r = await fetch("/api/elevenlabs/server-tools", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            tool_name: "searchCatalog",
                            parameters: {
                                searchTerm: parameters.query ?? "",
                                familyLimit: parameters.family,
                            },
                        }),
                    });
                    const data = await r.json() as { result?: ProductCard[] };
                    const products: ProductCard[] = Array.isArray(data.result) ? data.result : [];
                    if (products.length > 0) {
                        setMessages((prev) => [
                            ...prev,
                            {
                                role: "grace",
                                content: "",
                                id: `a-${Date.now()}`,
                                action: { type: "compareProducts", products: products.slice(0, 4) },
                            },
                        ]);
                        const summary = products.slice(0, 4).map((p) =>
                            [p.itemName, p.capacity, p.color].filter(Boolean).join(" ")
                        ).join("; ");
                        return `Comparing ${Math.min(products.length, 4)} products: ${summary}. Comparison cards are now displayed to the customer.`;
                    }
                    return "No products found to compare for that description.";
                } catch (e) {
                    console.error("[Grace EL] compareProducts error:", e);
                    return "Catalog search failed. Please try again.";
                }
            },

            // ── proposeCartAdd: Cart add with confirmation ──────────────────
            proposeCartAdd: (parameters: {
                products: Array<{
                    itemName: string;
                    graceSku: string;
                    quantity?: number;
                    webPrice1pc?: number;
                }>;
            }) => {
                const products = (parameters.products ?? []).map((p) => ({
                    ...p,
                    quantity: p.quantity ?? 1,
                }));
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "grace",
                        content: "",
                        id: `a-${Date.now()}`,
                        action: {
                            type: "proposeCartAdd",
                            products,
                            awaitingConfirmation: true,
                        },
                    },
                ]);
                return "Confirmation card shown to customer. Waiting for their response.";
            },

            // ── navigateToPage: Navigate or show link card ──────────────────
            navigateToPage: (parameters: {
                path: string;
                title: string;
                description?: string;
                autoNavigate?: boolean;
            }) => {
                const navPath = parameters.path ?? "/";
                const shouldAutoNav = parameters.autoNavigate === true;

                setMessages((prev) => [
                    ...prev,
                    {
                        role: "grace",
                        content: "",
                        id: `a-${Date.now()}`,
                        action: {
                            type: "navigateToPage",
                            path: navPath,
                            title: parameters.title ?? "Page",
                            description: parameters.description,
                            autoNavigate: shouldAutoNav,
                        },
                    },
                ]);

                if (shouldAutoNav) {
                    setPendingNavigation(navPath);
                    if (conversationActive) {
                        setPanelMode("strip");
                    } else {
                        setPanelMode("closed");
                    }
                }

                return shouldAutoNav
                    ? "Navigating the customer to the page now."
                    : "Navigation card shown to customer.";
            },

            // ── prefillForm: Pre-fill a form ────────────────────────────────
            prefillForm: (parameters: {
                formType: "sample" | "quote" | "contact" | "newsletter";
                fields: Record<string, string>;
            }) => {
                const fType = parameters.formType ?? "contact";
                const fFields = parameters.fields ?? {};

                window.dispatchEvent(
                    new CustomEvent("grace:prefillForm", {
                        detail: { formType: fType, fields: fFields },
                    })
                );

                setMessages((prev) => [
                    ...prev,
                    {
                        role: "grace",
                        content: "",
                        id: `a-${Date.now()}`,
                        action: { type: "prefillForm", formType: fType, fields: fFields },
                    },
                ]);

                return "Form pre-filled and shown to customer for review.";
            },
        },

        onConnect: () => {
            console.log("[Grace EL] Connected");
            setStatus("listening");
        },

        onDisconnect: () => {
            console.log("[Grace EL] Disconnected");
            setConversationActive(false);
            setStatus("idle");
        },

        onMessage: (message) => {
            if (message.source === "user" && message.message) {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "user",
                        content: message.message,
                        id: `u-${Date.now()}`,
                    },
                ]);
            } else if (message.source === "ai" && message.message) {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "grace",
                        content: stripMarkdown(message.message),
                        id: `g-${Date.now()}`,
                    },
                ]);
            }
        },

        onModeChange: (mode) => {
            if (mode.mode === "speaking") {
                setStatus("speaking");
            } else if (mode.mode === "listening") {
                setStatus("listening");
            }
        },

        onError: (error) => {
            console.error("[Grace EL] Error:", error);
            setErrorMessage(typeof error === "string" ? error : "Connection error");
            setStatus("error");
            setTimeout(() => {
                setErrorMessage("");
                setStatus(conversationActive ? "listening" : "idle");
            }, 4000);
        },
    });

    // ── Panel controls ───────────────────────────────────────────────────────

    const isOpen = panelMode !== "closed";
    const openPanel = useCallback(() => setPanelMode("open"), []);
    const closePanel = useCallback(() => {
        setPanelMode("closed");
        setConversationActive(false);
        setMessages([]);
        if (conversation.status === "connected") {
            conversation.endSession();
        }
    }, [conversation]);
    const minimizeToStrip = useCallback(() => setPanelMode("strip"), []);
    const open = openPanel;

    const close = useCallback(() => {
        setPanelMode("closed");
        setConversationActive(false);
        if (conversation.status === "connected") {
            conversation.endSession();
        }
        setStatus("idle");
        setMessages([]);
    }, [conversation]);

    const onNavigate = useCallback(() => {
        if (conversationActive) {
            setPanelMode("strip");
        } else {
            setPanelMode("closed");
        }
    }, [conversationActive]);

    const clearPendingNavigation = useCallback(() => {
        setPendingNavigation(null);
    }, []);

    // ── Start ElevenLabs voice conversation ──────────────────────────────────

    const startConversation = useCallback(async () => {
        try {
            setConversationActive(true);
            setStatus("connecting");
            setErrorMessage("");

            // Request microphone permission before connecting (required by browsers)
            await navigator.mediaDevices.getUserMedia({ audio: true });

            const t0 = performance.now();

            // Use signed URL + WebSocket (WebRTC/LiveKit was timing out for some networks)
            const res = await fetch("/api/elevenlabs/signed-url");
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(
                    (err as { error?: string }).error ??
                        "Failed to get ElevenLabs connection. Check ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in .env.local."
                );
            }
            const { signedUrl, systemPrompt } = (await res.json()) as {
                signedUrl?: string;
                systemPrompt?: string | null;
            };
            if (!signedUrl) {
                throw new Error("ElevenLabs did not return a valid connection URL.");
            }

            console.log(`[Grace EL] Starting WebSocket session`);

            await conversation.startSession({
                signedUrl,
                connectionType: "websocket",
                ...(systemPrompt
                    ? { overrides: { agent: { prompt: { prompt: systemPrompt } } } }
                    : {}),
            });

            console.log(`[Grace EL] Connected: ${Math.round(performance.now() - t0)}ms`);
            // Set initial volume from voiceEnabled state
            conversation.setVolume({ volume: voiceEnabled ? 1 : 0 });
            setStatus("listening");
        } catch (err) {
            console.error("[Grace EL] Connection failed:", err);
            setConversationActive(false);
            const msg = err instanceof Error ? err.message : "Failed to start voice conversation";
            setErrorMessage(msg);
            setStatus("error");
            setTimeout(() => {
                setErrorMessage("");
                setStatus("idle");
            }, 8000);
        }
    }, [conversation, voiceEnabled]);

    const endConversation = useCallback(() => {
        setConversationActive(false);
        if (conversation.status === "connected") {
            conversation.endSession();
        }
        setStatus("idle");
    }, [conversation]);

    // ── Interrupt Grace ──────────────────────────────────────────────────────

    const stopSpeaking = useCallback(() => {
        // ElevenLabs handles barge-in natively via VAD
        if (status === "speaking") setStatus("listening");
    }, [status]);

    const toggleVoice = useCallback(() => {
        setVoiceEnabled((v) => {
            const next = !v;
            if (conversation.status === "connected") {
                conversation.setVolume({ volume: next ? 1 : 0 });
            }
            return next;
        });
    }, [conversation]);

    // ── Send text message ────────────────────────────────────────────────────

    const send = useCallback(
        async (text?: string, fromVoice = false) => {
            const msg = (text ?? input).trim();
            if (!msg) return;
            setInput("");

            // Route through ElevenLabs if conversation is active
            if (conversationActive && conversation.status === "connected") {
                setMessages((prev) => [
                    ...prev,
                    { role: "user", content: msg, id: `u-${Date.now()}` },
                ]);
                conversation.sendUserMessage(msg);
                setStatus("thinking");
                return;
            }

            // Fall back to Claude pipeline for text-only chat
            const userMsg: GraceMessage = { role: "user", content: msg, id: `${Date.now()}` };
            setMessages((prev) => [...prev, userMsg]);
            setStatus("thinking");
            setErrorMessage("");

            try {
                const history: Array<{ role: "user" | "assistant"; content: string }> = [
                    ...messages.map((m) => ({
                        role: (m.role === "grace" ? "assistant" : "user") as "user" | "assistant",
                        content: m.content,
                    })),
                    { role: "user" as const, content: msg },
                ];

                const tLlm = performance.now();
                const response = await Promise.race([
                    (askGrace as (args: { messages: typeof history; voiceMode?: boolean }) => Promise<string>)({
                        messages: history,
                        voiceMode: fromVoice,
                    }),
                    new Promise<string>((_, reject) =>
                        setTimeout(
                            () => reject(new Error("Grace took too long to respond. Please try again.")),
                            45000
                        )
                    ),
                ]);
                console.log(`[Grace EL] LLM round-trip: ${Math.round(performance.now() - tLlm)}ms`);

                const graceText = stripMarkdown(response);
                setMessages((prev) => [
                    ...prev,
                    { role: "grace", content: graceText, id: `${Date.now() + 1}` },
                ]);
                setStatus("idle");
            } catch (err) {
                const errMsg =
                    err instanceof Error
                        ? err.message
                        : "I had trouble connecting just now. Please try again in a moment.";
                console.error("[Grace EL] askGrace failed:", err);
                setErrorMessage(errMsg);
                setMessages((prev) => [
                    ...prev,
                    { role: "grace", content: errMsg, id: `${Date.now() + 1}` },
                ]);
                setStatus("error");
                setTimeout(() => {
                    setStatus("idle");
                    setErrorMessage("");
                }, 4000);
            }
        },
        [input, messages, askGrace, conversationActive, conversation]
    );

    // ── Legacy dictation stubs ───────────────────────────────────────────────

    const startDictation = useCallback(async () => {
        if (!conversationActive) startConversation();
    }, [conversationActive, startConversation]);

    const stopDictation = useCallback(() => {
        // No-op — ElevenLabs handles VAD natively
    }, []);

    // ── Action confirmation (cart adds) ──────────────────────────────────────

    const confirmAction = useCallback(
        (messageId: string) => {
            setMessages((prev) => {
                const msg = prev.find((m) => m.id === messageId);
                if (msg?.action?.type === "proposeCartAdd") {
                    addToCart(
                        msg.action.products.map((p) => ({
                            graceSku: p.graceSku,
                            itemName: p.itemName,
                            quantity: p.quantity,
                            unitPrice: p.webPrice1pc ?? null,
                            family: p.family,
                            capacity: p.capacity,
                            color: p.color,
                        }))
                    );
                }
                return prev.map((m) => {
                    if (m.id !== messageId || !m.action) return m;
                    if (m.action.type === "proposeCartAdd") {
                        return { ...m, action: { ...m.action, awaitingConfirmation: false } };
                    }
                    return m;
                });
            });

            // Inform ElevenLabs agent that customer confirmed
            if (conversationActive && conversation.status === "connected") {
                conversation.sendUserMessage(
                    "The customer confirmed. The items have been added to their cart."
                );
            }
        },
        [conversationActive, conversation, addToCart]
    );

    const dismissAction = useCallback(
        (messageId: string) => {
            setMessages((prev) =>
                prev.map((m) => {
                    if (m.id !== messageId || !m.action) return m;
                    if (m.action.type === "proposeCartAdd") {
                        return { ...m, action: { ...m.action, awaitingConfirmation: false } };
                    }
                    return m;
                })
            );

            if (conversationActive && conversation.status === "connected") {
                conversation.sendUserMessage(
                    "The customer declined. Do not add those items."
                );
            }
        },
        [conversationActive, conversation]
    );

    // ── Cleanup on unmount ───────────────────────────────────────────────────

    const conversationRef = useRef(conversation);
    useEffect(() => { conversationRef.current = conversation; });

    useEffect(() => {
        return () => {
            if (conversationRef.current.status === "connected") {
                conversationRef.current.endSession();
            }
        };
    }, []);

    return (
        <GraceContext.Provider
            value={{
                panelMode,
                openPanel,
                closePanel,
                minimizeToStrip,
                isOpen,
                open,
                close,
                status,
                messages,
                input,
                setInput,
                voiceEnabled,
                toggleVoice,
                send,
                startDictation,
                stopDictation,
                stopSpeaking,
                errorMessage,
                conversationActive,
                startConversation,
                endConversation,
                confirmAction,
                dismissAction,
                onNavigate,
                pendingNavigation,
                clearPendingNavigation,
            }}
        >
            {children}
        </GraceContext.Provider>
    );
}
