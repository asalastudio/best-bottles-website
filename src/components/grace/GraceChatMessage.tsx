"use client";

import { useEffect, useRef } from "react";
import type { GraceMessage } from "@/components/GraceContext";
import GraceActionRenderer from "./GraceActionRenderer";
import { useGrace } from "@/components/useGrace";
import { analytics } from "@/lib/analytics";

interface GraceChatMessageProps {
    message: GraceMessage;
}

export default function GraceChatMessage({ message }: GraceChatMessageProps) {
    const { confirmAction, dismissAction } = useGrace();
    const isUser = message.role === "user";
    const actions = message.actions ?? (message.action ? [message.action] : []);
    const trackedMultiActionRef = useRef<string | null>(null);

    useEffect(() => {
        if (isUser || actions.length < 2 || trackedMultiActionRef.current === message.id) return;
        trackedMultiActionRef.current = message.id;
        analytics.graceMultiActionRendered({
            messageId: message.id,
            actionCount: actions.length,
            actionTypes: actions.map((action) => action.type).join(", "),
        });
    }, [actions, isUser, message.id]);

    if (isUser) {
        return (
            <div className="flex justify-end mb-3">
                <div className="max-w-[80%] px-3.5 py-2.5 text-[14px] leading-relaxed text-obsidian bg-obsidian/[0.05] rounded-2xl rounded-br-sm">
                    {message.attachments?.map((a) => (
                        a.url && a.mime.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL changes per upload; Next/Image needs whitelisted domain config
                            <img
                                key={a.id}
                                src={a.url}
                                alt={a.name}
                                className="rounded-md mb-2 max-h-[180px] object-cover"
                                style={{ maxWidth: "100%" }}
                            />
                        ) : null
                    ))}
                    {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
                </div>
            </div>
        );
    }

    if (actions.length) {
        console.log("[Grace] GraceChatMessage rendering actions:", actions.map((action) => action.type).join(", "), "for message:", message.id);
    }
    return (
        <div
            className={`mb-4 ${message.pinned ? "pl-3" : ""}`}
            style={message.pinned ? { borderLeft: "2px solid var(--color-muted-gold)" } : undefined}
        >
            <p className="text-[14.5px] leading-[1.65] text-obsidian/85 whitespace-pre-wrap font-sans">
                {message.content}
            </p>
            {actions.map((action, index) => (
                <GraceActionRenderer
                    key={`${message.id}-${action.type}-${index}`}
                    action={action}
                    onConfirmAction={() => confirmAction(message.id)}
                    onDismissAction={() => dismissAction(message.id)}
                />
            ))}
        </div>
    );
}

interface StreamingMessageProps {
    text: string;
}

export function StreamingMessage({ text }: StreamingMessageProps) {
    if (!text) return null;

    return (
        <div className="mb-4">
            <p className="text-[14.5px] leading-[1.65] text-obsidian/85 whitespace-pre-wrap font-sans">
                {text}
                <span className="inline-block w-[3px] h-[16px] bg-obsidian/30 ml-0.5 animate-pulse rounded-[1px] align-text-bottom" />
            </p>
        </div>
    );
}

export function ThinkingIndicator() {
    return (
        <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex gap-[5px]" aria-label="Grace is thinking">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="w-[5px] h-[5px] rounded-full bg-obsidian/25 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms`, animationDuration: "0.9s" }}
                    />
                ))}
            </span>
            <span className="text-[12px] text-obsidian/40 font-sans">Grace is thinking&hellip;</span>
        </div>
    );
}
