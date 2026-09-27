"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import type { GraceMessage } from "@/components/GraceContext";
import { ThumbsUp, ThumbsDown } from "@phosphor-icons/react";
import { useGraceRedesignCopy } from "./redesignCopy";
import GraceActionRenderer from "./GraceActionRenderer";
import { useGrace } from "@/components/useGrace";
import { analytics } from "@/lib/analytics";
import { isGraceProductPageHref } from "@/lib/grace/agenticHandoff";
import { splitGraceMessageLinks } from "@/lib/grace/messageLinks";

interface GraceChatMessageProps {
    message: GraceMessage;
}

/**
 * Grace's text with its site links rendered as links. The text fallback has
 * no navigation tools, so it answers with markdown links to product pages
 * (see convex/gracePrompt.ts, TEXT_CHANNEL_LINKS); a product link hands off
 * the same way a product card does.
 */
export function GraceMessageText({ text }: { text: string }) {
    const { followSurfacedProduct } = useGrace();
    const segments = useMemo(() => splitGraceMessageLinks(text), [text]);
    return (
        <>
            {segments.map((segment, index) => {
                if (segment.type === "text") return <Fragment key={index}>{segment.text}</Fragment>;
                const handoff = followSurfacedProduct && isGraceProductPageHref(segment.href)
                    ? (event: MouseEvent<HTMLAnchorElement>) => {
                        event.preventDefault();
                        followSurfacedProduct({ href: segment.href });
                    }
                    : undefined;
                return (
                    <Link
                        key={index}
                        href={segment.href}
                        onClick={handoff}
                        data-grace-message-link="true"
                        className="underline underline-offset-2 decoration-[1px] hover:text-obsidian"
                        style={{ textDecorationColor: "var(--color-muted-gold)" }}
                    >
                        {segment.label}
                    </Link>
                );
            })}
        </>
    );
}

export default function GraceChatMessage({ message }: GraceChatMessageProps) {
    const { confirmAction, dismissAction } = useGrace();
    const isUser = message.role === "user";
    const c = useGraceRedesignCopy();
    const [feedback, setFeedback] = useState<"helpful" | "unhelpful" | null>(null);
    const actions = useMemo(() => message.actions ?? (message.action ? [message.action] : []), [message.actions, message.action]);
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
                <div className="max-w-[85%] px-3.5 py-2.5 text-[13px] leading-relaxed text-white bg-[#1c1c1e] break-words">
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

    return (
        <div
            className={`mb-4 ${message.pinned ? "pl-3" : ""}`}
            style={message.pinned ? { borderLeft: "2px solid var(--color-muted-gold)" } : undefined}
        >
            <p className="border border-[#e6dccd] bg-white px-3 py-2.5 text-[13px] leading-[1.65] text-obsidian whitespace-pre-wrap break-words font-sans">
                <GraceMessageText text={message.content} />
            </p>
            {actions.map((action, index) => (
                <GraceActionRenderer
                    key={`${message.id}-${action.type}-${index}`}
                    action={action}
                    onConfirmAction={() => confirmAction(message.id)}
                    onDismissAction={() => dismissAction(message.id)}
                />
            ))}
            <div className="mt-2 flex items-center gap-2 text-[10px] text-slate">
                <span>{feedback ? c.feedback : actions.some(action => ["showProducts", "displayProductCard", "displayCompatibility", "showProductPresentation"].includes(action.type)) ? c.liveCatalog : c.answer}</span>
                <span className="flex-1" />
                {(["helpful", "unhelpful"] as const).map(value => <button key={value} type="button" aria-label={value === "helpful" ? c.helpful : c.unhelpful}
                    aria-pressed={feedback === value} className="grid h-8 w-8 cursor-pointer place-items-center hover:bg-champagne/30 focus-visible:outline-2 focus-visible:outline-gold-dim"
                    onClick={() => { setFeedback(value); analytics.graceAnswerFeedback({ messageId: message.id, rating: value }); }}>
                    {value === "helpful" ? <ThumbsUp size={14} weight={feedback === value ? "fill" : "regular"} /> : <ThumbsDown size={14} weight={feedback === value ? "fill" : "regular"} />}
                </button>)}
            </div>
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
            <p className="border border-[#e6dccd] bg-white px-3 py-2.5 text-[13px] leading-[1.65] text-obsidian whitespace-pre-wrap break-words font-sans">
                {text}
                <span className="inline-block w-[3px] h-[16px] bg-obsidian/30 ml-0.5 animate-pulse rounded-[1px] align-text-bottom" />
            </p>
        </div>
    );
}

export function ThinkingIndicator() {
    const c = useGraceRedesignCopy();
    return (
        <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex gap-[5px]" aria-label="Grace is thinking">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="w-[5px] h-[5px] rounded-full bg-obsidian/25 animate-bounce motion-reduce:animate-none"
                        style={{ animationDelay: `${i * 150}ms`, animationDuration: "0.9s" }}
                    />
                ))}
            </span>
            <span className="text-[12px] text-obsidian/40 font-sans">{c.thinking}</span>
        </div>
    );
}
