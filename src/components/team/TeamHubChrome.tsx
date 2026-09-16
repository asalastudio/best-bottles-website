"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandWordmark from "@/components/BrandWordmark";
import TeamHubRail from "@/components/team/TeamHubRail";
import { teamHubSectionLabel, type TeamHubTool } from "@/lib/teamHub";
import styles from "./TeamHubChrome.module.css";

export default function TeamHubChrome({
    tools,
    counts,
    previewMode,
    children,
}: {
    tools: TeamHubTool[];
    counts: Record<string, number>;
    previewMode: boolean;
    children: ReactNode;
}) {
    const pathname = usePathname();
    const [navOpen, setNavOpen] = useState(false);
    const [menuPath, setMenuPath] = useState(pathname);
    const drawerId = useId();
    const section = teamHubSectionLabel(pathname);

    if (menuPath !== pathname) {
        setMenuPath(pathname);
        setNavOpen(false);
    }

    useEffect(() => {
        if (!navOpen) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setNavOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = previous;
            window.removeEventListener("keydown", onKey);
        };
    }, [navOpen]);

    return (
        <div className={`app-surface ${styles.shell}`} data-team-hub data-team-hub-shell>
            <aside className={styles.rail} aria-label="Team Hub">
                <TeamHubRail
                    tools={tools}
                    previewMode={previewMode}
                    counts={counts}
                    activeHref={pathname}
                />
            </aside>

            <div className={styles.column}>
                <header className={styles.mobileBar}>
                    <button
                        type="button"
                        className={styles.menuButton}
                        aria-label="Open Team Hub menu"
                        aria-expanded={navOpen}
                        aria-controls={drawerId}
                        onClick={() => setNavOpen(true)}
                    >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                            <path d="M3 5h14M3 10h14M3 15h14" />
                        </svg>
                    </button>
                    <div className={styles.titleBlock}>
                        <Link href="/" aria-label="Best Bottles home" className={styles.headerMark}>
                            <BrandWordmark className="app-wordmark" />
                        </Link>
                        <div className={styles.titleCopy}>
                            <p className={styles.eyebrow}>Team Hub</p>
                            <p className={styles.title}>{section}</p>
                        </div>
                    </div>
                </header>
                <div className={styles.content}>{children}</div>
            </div>

            {navOpen ? (
                <>
                    <button
                        type="button"
                        className={styles.backdrop}
                        aria-label="Close Team Hub menu"
                        onClick={() => setNavOpen(false)}
                    />
                    <div
                        className={styles.drawer}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={`${drawerId}-title`}
                        id={drawerId}
                    >
                        <p id={`${drawerId}-title`} className="sr-only">
                            Team Hub menu
                        </p>
                        <div className={styles.drawerHead}>
                            <div className={styles.drawerBrand}>
                                <Link href="/" aria-label="Best Bottles home" onClick={() => setNavOpen(false)}>
                                    <BrandWordmark className="app-wordmark" />
                                </Link>
                                <p>Team Hub</p>
                            </div>
                            <button
                                type="button"
                                className={styles.closeButton}
                                aria-label="Close Team Hub menu"
                                onClick={() => setNavOpen(false)}
                            >
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                                    <path d="M4 4l10 10M14 4 4 14" />
                                </svg>
                            </button>
                        </div>
                        <div className={styles.drawerNav}>
                            <TeamHubRail
                                tools={tools}
                                previewMode={previewMode}
                                counts={counts}
                                activeHref={pathname}
                                hideBrand
                                onNavigate={() => setNavOpen(false)}
                            />
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}
