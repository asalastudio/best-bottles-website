"use client";

import { useCallback, useState } from "react";
import type { KnowledgeCitation } from "@/lib/knowledge/contracts";

export type EmployeeKnowledgeMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    citations: KnowledgeCitation[];
    requestId: string | null;
};

const createId = () => globalThis.crypto?.randomUUID?.()
    ?? `knowledge-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useEmployeeKnowledgeChat() {
    const [messages, setMessages] = useState<EmployeeKnowledgeMessage[]>([]);
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState("");
    const [conversationId, setConversationId] = useState(createId);

    const send = useCallback(async (text?: string) => {
        const content = (text ?? input).trim();
        if (!content || isSending) return;

        const userMessage: EmployeeKnowledgeMessage = {
            id: createId(),
            role: "user",
            content,
            citations: [],
            requestId: null,
        };
        const nextMessages = [...messages, userMessage];
        setMessages(nextMessages);
        setError("");
        setIsSending(true);

        try {
            const response = await fetch("/api/knowledge/chat", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    conversationId,
                    messages: nextMessages.slice(-20).map(({ role, content: messageContent }) => ({
                        role,
                        content: messageContent,
                    })),
                }),
            });
            const payload = await response.json() as {
                message?: string;
                citations?: KnowledgeCitation[];
                requestId?: string;
                error?: string;
            };
            if (!response.ok || typeof payload.message !== "string") {
                throw new Error(payload.error || "Grace is temporarily unavailable.");
            }
            setMessages((current) => [...current, {
                id: createId(),
                role: "assistant",
                content: payload.message as string,
                citations: Array.isArray(payload.citations) ? payload.citations : [],
                requestId: typeof payload.requestId === "string" ? payload.requestId : null,
            }]);
            setInput("");
        } catch {
            setError("Grace could not verify that answer right now. Your question is still in the composer; try again in a moment.");
        } finally {
            setIsSending(false);
        }
    }, [conversationId, input, isSending, messages]);

    const reset = useCallback(() => {
        setMessages([]);
        setInput("");
        setError("");
        setConversationId(createId());
    }, []);

    return { messages, input, setInput, isSending, error, send, reset, conversationId };
}
