"use client";

import { useRef, useEffect, useLayoutEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    NotePencil,
    CaretRight,
    Paperclip,
    PaperPlaneTilt,
    ArrowsOutSimple,
    Package,
    Compass,
    Leaf,
} from "@phosphor-icons/react";
import VoiceWaveGlyph from "@/components/grace-workspace/VoiceWaveGlyph";
import { useGrace } from "@/components/useGrace";
import { useIsAuthenticated } from "@/lib/useIsAuthenticated";
import { useGraceImageUpload } from "@/lib/useGraceImageUpload";
import GraceChatMessage, { StreamingMessage, ThinkingIndicator } from "./GraceChatMessage";
import { graceConversationDisposition } from "@/lib/grace/pushLayout";
import {
    measureGraceDockedSheet,
    type GraceDockedSheetLayout,
} from "@/lib/grace/dockedSheet";

// Anonymous discovery chip set — PRD v3 spec.
// (Auth-aware swap to "in project" / "no project" sets lights up once Clerk
// auth is wired into the public drawer flow — currently anonymous-only.)
const QUICK_CHIPS = [
    { label: "Find by fitment", icon: Compass, query: "Help me find a bottle by fitment — I know the neck thread size I need." },
    { label: "Browse families", icon: Package, query: "Show me all bottle families — I want to browse what's available." },
    { label: "Match a reference image", icon: Leaf, query: "I have a reference image — help me find a bottle that matches." },
    { label: "Check compatibility", icon: Package, query: "Help me check which caps or applicators fit a bottle." },
];

function GraceMark({ size = 56, glow = false }: { size?: number; glow?: boolean }) {
    return (
        <div
            className="relative flex items-center justify-center rounded-[3px]"
            style={{
                width: size,
                height: size,
                background: "rgba(255, 255, 255, 0.7)",
                border: "1px solid rgba(29, 29, 31, 0.12)",
                boxShadow: glow
                    ? "0 0 0 6px rgba(197,160,101,0.10), 0 8px 24px rgba(29,29,31,0.06)"
                    : "0 1px 2px rgba(29,29,31,0.04)",
            }}
            aria-hidden
        >
            <span
                className="font-cormorant font-semibold leading-none text-obsidian"
                style={{ fontSize: size * 0.5, letterSpacing: "-0.02em" }}
            >
                G
            </span>
            <span
                className="absolute h-[7px] w-[7px] rounded-full bg-muted-gold"
                style={{ right: -3, top: -3 }}
                aria-hidden
            />
        </div>
    );
}

export default function GraceChatDrawer() {
    const {
        panelMode,
        surface,
        panelPresentation,
        getDockAnchor,
        closePanel,
        messages,
        streamingText,
        isAwaitingReply,
        input,
        setInput,
        send,
        resetConversation,
        errorMessage,
        toggleVoice,
        voiceEnabled,
        pageContext,
    } = useGrace();

    // Adaptive top-bar microcopy — anonymous flow.
    // PDP: "Empire Round 50ml" · Catalog with filter: "Catalog · Cylinder" ·
    // otherwise empty (top bar collapses to brand label).
    const pageMicrocopy = (() => {
        if (pageContext?.currentProduct) {
            const p = pageContext.currentProduct;
            return [p.family, p.capacity].filter(Boolean).join(" ") || p.name;
        }
        if (pageContext?.catalogCategory) return `Catalog · ${pageContext.catalogCategory}`;
        if (pageContext?.catalogSearch) return `Catalog · "${pageContext.catalogSearch}"`;
        return "";
    })();

    const router = useRouter();
    const isAuthed = useIsAuthenticated();
    const fileRef = useRef<HTMLInputElement>(null);
    const { uploadAndAnalyze, status: uploadStatus } = useGraceImageUpload();
    const isUploading = uploadStatus === "uploading" || uploadStatus === "analyzing" || uploadStatus === "searching";

    const handleAttachClick = () => fileRef.current?.click();
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        await uploadAndAnalyze(file, { userText: input.trim() || undefined });
        setInput("");
    };
    const isOpen = panelMode === "open";
    const isOverlay = surface.mode === "overlay";
    const isMobile = surface.viewportWidth <= 768;
    const [dockLayout, setDockLayout] = useState<GraceDockedSheetLayout | null>(null);
    const isDocked = isOpen && panelPresentation === "docked" && dockLayout !== null && dockLayout.height > 0;
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
        if (!isOpen || panelPresentation !== "docked") return;
        const measure = () => {
            const anchor = getDockAnchor();
            if (!anchor || anchor.getClientRects().length === 0) {
                setDockLayout(null);
                return;
            }
            const visual = window.visualViewport;
            setDockLayout(measureGraceDockedSheet(anchor, {
                layoutHeight: window.innerHeight,
                visualHeight: visual?.height ?? window.innerHeight,
                visualOffsetTop: visual?.offsetTop ?? 0,
            }));
        };
        const frame = window.requestAnimationFrame(measure);
        const visual = window.visualViewport;
        visual?.addEventListener("resize", measure);
        visual?.addEventListener("scroll", measure);
        window.addEventListener("resize", measure);
        return () => {
            window.cancelAnimationFrame(frame);
            visual?.removeEventListener("resize", measure);
            visual?.removeEventListener("scroll", measure);
            window.removeEventListener("resize", measure);
        };
    }, [getDockAnchor, isOpen, panelPresentation]);

    useEffect(() => {
        if (!isDocked) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = previous; };
    }, [isDocked]);

    const handleExpand = () => {
        closePanel();
        router.push("/grace-workspace");
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, streamingText, isAwaitingReply]);

    useEffect(() => {
        if (isOpen) {
            const t = setTimeout(() => inputRef.current?.focus(), 350);
            return () => clearTimeout(t);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) closePanel();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [isOpen, closePanel]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (input.trim()) send();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (input.trim()) send();
        }
    };

    const handleClose = () => {
        closePanel();
    };

    const handleNewChat = () => {
        if (graceConversationDisposition("new-chat") === "reset") {
            void resetConversation();
        }
        setInput("");
    };

    const [chipsUsed, setChipsUsed] = useState(false);

    const handleChipClick = (query: string) => {
        setChipsUsed(true);
        send(query);
    };

    const userHasInteracted = chipsUsed || messages.some((m) => m.role === "user");
    const showEmptyState = messages.length === 0 && !userHasInteracted;
    const awaitingDockMeasure = isOpen && panelPresentation === "docked" && !isDocked;

    const dockedStyle = isDocked && dockLayout ? {
        top: dockLayout.top,
        height: dockLayout.height,
        left: 0,
        right: 0,
        width: "100%",
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        borderLeft: "1px solid rgba(212, 197, 169, 0.55)",
        borderTop: "1px solid rgba(212, 197, 169, 0.55)",
        boxShadow: "0 -8px 32px rgba(29, 29, 31, 0.18)",
        background: "var(--color-bone)",
        overflow: "hidden",
    } as const : null;

    const overlayStyle = {
        width: surface.mode === "push"
            ? `${surface.drawerWidth}px`
            : isMobile
                ? "100%"
                : "min(440px, 100vw)",
        height: "100dvh",
        background: "var(--color-bone)",
        borderLeft: "1px solid rgba(212, 197, 169, 0.55)",
        borderRadius: 0,
        boxShadow: "-12px 0 48px rgba(29, 29, 31, 0.09)",
        overflow: "hidden",
    } as const;

    return (
        <AnimatePresence>
            {isOpen && !awaitingDockMeasure && surface.mode !== "owned" && (
                <>
                    {isOverlay && !isDocked && (
                        <motion.div
                            key="grace-backdrop"
                            initial={false}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            onClick={handleClose}
                            className="fixed inset-0 z-[60]"
                            style={{ background: "rgba(29, 29, 31, 0.35)", backdropFilter: "blur(2px)" }}
                            aria-hidden="true"
                        />
                    )}

                    <motion.aside
                        key="grace-drawer"
                        initial={false}
                        animate={isDocked ? { opacity: 1, y: 0 } : { opacity: 1, x: 0 }}
                        exit={isDocked ? { opacity: 0, y: "100%" } : { opacity: 0, x: "100%" }}
                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        className={isDocked ? "fixed z-[61] flex flex-col" : "fixed top-0 right-0 z-[61] flex flex-col"}
                        style={dockedStyle ?? overlayStyle}
                        data-testid={isDocked ? "grace-pdp-sheet" : undefined}
                        data-grace-dock-detent={isDocked ? dockLayout?.detent : undefined}
                        role="complementary"
                        aria-label="Grace AI chat"
                    >
                        {/* ── Top bar ─────────────────────────────────── */}
                        <div
                            className="flex items-center justify-between px-4 py-3 shrink-0 relative"
                            style={{
                                borderBottom: "1px solid rgba(212, 197, 169, 0.35)",
                                paddingTop: isDocked ? 18 : undefined,
                            }}
                        >
                            {isDocked ? (
                                <div
                                    className="absolute left-1/2 top-0 flex h-5 w-16 -translate-x-1/2 cursor-pointer items-end justify-center"
                                    onClick={handleClose}
                                >
                                    <div className="h-1 w-10 rounded-full bg-ash/60 grace-sheet-handle" aria-hidden />
                                </div>
                            ) : isMobile ? (
                                <div
                                    className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 cursor-pointer pb-4 pr-4 pl-4"
                                    onClick={handleClose}
                                >
                                    <div className="w-10 h-1.5 rounded-full bg-white/30 backdrop-blur-md grace-sheet-handle" />
                                </div>
                            ) : null}

                            <div className="flex items-center gap-2.5">
                                <GraceMark size={26} />
                                <div className="leading-none min-w-0">
                                    <div className="font-serif text-[14px] font-medium tracking-[0.02em] text-obsidian">
                                        Grace
                                    </div>
                                    {/* Adaptive microcopy — anonymous PDP shows the current product;
                                        anonymous catalog shows the active filter; otherwise the brand. */}
                                    {pageMicrocopy && pageMicrocopy !== "Best Bottles" ? (
                                        <div className="mt-[2px] text-[9px] tracking-[0.04em] text-slate truncate max-w-[220px]">
                                            Concierge · {pageMicrocopy}
                                        </div>
                                    ) : (
                                        <div className="mt-[2px] text-[9px] font-semibold uppercase tracking-[0.18em] text-slate">
                                            Best Bottles
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-0.5">
                                <IconBtn
                                    label="New chat"
                                    onClick={handleNewChat}
                                    icon={<NotePencil size={15} />}
                                />
                                {isAuthed && (
                                    <IconBtn
                                        label="Expand to workspace"
                                        onClick={handleExpand}
                                        icon={<ArrowsOutSimple size={15} />}
                                    />
                                )}
                                <IconBtn
                                    label="Close Grace"
                                    onClick={handleClose}
                                    icon={<X size={15} />}
                                />
                            </div>
                        </div>

                        {!isDocked ? (
                            <div
                                className="shrink-0 border-b border-champagne/40 bg-white/60 px-4 py-2.5 text-[11px] leading-snug text-slate"
                                aria-live="polite"
                            >
                                <span className="font-semibold text-obsidian">Seeing:</span>{" "}
                                {pageMicrocopy || "Best Bottles homepage"}
                            </div>
                        ) : null}

                        {!isDocked ? (
                            <div
                                className="shrink-0 px-4 py-2 text-center text-[10.5px] italic text-slate"
                                style={{ background: "rgba(245, 243, 239, 0.6)" }}
                            >
                                Grace uses real catalog data. Verify before ordering.
                            </div>
                        ) : null}

                        {/* ── Body — empty state OR conversation ──────── */}
                        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                            {showEmptyState ? (
                                <EmptyState onChip={handleChipClick} compact={isDocked} />
                            ) : (
                                <div className="flex-1 overflow-y-auto px-5 py-4">
                                    {messages.map((msg) => (
                                        <GraceChatMessage key={msg.id} message={msg} />
                                    ))}
                                    <StreamingMessage text={streamingText} />
                                    {isAwaitingReply && !streamingText && <ThinkingIndicator />}
                                    {errorMessage && (
                                        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-100/50">
                                            <p className="text-[12px] text-red-600 font-sans leading-relaxed text-center">
                                                {errorMessage}
                                            </p>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                            )}
                        </div>

                        {/* ── Composer ────────────────────────────────── */}
                        <div
                            className="shrink-0 px-4 py-3"
                            style={{ paddingBottom: isDocked || !isMobile ? "max(0.75rem, env(safe-area-inset-bottom))" : "1rem" }}
                        >
                            <form
                                onSubmit={handleSubmit}
                                className="relative bg-white rounded-[3px] transition-colors"
                                style={{
                                    border: voiceEnabled
                                        ? "1px solid var(--color-muted-gold)"
                                        : "1px solid rgba(29, 29, 31, 0.10)",
                                    boxShadow: "0 1px 2px rgba(29,29,31,0.03)",
                                }}
                            >
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={
                                        voiceEnabled ? "Listening…" : "Ask Grace anything…"
                                    }
                                    rows={isDocked ? 1 : 2}
                                    className="w-full bg-transparent text-[14px] text-obsidian placeholder:text-slate/60 outline-none font-sans resize-none px-3.5 pt-3 pb-2 leading-relaxed"
                                    autoComplete="off"
                                />
                                <div
                                    className="flex items-center gap-1 px-2 py-2"
                                    style={{ borderTop: "1px solid rgba(212, 197, 169, 0.35)" }}
                                >
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/jpg,image/webp"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                    <button
                                        type="button"
                                        aria-label="Attach reference image"
                                        title={isUploading ? "Working…" : "Attach a reference image"}
                                        onClick={handleAttachClick}
                                        disabled={isUploading}
                                        className="w-8 h-8 rounded-[3px] flex items-center justify-center cursor-pointer text-slate hover:bg-obsidian/[0.04] hover:text-obsidian transition-colors disabled:opacity-50 disabled:cursor-wait"
                                    >
                                        <Paperclip size={15} />
                                    </button>
                                    <span className="flex-1" />
                                    <button
                                        type="button"
                                        onClick={toggleVoice}
                                        aria-pressed={voiceEnabled}
                                        aria-label={voiceEnabled ? "End voice conversation with Grace" : "Talk with Grace"}
                                        title={voiceEnabled ? "End voice conversation" : "Talk with Grace"}
                                        className="w-9 h-8 rounded-[3px] flex items-center justify-center cursor-pointer transition-colors"
                                        style={{
                                            background: voiceEnabled
                                                ? "var(--color-muted-gold)"
                                                : "transparent",
                                            color: voiceEnabled
                                                ? "var(--color-obsidian)"
                                                : "var(--color-slate)",
                                        }}
                                    >
                                        <VoiceWaveGlyph size={16} active={voiceEnabled} />
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!input.trim()}
                                        aria-label="Send"
                                        className="w-8 h-8 rounded-[3px] flex items-center justify-center cursor-pointer bg-obsidian text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black transition-colors"
                                    >
                                        <PaperPlaneTilt size={14} />
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function IconBtn({
    icon,
    label,
    onClick,
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            aria-label={label}
            title={label}
            className="w-7 h-7 rounded-[3px] flex items-center justify-center cursor-pointer text-slate hover:bg-obsidian/[0.04] hover:text-obsidian transition-colors"
        >
            {icon}
        </button>
    );
}

function EmptyState({ onChip, compact = false }: { onChip: (q: string) => void; compact?: boolean }) {
    // Compact spacing — drawer is now PRD-spec 480px tall, so the empty
    // state has to fit hero mark + chips + section label without scroll.
    const chips = compact
        ? QUICK_CHIPS.filter((chip) => chip.label !== "Browse families")
        : QUICK_CHIPS;
    return (
        <div className={`flex-1 flex flex-col items-center justify-start px-5 ${compact ? "pt-3 pb-2" : "pt-5 pb-3"} overflow-y-auto`}>
            <GraceMark size={compact ? 36 : 44} glow />
            <div className={compact ? "mt-2 text-center" : "mt-3 text-center"}>
                <div className="font-serif text-[19px] font-medium text-obsidian tracking-[0.01em] leading-tight">
                    How can I help?
                </div>
                <div className="mt-1 text-[11.5px] text-slate leading-relaxed max-w-[300px] mx-auto">
                    {compact
                        ? "Ask about fit, case quantities, or a quote for this bottle."
                        : "Browse families, check fitments, or describe what you're packaging."}
                </div>
            </div>

            <div className={`${compact ? "mt-3" : "mt-4"} w-full max-w-[340px] flex flex-col gap-1`}>
                <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate/80 px-1 mb-0.5">
                    Try asking about
                </div>
                {chips.map((chip) => (
                    <button
                        key={chip.label}
                        onClick={() => onChip(chip.query)}
                        className="group flex items-center gap-2.5 px-3 py-2 rounded-[3px] text-left cursor-pointer transition-colors hover:bg-obsidian/[0.03]"
                        style={{ border: "1px solid rgba(212, 197, 169, 0.55)" }}
                    >
                        <CaretRight
                            size={10}
                            weight="bold"
                            className="text-muted-gold shrink-0"
                        />
                        <chip.icon
                            size={13}
                            className="text-slate shrink-0 group-hover:text-obsidian transition-colors"
                            weight="regular"
                        />
                        <span className="text-[12.5px] text-obsidian font-sans leading-snug">
                            {chip.label}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
