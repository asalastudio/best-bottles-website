"use client";

import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "grace"; text: string };

const welcomeMessage: Message = {
    role: "grace",
    text: "Welcome to your Grace workspace. How can I help you with your packaging project today?",
};

export default function GraceWorkspaceChat({
    projectId,
    initialMessages,
}: {
    projectId: string | null;
    initialMessages: Message[];
}) {
    const [messages, setMessages] = useState<Message[]>(initialMessages.length > 0 ? initialMessages : [welcomeMessage]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading || !projectId) return;

        const userMsg: Message = { role: "user", text: trimmed };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            const response = await fetch("/api/portal/grace/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    projectId,
                    message: trimmed,
                }),
            });

            const data = (await response.json()) as { assistantMessage?: string; error?: string };

            if (!response.ok || !data.assistantMessage) {
                throw new Error(data.error ?? "Unable to reach Grace.");
            }

            setMessages((prev) => [...prev, { role: "grace", text: data.assistantMessage as string }]);
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: "grace", text: "I had trouble connecting just now. Please try again in a moment." },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") handleSend();
    };

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Messages */}
            <div className="flex-1 overflow-auto px-7 py-6 bg-neutral-50 flex flex-col gap-5">
                {messages.map((m, i) => (
                    <div
                        key={i}
                        className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        {m.role === "grace" && (
                            <div className="w-7 h-7 min-w-7 rounded-full bg-neutral-900 flex items-center justify-center mt-0.5 shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            </div>
                        )}
                        <div
                            className={`max-w-[72%] rounded-md px-4 py-3 border ${
                                m.role === "grace"
                                    ? "bg-white border-neutral-200 rounded-tl-none"
                                    : "bg-neutral-900 border-neutral-900 rounded-tr-none"
                            }`}
                        >
                            {m.role === "grace" && (
                                <p className="font-sans text-[8px] tracking-[0.18em] uppercase text-neutral-400 mb-1.5">
                                    Grace
                                </p>
                            )}
                            <p
                                className={`font-sans text-[14px] leading-[1.65] ${
                                    m.role === "grace" ? "text-neutral-900" : "text-white"
                                }`}
                            >
                                {m.text}
                            </p>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3 justify-start">
                        <div className="w-7 h-7 min-w-7 rounded-full bg-neutral-900 flex items-center justify-center mt-0.5 shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        </div>
                        <div className="bg-white border border-neutral-200 rounded-md rounded-tl-none px-4 py-3">
                            <p className="font-sans text-[8px] tracking-[0.18em] uppercase text-neutral-400 mb-1.5">Grace</p>
                            <p className="font-sans text-[14px] text-neutral-500 italic">Thinking…</p>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-7 py-4 border-t border-neutral-200 flex gap-3 items-center bg-white shrink-0">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={projectId ? "Continue the conversation with Grace..." : "Create a project to start chatting with Grace"}
                    disabled={isLoading || !projectId}
                    className="flex-1 font-sans text-[15px] text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-md px-4 py-2.5 outline-none placeholder:text-neutral-400 focus:border-neutral-300 transition-colors disabled:opacity-50"
                />
                <button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim() || !projectId}
                    className="font-sans text-[11px] font-medium bg-neutral-900 text-white border border-neutral-900 rounded-md px-4 py-[9px] hover:bg-neutral-800 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Send
                </button>
            </div>
        </div>
    );
}
