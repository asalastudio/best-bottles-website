"use client";

import { useGrace } from "@/components/useGrace";

/** Opens Grace with a question already asked, for follow-ups on an answer or a bottle. */
export default function HelpGraceButton({ question, label = "Ask Grace a follow-up", tone = "dark" }: { question?: string; label?: string; tone?: "dark" | "light" }) {
    const { openPanel, send } = useGrace();
    return (
        <button
            type="button"
            onClick={() => {
                openPanel({ source: "site" });
                if (question) void send(question);
            }}
            className={tone === "dark"
                ? "inline-flex h-11 items-center rounded-md bg-obsidian px-5 text-sm font-medium text-warm-white hover:bg-obsidian/90"
                : "inline-flex h-11 items-center rounded-md border border-champagne px-5 text-sm hover:border-gold-dim"}
        >
            {label}
        </button>
    );
}
