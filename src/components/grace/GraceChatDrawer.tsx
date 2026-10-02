"use client";

import { useRef, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, List, Paperclip, ArrowUp, ArrowsOutSimple, CaretRight } from "@phosphor-icons/react";
import VoiceWaveGlyph from "@/components/grace-workspace/VoiceWaveGlyph";
import BrandBottleMark from "@/components/BrandBottleMark";
import LocaleLink from "@/components/LocaleLink";
import { useGrace } from "@/components/useGrace";
import { useCopy } from "@/i18n/useCopy";
import { useGraceImageUpload } from "@/lib/useGraceImageUpload";
import GraceChatMessage, { StreamingMessage, ThinkingIndicator } from "./GraceChatMessage";
import GraceOrderList from "./GraceOrderList";
import GraceCartSummary from "./GraceCartSummary";
import { useGraceRedesignCopy } from "./redesignCopy";
import styles from "./GraceShop.module.css";

export default function GraceChatDrawer() {
    const { panelMode, surface, closePanel, messages, streamingText, isAwaitingReply, input, setInput, send,
        resetConversation, errorMessage, toggleVoice, voiceEnabled, pageContext } = useGrace();
    const t = useCopy("grace");
    const c = useGraceRedesignCopy();
    const router = useRouter();
    const reducedMotion = useReducedMotion();
    const [menuOpen, setMenuOpen] = useState(false);
    const [orderListOpen, setOrderListOpen] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const panelRef = useRef<HTMLElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { uploadAndAnalyze, status: uploadStatus, error: uploadError } = useGraceImageUpload();
    const isUploading = ["uploading", "analyzing", "searching"].includes(uploadStatus);
    const busy = isAwaitingReply || !!streamingText || isUploading;
    const isOpen = panelMode === "open" && surface.mode !== "owned";
    const isMobile = surface.viewportWidth <= 768;
    const isRail = surface.mode === "push";
    const pageLabel = pageContext?.currentProduct?.name
        || (pageContext?.catalogSearch ? `${c.catalog} · ${pageContext.catalogSearch}` : pageContext?.catalogCategory ? `${c.catalog} · ${pageContext.catalogCategory}` : null)
        || (pageContext?.pageType === "home" ? c.home : pageContext?.pageType === "catalog" ? c.catalog : pageContext?.pageType === "cart" ? c.cartPage : pageContext?.currentCollection || c.page);
    const showPageContext = Boolean(pageContext?.currentProduct || pageContext?.catalogSearch || pageContext?.catalogCategory || pageContext?.currentCollection);
    const showEmptyState = messages.length === 0 && !busy;
    const firstQuestion = messages.find(message => message.role === "user")?.content;

    const handleClose = () => { setMenuOpen(false); closePanel(); };
    const handleExpand = () => { handleClose(); router.push("/grace-workspace"); };
    const handleNewChat = () => { setOrderListOpen(false); void resetConversation(); setInput(""); setMenuOpen(false); inputRef.current?.focus(); };
    const handleSubmit = (event: FormEvent) => { event.preventDefault(); if (input.trim() && !busy) void send(); };
    const closeMenu = () => { setMenuOpen(false); menuButtonRef.current?.focus(); };

    useEffect(() => {
        if (!isOpen) return;
        const previousFocus = document.activeElement as HTMLElement | null;
        panelRef.current?.focus();
        return () => {
            requestAnimationFrame(() => {
                if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus();
                else document.querySelector<HTMLButtonElement>("[data-grace-launcher]")?.focus();
            });
        };
    }, [isOpen]);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "end" });
    }, [messages, streamingText, isAwaitingReply, reducedMotion]);
    useEffect(() => {
        if (!isOpen || !isMobile) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = previous; };
    }, [isOpen, isMobile]);
    useEffect(() => {
        if (menuOpen) menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }, [menuOpen]);

    return <AnimatePresence>{isOpen && <>
        {isMobile && <div className={styles.backdrop} aria-hidden="true" />}
        <motion.aside ref={panelRef} tabIndex={-1} role="dialog" aria-modal={isMobile || undefined} aria-label={t("chatAria")}
            data-ph-private data-ph-mask
            className={`ph-no-capture ph-no-heatmaps ph-block ${styles.panel} ${isRail ? styles.rail : ""}`}
            style={isRail ? { width: surface.drawerWidth } : undefined}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : 12 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}
            onKeyDown={event => {
                if (event.key === "Escape") { event.stopPropagation(); if (menuOpen) closeMenu(); else handleClose(); }
                if (event.key !== "Tab" || (!isMobile && !menuOpen)) return;
                const scope = menuOpen ? menuRef.current : panelRef.current;
                const focusable = scope?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], textarea:not(:disabled), [tabindex="0"]');
                if (!focusable?.length) return;
                const first = focusable[0]; const last = focusable[focusable.length - 1];
                if (event.shiftKey && (document.activeElement === first || document.activeElement === scope)) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }}>
            <header className={styles.header}>
                <BrandBottleMark size={26} motion={busy ? "working" : "still"} />
                <div className={styles.identity}><strong>Grace</strong><span>{c.concierge}</span></div>
                <button ref={menuButtonRef} type="button" className={styles.menuButton} aria-label={c.menu} aria-expanded={menuOpen} aria-controls="grace-menu" onClick={() => menuOpen ? closeMenu() : setMenuOpen(true)}><List size={17} /></button>
                <button type="button" aria-label={c.expand} title={c.expand} onClick={handleExpand}><ArrowsOutSimple size={17} /></button>
                <button type="button" aria-label={c.close} title={c.close} onClick={handleClose}><X size={18} /></button>
            </header>
            <div className={styles.main} inert={menuOpen}>
                <div className={`${styles.feed} ${showEmptyState ? styles.welcome : ""}`}>
                    {orderListOpen ? <GraceOrderList onClose={() => setOrderListOpen(false)} /> : showEmptyState ? <>
                        <div className={styles.welcomeContent}>
                            <div className={styles.greeting}><h2>{c.greeting}</h2></div>
                            <div className={styles.intents}>{c.intents.map((label, index) => <button key={label} type="button" onClick={() => void send(c.prompts[index])}><span>{label}</span><CaretRight size={14} aria-hidden="true" /></button>)}</div>
                        </div>
                        {showPageContext && <p className={styles.context}><span aria-hidden="true" />{c.seeing} <strong>{pageLabel}</strong></p>}
                    </> : <>
                        {showPageContext && <p className={styles.conversationContext}>{c.seeing} <strong>{pageLabel}</strong></p>}
                        {messages.map(message => <GraceChatMessage key={message.id} message={message} />)}
                        <StreamingMessage text={streamingText} />
                        {isAwaitingReply && !streamingText && <ThinkingIndicator />}
                        <div ref={messagesEndRef} />
                    </>}
                    {(errorMessage || uploadError) && <p className={styles.error} role="alert">{errorMessage || uploadError}</p>}
                </div>
                <div className={styles.composerArea} hidden={orderListOpen}>
                    <GraceCartSummary onNavigate={handleClose} />
                    <form onSubmit={handleSubmit} className={styles.composer} data-has-input={!!input.trim()}>
                        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async event => {
                            const file = event.target.files?.[0]; if (!file) return; event.target.value = "";
                            const draft = input.trim();
                            setInput("");
                            await uploadAndAnalyze(file, { userText: draft || undefined });
                        }} />
                        <button type="button" aria-label={c.attach} title={`${c.attach} (${c.imageHint})`} disabled={busy} onClick={() => fileRef.current?.click()}><Paperclip size={18} /></button>
                        <textarea ref={inputRef} value={input} onChange={event => setInput(event.target.value)} aria-label={c.placeholder} placeholder={voiceEnabled ? t("listening") : c.placeholder} rows={1} onKeyDown={event => {
                            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (input.trim() && !busy) void send(); }
                        }} />
                        {(!input.trim() || voiceEnabled) && <button className={styles.voice} type="button" aria-pressed={voiceEnabled} aria-label={voiceEnabled ? t("endVoiceAria") : t("talkWith")} title={t("talkWith")} onClick={toggleVoice}><VoiceWaveGlyph size={22} color="#E3C07C" active={voiceEnabled} /><span>{voiceEnabled ? c.stopVoice : c.voice}</span></button>}
                        {!!input.trim() && <button className={styles.send} type="submit" disabled={!input.trim() || busy} aria-label={c.send}><ArrowUp size={18} /></button>}
                    </form>
                    <footer className={styles.footer}><span>{c.verify}</span><LocaleLink href="/contact" onClick={handleClose}>{c.person}</LocaleLink></footer>
                </div>
            </div>
            {menuOpen && <>
                <button className={styles.menuScrim} aria-label={c.close} onClick={closeMenu} tabIndex={-1} />
                <div id="grace-menu" ref={menuRef} className={styles.menu} role="region" aria-label={c.menu}>
                    <button className={styles.newChat} type="button" onClick={handleNewChat} disabled={busy}>＋ {c.newChat}</button>
                    <nav aria-label={c.account}><h3>{c.account}</h3>
                        <LocaleLink href="/portal/orders" onClick={handleClose}>{c.orders}<CaretRight size={14} /></LocaleLink>
                        <LocaleLink href="/request-sample" onClick={handleClose}>{c.samples}<CaretRight size={14} /></LocaleLink>
                        <button type="button" disabled={busy} onClick={() => { closeMenu(); setOrderListOpen(true); }}>{c.orderList}<CaretRight size={14} /></button>
                    </nav>
                    <section className={styles.recent}><h3>{c.conversation}</h3>
                        {firstQuestion ? <button type="button" onClick={closeMenu}><strong>{firstQuestion}</strong><span>{c.current}</span></button> : <p>{c.noConversation}</p>}
                        <button type="button" onClick={handleExpand}>{c.workspace}<ArrowsOutSimple size={14} /></button>
                    </section>
                    <div className={styles.menuBottom}><GraceCartSummary onNavigate={handleClose} />
                        <LocaleLink href="/cart" onClick={handleClose}>{c.viewCart}</LocaleLink>
                        <LocaleLink href="/contact" onClick={handleClose}>{c.person}</LocaleLink>
                        <div className={styles.policies}><p>{c.disclaimer}</p><LocaleLink href="/privacy" onClick={handleClose}>{c.privacy}</LocaleLink><span aria-hidden="true"> · </span><LocaleLink href="/terms" onClick={handleClose}>{c.terms}</LocaleLink></div>
                    </div>
                </div>
            </>}
        </motion.aside>
    </>}</AnimatePresence>;
}
