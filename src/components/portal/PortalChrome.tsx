"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useOrganization } from "@clerk/nextjs";
import BrandWordmark from "@/components/BrandWordmark";
import { orgInitials, portalSectionLabel } from "./nav";
import PortalNavLinks from "./PortalNavLinks";
import styles from "./PortalChrome.module.css";

export default function PortalChrome({
    companyName,
    tierLabel,
    inTransitCount,
    children,
}: {
    companyName?: string | null;
    tierLabel?: string | null;
    inTransitCount: number;
    children: ReactNode;
}) {
    const pathname = usePathname();
    const { organization } = useOrganization();
    const [navOpen, setNavOpen] = useState(false);
    const drawerId = useId();
    const section = portalSectionLabel(pathname);
    const orgName = companyName ?? organization?.name ?? "Your organization";

    useEffect(() => {
        setNavOpen(false);
    }, [pathname]);

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
        <div className={`app-surface ${styles.shell}`} data-portal-shell>
            <aside className={styles.rail} aria-label="Portal">
                <div className="border-b border-[color:var(--color-rule)] px-5 pb-4 pt-5">
                    <Link href="/" aria-label="Best Bottles home" className="block">
                        <BrandWordmark className="app-wordmark" />
                    </Link>
                    <p className="mt-1.5 font-sans text-[11px] text-[color:var(--color-text-muted)]">Client Portal</p>
                </div>
                <div className="flex items-center gap-2.5 border-b border-[color:var(--color-rule)] px-5 py-3.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[color:var(--color-text-primary)]">
                        <span className="font-sans text-[10px] font-semibold leading-none text-white">{orgInitials(orgName)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate font-sans text-[13px] font-medium leading-tight text-[color:var(--color-text-primary)]">{orgName}</p>
                        <p className="font-sans text-[11px] leading-tight text-[color:var(--color-text-muted)]">{tierLabel ?? "Portal access"}</p>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto py-2">
                    <PortalNavLinks />
                </div>
                <div className="flex items-center justify-between border-t border-[color:var(--color-rule)] px-5 py-3">
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span className="font-sans text-[11px] text-neutral-400">Grace online</span>
                    </div>
                    <UserButton appearance={{ elements: { avatarBox: "w-6 h-6" } }} />
                </div>
            </aside>

            <div className={styles.column}>
                <header className={styles.mobileBar}>
                    <button
                        type="button"
                        className={styles.menuButton}
                        aria-label="Open portal menu"
                        aria-expanded={navOpen}
                        aria-controls={drawerId}
                        onClick={() => setNavOpen(true)}
                    >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                            <path d="M3 5h14M3 10h14M3 15h14" />
                        </svg>
                    </button>
                    <div className={styles.titleBlock}>
                        <p className={styles.eyebrow}>Client Portal</p>
                        <p className={styles.title}>{section}</p>
                    </div>
                    <Link href="/portal/drafts" className={styles.newOrder}>
                        New order
                    </Link>
                </header>

                <div className={styles.desktopBar}>
                    <div className="flex items-center gap-2">
                        <span className="font-sans text-[13px] text-neutral-400">Portal</span>
                        <span className="font-sans text-[13px] text-neutral-300">/</span>
                        <span className="font-sans text-[13px] font-medium text-neutral-900">{section}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span className="font-sans text-[11px] font-medium text-emerald-700">{inTransitCount} in transit</span>
                        </div>
                        <Link
                            href="/portal/drafts"
                            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-neutral-900 px-3.5 font-sans text-[13px] font-medium text-white hover:bg-neutral-800"
                        >
                            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3 w-3 shrink-0">
                                <line x1="6" y1="2" x2="6" y2="10" />
                                <line x1="2" y1="6" x2="10" y2="6" />
                            </svg>
                            New order
                        </Link>
                    </div>
                </div>

                <main className={styles.content}>{children}</main>
            </div>

            {navOpen && (
                <>
                    <button type="button" className={styles.backdrop} aria-label="Close portal menu" onClick={() => setNavOpen(false)} />
                    <div className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby={`${drawerId}-title`} id={drawerId}>
                        <p id={`${drawerId}-title`} className="sr-only">Portal menu</p>
                        <div className={styles.drawerHead}>
                            <div className={styles.drawerBrand}>
                                <Link href="/" aria-label="Best Bottles home" onClick={() => setNavOpen(false)}>
                                    <BrandWordmark className="app-wordmark" />
                                </Link>
                                <p>Client Portal</p>
                            </div>
                            <button type="button" className={styles.closeButton} aria-label="Close portal menu" onClick={() => setNavOpen(false)}>
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                                    <path d="M4 4l10 10M14 4 4 14" />
                                </svg>
                            </button>
                        </div>
                        <div className={styles.org}>
                            <div className={styles.avatar}>{orgInitials(orgName)}</div>
                            <div className="min-w-0">
                                <p className={styles.orgName}>{orgName}</p>
                                <p className={styles.orgMeta}>
                                    {tierLabel ?? "Portal access"}
                                    {inTransitCount > 0 ? ` · ${inTransitCount} in transit` : ""}
                                </p>
                            </div>
                        </div>
                        <div className={styles.drawerNav}>
                            <PortalNavLinks compact onNavigate={() => setNavOpen(false)} />
                        </div>
                        <div className={styles.drawerFoot}>
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span className="font-sans text-[11px] text-neutral-400">Grace online</span>
                            </div>
                            <UserButton appearance={{ elements: { avatarBox: "w-7 h-7" } }} />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
