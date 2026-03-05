"use client";

import { useState, useRef, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";

type Message = { role: "user" | "grace"; text: string };

const welcomeMessage: Message = {
    role: "grace",
    text: "Welcome to your Grace workspace. How can I help you with your packaging project today?",
};

export default function GraceWorkspaceChat() {
    const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const askGrace = useAction(api.grace.askGrace);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;

        const userMsg: Message = { role: "user", text: trimmed };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        const history = [...messages, userMsg].map((m) => ({
            role: (m.role === "grace" ? "assistant" : "user") as "user" | "assistant",
            content: m.text,
        }));

        try {
            const response = await askGrace({ messages: history, voiceMode: false });
            setMessages((prev) => [...prev, { role: "grace", text: response }]);
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
            <div className="flex-1 overflow-auto px-7 py-6 bg-bone flex flex-col gap-5">
                {messages.map((m, i) => (
                    <div
                        key={i}
                        className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        {m.role === "grace" && (
                            <div className="w-7 h-7 min-w-7 rounded-full bg-obsidian border border-muted-gold/30 flex items-center justify-center mt-0.5 shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-muted-gold" />
                            </div>
                        )}
                        <div
                            className={`max-w-[72%] rounded-[3px] px-4 py-3 border ${
                                m.role === "grace"
                                    ? "bg-linen border-champagne rounded-tl-none"
                                    : "bg-obsidian border-ink rounded-tr-none"
                            }`}
                        >
                            {m.role === "grace" && (
                                <p className="font-sans text-[8px] tracking-[0.18em] uppercase text-muted-gold mb-1.5">
                                    Grace
                                </p>
                            )}
                            <p
                                className={`font-serif text-[14px] leading-[1.65] ${
                                    m.role === "grace" ? "text-obsidian" : "text-bone"
                                }`}
                            >
                                {m.text}
                            </p>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3 justify-start">
                        <div className="w-7 h-7 min-w-7 rounded-full bg-obsidian border border-muted-gold/30 flex items-center justify-center mt-0.5 shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-muted-gold animate-pulse" />
                        </div>
                        <div className="bg-linen border border-champagne rounded-[3px] rounded-tl-none px-4 py-3">
                            <p className="font-sans text-[8px] tracking-[0.18em] uppercase text-muted-gold mb-1.5">Grace</p>
                            <p className="font-serif text-[14px] text-ash italic">Thinking…</p>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-7 py-4 border-t border-champagne flex gap-3 items-center bg-linen shrink-0">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Continue the conversation with Grace..."
                    disabled={isLoading}
                    className="flex-1 font-serif text-[15px] text-obsidian bg-bone border border-champagne rounded-[3px] px-4 py-2.5 outline-none placeholder:text-ash placeholder:italic focus:border-muted-gold/60 transition-colors disabled:opacity-50"
                />
                <button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="font-sans text-[9px] tracking-[0.18em] uppercase bg-muted-gold text-obsidian border border-muted-gold rounded-sm px-5 py-[9px] hover:bg-muted-gold/90 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Send
                </button>
            </div>
        </div>
    );
}
