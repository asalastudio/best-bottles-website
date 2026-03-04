"use client";

import { useState } from "react";

const initialMessages = [
    {
        role: "grace" as const,
        text: "Welcome back to your workspace, Lumière Atelier. Your Spring Serum Launch project is open. Ready to continue?",
    },
    {
        role: "user" as const,
        text: "Yes — I want to finalize the closure selection for the 30ml Frosted Elegant.",
    },
    {
        role: "grace" as const,
        text: "You've narrowed it to two options: the Antique Gold Fine Mist Sprayer and the Matte Black Fine Mist Sprayer, both 18-415 compatible. Given your brand positioning — cool-toned minimalism — the Matte Black creates stronger visual contrast with frosted glass and tends to read more premium at retail. The Gold is warmer and more traditional. Which direction feels right for your Spring collection?",
    },
];

export default function GraceWorkspaceChat() {
    const [messages, setMessages] = useState(initialMessages);
    const [input, setInput] = useState("");

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed) return;
        setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
        setInput("");
        // TODO: wire to askGrace Convex action
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
            </div>

            {/* Input */}
            <div className="px-7 py-4 border-t border-champagne flex gap-3 items-center bg-linen shrink-0">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Continue the conversation with Grace..."
                    className="flex-1 font-serif text-[15px] text-obsidian bg-bone border border-champagne rounded-[3px] px-4 py-2.5 outline-none placeholder:text-ash placeholder:italic focus:border-muted-gold/60 transition-colors"
                />
                <button
                    onClick={handleSend}
                    className="font-sans text-[9px] tracking-[0.18em] uppercase bg-muted-gold text-obsidian border border-muted-gold rounded-sm px-5 py-[9px] hover:bg-muted-gold/90 transition-colors shrink-0"
                >
                    Send
                </button>
            </div>
        </div>
    );
}
