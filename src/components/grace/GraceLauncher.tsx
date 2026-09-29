"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useGrace } from "@/components/useGrace";
import { useCopy } from "@/i18n/useCopy";
import { stripLocalePrefix } from "@/i18n/paths";
import BrandBottleMark from "@/components/BrandBottleMark";
import { useGraceRedesignCopy } from "./redesignCopy";
import styles from "./GraceLauncher.module.css";

export default function GraceLauncher() {
    const { panelMode, openPanel, launcherTooltip, companionMode, messages, isAwaitingReply, streamingText } = useGrace();
    const t = useCopy("grace");
    const c = useGraceRedesignCopy();
    const route = stripLocalePrefix(usePathname());
    const [scrolled, setScrolled] = useState(false);
    const [lastReadId, setLastReadId] = useState<string | null>(null);
    const lastReply = messages.findLast(message => message.role === "grace")?.id ?? null;
    const working = isAwaitingReply || !!streamingText;
    const isOpen = panelMode === "open";
    const unread = !!lastReply && lastReply !== lastReadId && !working;
    const edge = route.startsWith("/products/") || route === "/cart";
    const ownsViewport = ["/grace-workspace", "/executive", "/team", "/portal", "/checkout"].some(prefix => route.startsWith(prefix));
    useEffect(() => {
        const update = () => setScrolled(window.scrollY > 400);
        update();
        window.addEventListener("scroll", update, { passive: true });
        return () => window.removeEventListener("scroll", update);
    }, []);
    useEffect(() => {
        // A reply counts as read only while its conversation is visible.
        if (isOpen || route.startsWith("/grace-workspace")) setLastReadId(lastReply); // eslint-disable-line react-hooks/set-state-in-effect
    }, [isOpen, lastReply, route]);
    if (isOpen || ownsViewport) return null;
    return <button type="button" data-grace-launcher="" className={`${styles.launcher} ${edge ? styles.edge : ""} ${scrolled ? styles.collapsed : ""}`}
        onClick={() => openPanel()} aria-label={unread ? `${t("openAria")} · ${c.unread}` : t("openAria")} title={t("openTitle")}
        data-grace-agentic={companionMode === "agentic" ? "true" : "false"}>
        <BrandBottleMark size={34} motion={working ? "working" : "idle"} reversed={edge} />
        <span className={styles.label}>{working ? c.finding : c.ask}</span>
        {unread && <span className={styles.unread} aria-label={c.unread} />}
        {launcherTooltip && <span className={styles.tooltip} role="status">{launcherTooltip.message}</span>}
    </button>;
}
